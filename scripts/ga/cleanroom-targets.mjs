// Per-ecosystem target runners: stand up the clean room, install the published artifact, then
// hand a context to the checks. Nothing here reads the repository checkout.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHECKS } from './cleanroom-checks.mjs';
import {
  PUBLIC_NPM, bad, fetchJson, installedFile, installedManifest, latestNonYankedVersion,
  npmCleanRoom, npmEncode, ok, releaseIsYanked, run, yankReason,
} from './cleanroom-util.mjs';
import { checkSbomPresence } from './sbom-presence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export async function runNpmTarget(target, args) {
  const pkg = target.package;
  const latest = await fetchJson(`${PUBLIC_NPM}/${npmEncode(pkg)}/latest`);
  const version = args.versions[pkg] || latest.version;
  // `version` is encoded for the same reason the package name is: it can come from the
  // `workflow_dispatch` versions input, so it is not repo-controlled and must not be able to
  // introduce a path separator. The PyPI path below already encodes both halves.
  const packument = version === latest.version ? latest : await fetchJson(`${PUBLIC_NPM}/${npmEncode(pkg)}/${npmEncode(version)}`);

  const result = {
    id: target.id,
    ecosystem: 'npm',
    package: pkg,
    version,
    registry: PUBLIC_NPM,
    integrity: packument?.dist?.integrity || null,
    resolved_from: args.versions[pkg] ? 'explicit --versions pin' : 'registry dist-tag `latest`',
    checks: [],
  };

  // SUPPLY-001 (cw#4803): deliberately computed from registry METADATA, before the clean-room
  // install below, and unconditionally (not gated in the generic CHECKS-table loop further down)
  // — a target whose `npm install` fails must still produce SBOM evidence, never silently drop
  // it. See cleanroom-targets.mjs's PyPI path (runPypiTarget) for the same rule.
  if (target.checks.includes('sbom-presence')) {
    result.checks.push(await checkSbomPresence({
      packageLabel: `${pkg}@${version}`,
      repoRaw: packument?.repository,
    }));
  }

  const cr = npmCleanRoom(pkg, version);
  result.clean_room = cr.room;
  if (cr.failed) {
    result.checks.push(bad('install', `${cr.failed}: ${(cr.install.stderr || cr.install.stdout || cr.install.error || '').trim().slice(0, 600)}`));
    return result;
  }
  const manifest = installedManifest(cr.room, pkg);
  if (!manifest) {
    result.checks.push(bad('install', `install reported success but ${pkg} is absent from node_modules`));
    return result;
  }
  result.installed_version = manifest.version;
  result.checks.push(ok('install', `installed ${pkg}@${manifest.version} from ${PUBLIC_NPM} into a clean directory`));
  if (manifest.version !== version) {
    result.checks.push(bad('install-version-matches-request', `requested ${version} but node_modules contains ${manifest.version}`));
  }

  let mcpCache = null;
  const ctx = {
    target, pkg, version, manifest, packument, room: cr.room, env: cr.env,
    binPath() {
      const b = manifest.bin;
      const rel = typeof b === 'string' ? b : b && (b[target.bin] || Object.values(b)[0]);
      return rel ? installedFile(cr.room, pkg, ...rel.split('/')) : null;
    },
    async mcpProbe() {
      if (mcpCache) return mcpCache;
      const entry = ctx.binPath();
      if (!entry) { mcpCache = { ok: false, error: `no server entrypoint for ${pkg}` }; return mcpCache; }
      const r = run(process.execPath, [join(HERE, 'mcp-stdio-probe.mjs'), entry], { cwd: cr.room, env: cr.env, timeout: 120000 });
      const line = r.stdout.trim().split('\n').filter(Boolean).pop();
      try { mcpCache = JSON.parse(line); }
      catch { mcpCache = { ok: false, error: `unparseable probe output (exit ${r.status}): ${(r.stdout + r.stderr).slice(0, 300)}` }; }
      return mcpCache;
    },
  };

  for (const name of target.checks) {
    // Already produced, unconditionally, above — before the install this loop's checks assume
    // succeeded. Re-running it here would both duplicate evidence and hide behind an install
    // failure that already returned before reaching this loop.
    if (name === 'sbom-presence') continue;
    const fn = CHECKS[name];
    if (!fn) { result.checks.push(bad(name, 'check not implemented in cleanroom-checks.mjs')); continue; }
    try { result.checks.push(await fn(ctx)); }
    catch (e) { result.checks.push(bad(name, `check threw ${e?.name}: ${String(e?.message).slice(0, 300)}`)); }
  }
  return result;
}

/**
 * Pure decision layer for PyPI yank state (PEP 592) — deliberately factored out of `runPypiTarget`
 * so it is unit-testable against fixture JSON with no network call, no pip, no venv. Given the
 * already-fetched project-level and resolved-version PyPI documents, decides whether the resolved
 * version is something a real, unconstrained `pip install <name>[==version]` would actually give a
 * user, which is the exact question the direct-URL-download defect skipped entirely.
 *
 * `versionMeta.urls` for a real PyPI response is per-file: `[{ filename, yanked, yanked_reason }]`.
 * `versionMeta.info.yanked` / `info.yanked_reason` is the release-level flag. Either can carry the
 * truth depending on when the release was yanked, so both are checked (`releaseIsYanked` covers the
 * per-file case; `info.yanked` covers the release-level case) — this mirrors what pip itself
 * consults per PEP 592.
 */
export function evaluatePypiYankState({
  name, version, resolvedFromPin, projectMeta, versionMeta,
}) {
  const files = versionMeta?.urls || [];
  const checks = [];

  if (files.length === 0) {
    checks.push(bad('yank-state', `PyPI lists no files for ${name}==${version} — nothing for a real \`pip install ${name}==${version}\` to install`));
    return { yanked: null, installable: false, checks };
  }

  const yanked = versionMeta?.info?.yanked === true || releaseIsYanked(files);
  if (yanked) {
    checks.push(bad('yank-state', `PyPI has YANKED ${name}==${version} (PEP 592) — ${yankReason(versionMeta)}. A real \`pip install ${name}==${version}\` refuses this release; the clean room must too.`));
  } else {
    checks.push(ok('yank-state', `${name}==${version} is not yanked on PyPI`));
  }

  // Only meaningful when the target resolved to "latest" (no explicit --versions pin): PyPI keeps
  // `info.version` pointed at the most-recently-published release even after it (and every earlier
  // release) is yanked, so a naive "latest = info.version" reading can silently pick an
  // unreachable release. A real unconstrained `pip install <name>` resolves to the highest
  // NON-yanked release instead.
  if (!resolvedFromPin) {
    const nonYankedLatest = latestNonYankedVersion(projectMeta);
    if (nonYankedLatest && nonYankedLatest !== version) {
      checks.push(bad('latest-is-non-yanked', `resolved "latest" to ${version} via PyPI info.version, but the highest NON-yanked release is ${nonYankedLatest} — an unconstrained \`pip install ${name}\` resolves there, not to ${version}`));
    }
  }

  return { yanked, installable: !yanked, checks };
}

function pipVenv(python, room) {
  const venv = join(room, 'venv');
  const mk = run(python, ['-m', 'venv', venv], { cwd: room, timeout: 300000 });
  if (mk.status !== 0) {
    return { ok: false, detail: `could not create a clean venv with ${python}: ${(mk.stderr || mk.stdout || mk.error || '').trim().slice(0, 400)}` };
  }
  return { ok: true, py: join(venv, 'bin', 'python') };
}

export async function runPypiTarget(target, args) {
  const name = target.package;
  const expectYanked = target.expect === 'yanked';
  const requestedVersion = args.versions[name];
  const resolvedFromPin = Boolean(requestedVersion);

  const projectMeta = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  const version = requestedVersion || projectMeta.info.version;
  const versionMeta = version === projectMeta.info.version
    ? projectMeta
    : await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`);

  const result = {
    id: target.id,
    ecosystem: 'pypi',
    package: name,
    version,
    registry: 'https://pypi.org',
    resolved_from: resolvedFromPin ? 'explicit --versions pin' : 'PyPI info.version',
    ...(expectYanked ? { negative_control: true } : {}),
    checks: [],
  };

  const yankEval = evaluatePypiYankState({
    name, version, resolvedFromPin, projectMeta, versionMeta,
  });

  if (expectYanked) {
    // Negative control: this target's entire job is to prove PyPI has retired every release of a
    // deliberately-sunset package and that a real, unconstrained `pip install <name>` fails.
    // "PASS" here means "still correctly retired"; a FAIL means the retirement regressed (a new
    // release appeared, or a release got un-yanked) — the gate must surface that loudly, never
    // read "no positive target to run" as health. See IGV-D-024 (2026-09-07): this package is the
    // retired legacy name; the canonical package is the sibling `pypi-wave-sdk` target.
    if (yankEval.yanked !== true) {
      result.checks.push(bad('negative-control-yanked', `expected ${name} to be fully yanked on PyPI (retired package, negative control) but the resolved release ${name}==${version} is NOT yanked — the retirement regressed or this target needs updating`));
      return result;
    }
    result.checks.push(ok('negative-control-yanked', `confirmed ${name}==${version} is YANKED on PyPI — ${yankReason(versionMeta)}`));

    const room = mkdtempSync(join(tmpdir(), 'wave-cleanroom-py-'));
    result.clean_room = room;
    const venv = pipVenv(args.python, room);
    if (!venv.ok) { result.checks.push(bad('venv', venv.detail)); return result; }

    // Unconstrained — no version pin — exactly the command a real user runs.
    const inst = run(venv.py, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '--no-input', name], { cwd: room, timeout: 600000 });
    if (inst.status === 0) {
      result.checks.push(bad('negative-control-install-refused', `expected \`pip install ${name}\` to fail (fully yanked) but it SUCCEEDED — this is exactly the false-green this gate exists to catch`));
      return result;
    }
    result.checks.push(ok('negative-control-install-refused', `\`pip install ${name}\` correctly refused: ${(inst.stderr || inst.stdout).trim().slice(0, 400)}`));
    return result;
  }

  result.checks.push(...yankEval.checks);

  // SUPPLY-001 (cw#4803): independent of installability — asks whether the GitHub Release backing
  // this PyPI package carries an SBOM asset. Reads `versionMeta` (the RESOLVED version's own
  // metadata), NOT `projectMeta` (project-level, always reflects whatever release PyPI most
  // recently indexed) — a package's declared repository can change between releases (this repo
  // lived through exactly that under Option A, 2026-09-06), so using the project-level document
  // could validate the wrong repository for an explicitly `--versions`-pinned older release.
  // Reported back rather than hardcoded, same rule as the npm path in cleanroom-checks.mjs. Not
  // run for the `expect: 'yanked'` negative-control target above — that target's whole job is
  // proving a retirement, and returns before reaching here.
  if (target.checks.includes('sbom-presence')) {
    result.checks.push(await checkSbomPresence({
      packageLabel: `${name}@${version}`,
      repoRaw: versionMeta?.info?.project_urls?.Repository,
    }));
  }

  if (!yankEval.installable) return result;

  const room = mkdtempSync(join(tmpdir(), 'wave-cleanroom-py-'));
  result.clean_room = room;
  const venv = pipVenv(args.python, room);
  if (!venv.ok) { result.checks.push(bad('venv', venv.detail)); return result; }

  // Installed BY NAME==VERSION FROM THE PUBLIC INDEX — never a direct file URL. This is what makes
  // pip's own resolver, and therefore PyPI's yank state (PEP 592), bite naturally: the exact
  // command a customer's `pip install <name>==<version>` runs, not a bypass of it.
  const inst = run(venv.py, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '--no-input', `${name}==${version}`], { cwd: room, timeout: 600000 });
  if (inst.status !== 0) {
    result.checks.push(bad('install', `pip install ${name}==${version} from the public PyPI index failed — this is what a real \`pip install ${name}==${version}\` gets: ${(inst.stderr || inst.stdout).trim().slice(0, 600)}`));
    return result;
  }
  result.checks.push(ok('install', `pip installed ${name}==${version} from the public PyPI index into a fresh venv (${args.python}) — the same path a real user's \`pip install\` takes`));

  // cwd is the throwaway room, never the repo: a checkout on sys.path could satisfy an import the
  // published wheel is supposed to satisfy — exactly the illusion this suite exists to destroy.
  // cleanroom_python_assert.py re-verifies that independently and reports it as its own check.
  const argv = [join(HERE, 'cleanroom_python_assert.py'), '--dist', name, '--module', target.import_module];
  if (target.import_symbol) argv.push('--symbol', target.import_symbol);
  const probe = run(venv.py, argv, { cwd: room, timeout: 180000 });
  let parsed;
  try { parsed = JSON.parse(probe.stdout.trim().split('\n').filter(Boolean).pop()); }
  catch {
    result.checks.push(bad('py-probe', `assertion script produced no parseable JSON (exit ${probe.status}): ${(probe.stdout + probe.stderr).slice(0, 400)}`));
    return result;
  }

  result.python = parsed.python;
  result.top_level = parsed.top_level;
  // 'sbom-presence' is handled directly in JS above (it is not, and cannot be, produced by
  // cleanroom_python_assert.py) — exclude it here so the "missing check" reconciliation below
  // doesn't mistake an already-satisfied JS-side check for one the Python probe forgot to emit.
  const pythonWantedChecks = target.checks.filter((c) => c !== 'sbom-presence');
  const wanted = new Set(pythonWantedChecks);
  for (const c of parsed.checks) {
    if (c.name === 'cleanroom-isolation' || wanted.has(c.name)) result.checks.push(c);
  }
  for (const want of pythonWantedChecks) {
    if (!parsed.checks.some((c) => c.name === want)) result.checks.push(bad(want, 'check not produced by cleanroom_python_assert.py'));
  }
  return result;
}
