// Shared primitives for the registry clean-room suite: process execution, registry fetches,
// check-result constructors, and the isolated-npm environment.
//
// The npm isolation is the load-bearing part. On a developer machine `@wave-av:registry` often
// points at a private GitHub registry, so an install that *looks* like "from npm" can quietly
// exercise a different artifact than customers receive. Every npm invocation here runs against a
// freshly generated user-config with no auth, no ambient scope override, and a private cache.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PUBLIC_NPM = 'https://registry.npmjs.org';

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: opts.timeout ?? 600000,
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error.message) : null,
  };
}

export async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'wave-ga-registry-cleanroom/1.0' } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

export function ok(name, detail) { return { name, ok: true, detail }; }
export function bad(name, detail) { return { name, ok: false, detail }; }

/**
 * Encode one value as a SINGLE npm-registry URL path segment.
 *
 * `encodeURIComponent`, not a hand-rolled `replace`. `pkg.replace('/', '%2f')` — the previous
 * implementation — escapes only the FIRST occurrence, because a string (rather than a global regex)
 * first argument replaces once. Every later separator survives into the URL as a real path
 * separator: `'a/../../x'.replace('/', '%2f')` is `'a%2f../../x'`, so the fetch resolves against a
 * different registry endpoint than the caller asked for. That matters here because the values are
 * not all repo-controlled — `--versions` pins arrive from the `workflow_dispatch` input via
 * `CLEANROOM_VERSIONS` — and because a gate that can be steered onto the wrong endpoint is a gate
 * that can be made to report on an artifact nobody installs.
 *
 * The platform primitive escapes every occurrence and every other URL meta-character, and is the
 * encoding the PyPI path in this suite already uses. It is the identity function for ordinary
 * semver, including prereleases.
 */
export function npmEncode(value) { return encodeURIComponent(value); }

/** Install one package from the PUBLIC npm registry into a throwaway directory. */
export function npmCleanRoom(pkgName, version) {
  const room = mkdtempSync(join(tmpdir(), 'wave-cleanroom-npm-'));
  const userConfig = join(room, 'npm-userconfig');
  const globalConfig = join(room, 'npm-globalconfig');
  writeFileSync(userConfig, [
    `registry=${PUBLIC_NPM}/`,
    `@wave-av:registry=${PUBLIC_NPM}/`,
    'audit=false',
    'fund=false',
    'update-notifier=false',
    '',
  ].join('\n'));
  writeFileSync(globalConfig, ''); // npm refuses the same path for user and global config

  const env = {
    ...process.env,
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig,
    npm_config_cache: join(room, 'npm-cache'),
    npm_config_registry: `${PUBLIC_NPM}/`,
    NO_UPDATE_NOTIFIER: '1',
  };

  // Lifecycle scripts stay ENABLED on purpose: a customer's `npm install` runs them, so an
  // artifact whose postinstall breaks is broken in the field and this suite must see it.
  const init = run('npm', ['init', '-y'], { cwd: room, env });
  if (init.status !== 0) return { room, env, install: init, failed: 'npm init failed' };

  const install = run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', `${pkgName}@${version}`], { cwd: room, env });
  return { room, env, install, failed: install.status === 0 ? null : 'npm install failed' };
}

export function installedManifest(room, pkgName) {
  const p = join(room, 'node_modules', ...pkgName.split('/'), 'package.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

export function installedFile(room, pkgName, ...rel) {
  const p = join(room, 'node_modules', ...pkgName.split('/'), ...rel);
  return existsSync(p) ? p : null;
}

/**
 * PEP 440 version ordering, good enough for the plain `MAJOR.MINOR.PATCH[.pre]`-style versions
 * this suite's targets actually publish. Compares numerically, segment by segment, so `2.10.0`
 * sorts after `2.9.0` (a naive string/lexicographic compare would get that backwards). A missing
 * trailing segment is treated as `0` (`2.2` == `2.2.0`). Not a full PEP 440 parser (no epochs, no
 * pre/post/dev-release ordering) — deliberately: a hand-rolled partial semver parser is exactly
 * the kind of "close enough" that hides a real defect, so this stays intentionally narrow and the
 * caller (`latestNonYankedVersion`) falls back to `null` (skip the cross-check) rather than guess
 * on any version string it cannot confidently parse.
 */
export function parsePyVersion(v) {
  const m = /^(\d+(?:\.\d+)*)$/.exec(String(v).trim());
  if (!m) return null;
  return m[1].split('.').map((n) => Number.parseInt(n, 10));
}

export function comparePyVersions(a, b) {
  const pa = parsePyVersion(a);
  const pb = parsePyVersion(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/** True when every file PyPI lists for a release is yanked (PEP 592) — i.e. the release itself
 * is yanked, whether or not `info.yanked` also says so (the per-file flag is authoritative; a
 * release with zero files is not "yanked", it is unpublished/missing and callers handle that
 * separately). */
export function releaseIsYanked(files) {
  return Array.isArray(files) && files.length > 0 && files.every((f) => f?.yanked === true);
}

export function yankReason(versionMeta) {
  const reasons = new Set();
  if (versionMeta?.info?.yanked_reason) reasons.add(versionMeta.info.yanked_reason);
  for (const f of versionMeta?.urls || []) {
    if (f?.yanked && f?.yanked_reason) reasons.add(f.yanked_reason);
  }
  return reasons.size > 0 ? [...reasons].join('; ') : '(no reason given)';
}

/**
 * The version a real, unconstrained `pip install <name>` resolves to: the highest release whose
 * files are NOT all yanked. This is deliberately NOT `projectMeta.info.version` — PyPI keeps
 * `info.version` pointed at the most-recently-published release even after every file in it (and
 * every earlier release) has been yanked (verified live against `pypi.org/pypi/wave-av-sdk/json`
 * on 2026-09-08: `info.version` "3.0.0", `info.yanked` true, releases 2.0.0 and 3.0.0 both fully
 * yanked). Returns `null` when no comparably-parseable non-yanked release exists (all yanked, or
 * every version string is outside the narrow scheme `comparePyVersions` understands) — callers
 * treat `null` as "cannot cross-check", never as "no constraint".
 */
export function latestNonYankedVersion(projectMeta) {
  const releases = projectMeta?.releases || {};
  let best = null;
  for (const [version, files] of Object.entries(releases)) {
    if (releaseIsYanked(files)) continue;
    if (!Array.isArray(files) || files.length === 0) continue; // no files published under this version
    if (parsePyVersion(version) === null) continue;
    if (best === null || comparePyVersions(version, best) > 0) best = version;
  }
  return best;
}
