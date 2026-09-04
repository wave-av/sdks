// Per-ecosystem target runners: stand up the clean room, install the published artifact, then
// hand a context to the checks. Nothing here reads the repository checkout.

import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHECKS } from './cleanroom-checks.mjs';
import {
  PUBLIC_NPM, bad, fetchJson, installedFile, installedManifest, npmCleanRoom, npmEncode, ok, run,
} from './cleanroom-util.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export async function runNpmTarget(target, args) {
  const pkg = target.package;
  const latest = await fetchJson(`${PUBLIC_NPM}/${npmEncode(pkg)}/latest`);
  const version = args.versions[pkg] || latest.version;
  const packument = version === latest.version ? latest : await fetchJson(`${PUBLIC_NPM}/${npmEncode(pkg)}/${version}`);

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
    const fn = CHECKS[name];
    if (!fn) { result.checks.push(bad(name, 'check not implemented in cleanroom-checks.mjs')); continue; }
    try { result.checks.push(await fn(ctx)); }
    catch (e) { result.checks.push(bad(name, `check threw ${e?.name}: ${String(e?.message).slice(0, 300)}`)); }
  }
  return result;
}

export async function runPypiTarget(target, args) {
  const name = target.package;
  const meta = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  const version = args.versions[name] || meta.info.version;
  const files = version === meta.info.version
    ? meta.urls
    : (await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)).urls;

  const result = {
    id: target.id,
    ecosystem: 'pypi',
    package: name,
    version,
    registry: 'https://pypi.org',
    resolved_from: args.versions[name] ? 'explicit --versions pin' : 'PyPI info.version',
    checks: [],
  };

  const wheel = files.find((f) => f.packagetype === 'bdist_wheel') || files.find((f) => f.packagetype === 'sdist');
  if (!wheel) { result.checks.push(bad('download', `PyPI serves no wheel or sdist for ${name}@${version}`)); return result; }

  const room = mkdtempSync(join(tmpdir(), 'wave-cleanroom-py-'));
  result.clean_room = room;
  const wheelPath = join(room, wheel.filename); // pip rejects a renamed wheel — keep the real filename
  const bytes = Buffer.from(await (await fetch(wheel.url)).arrayBuffer());
  writeFileSync(wheelPath, bytes);
  const sha = createHash('sha256').update(bytes).digest('hex');
  result.artifact = { filename: wheel.filename, url: wheel.url, sha256: sha };
  if (wheel.digests?.sha256 && wheel.digests.sha256 !== sha) {
    result.checks.push(bad('download', `downloaded ${wheel.filename} sha256 ${sha} != PyPI-declared ${wheel.digests.sha256}`));
    return result;
  }
  result.checks.push(ok('download', `downloaded ${wheel.filename} from PyPI, sha256 ${sha} matches the declared digest`));

  const venv = join(room, 'venv');
  const mk = run(args.python, ['-m', 'venv', venv], { cwd: room, timeout: 300000 });
  if (mk.status !== 0) {
    result.checks.push(bad('venv', `could not create a clean venv with ${args.python}: ${(mk.stderr || mk.stdout || mk.error || '').trim().slice(0, 400)}`));
    return result;
  }
  const py = join(venv, 'bin', 'python');
  const inst = run(py, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '--no-input', wheelPath], { cwd: room, timeout: 600000 });
  if (inst.status !== 0) {
    result.checks.push(bad('install', `pip install of the downloaded wheel failed: ${(inst.stderr || inst.stdout).trim().slice(0, 600)}`));
    return result;
  }
  result.checks.push(ok('install', `pip installed the downloaded wheel into a fresh venv (${args.python})`));

  // cwd is the throwaway room, never the repo: a checkout on sys.path could satisfy an import the
  // published wheel is supposed to satisfy — exactly the illusion this suite exists to destroy.
  // cleanroom_python_assert.py re-verifies that independently and reports it as its own check.
  const argv = [join(HERE, 'cleanroom_python_assert.py'), '--dist', name, '--module', target.import_module];
  if (target.import_symbol) argv.push('--symbol', target.import_symbol);
  const probe = run(py, argv, { cwd: room, timeout: 180000 });
  let parsed;
  try { parsed = JSON.parse(probe.stdout.trim().split('\n').filter(Boolean).pop()); }
  catch {
    result.checks.push(bad('py-probe', `assertion script produced no parseable JSON (exit ${probe.status}): ${(probe.stdout + probe.stderr).slice(0, 400)}`));
    return result;
  }

  result.python = parsed.python;
  result.top_level = parsed.top_level;
  const wanted = new Set(target.checks);
  for (const c of parsed.checks) {
    if (c.name === 'cleanroom-isolation' || wanted.has(c.name)) result.checks.push(c);
  }
  for (const want of target.checks) {
    if (!parsed.checks.some((c) => c.name === want)) result.checks.push(bad(want, 'check not produced by cleanroom_python_assert.py'));
  }
  return result;
}
