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
