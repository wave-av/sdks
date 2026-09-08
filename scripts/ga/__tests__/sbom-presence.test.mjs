// Unit tests for scripts/ga/sbom-presence.mjs (SUPPLY-001, cw#4803).
//
// No network call happens in this file — `fetchLatestRelease`/`checkSbomPresence` accept an
// injectable `fetchImpl`, matching this repo's existing test convention (see
// cleanroom-pypi-yank.test.mjs). The "no SBOM asset present" fixture below is not invented: it is
// the real shape of `GET /repos/wave-av/cli/releases/latest` as observed live on 2026-09-08 (asset
// list trimmed to the one `.tgz`) — today, before any sibling repo has shipped an SBOM job, every
// real target legitimately fails this check, which is the negative control this suite requires.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkSbomPresence, fetchLatestRelease, repoFromMetadata } from '../sbom-presence.mjs';

test('repoFromMetadata parses an npm-style repository object (git+https, .git suffix)', () => {
  assert.equal(
    repoFromMetadata({ url: 'git+https://github.com/wave-av/sdk.git', type: 'git', directory: '.' }),
    'wave-av/sdk',
  );
});

test('repoFromMetadata parses a bare PyPI project_urls.Repository string (no .git suffix)', () => {
  assert.equal(repoFromMetadata('https://github.com/wave-av/sdk-python'), 'wave-av/sdk-python');
});

test('repoFromMetadata parses an ssh-style git remote', () => {
  assert.equal(repoFromMetadata('git@github.com:wave-av/cli.git'), 'wave-av/cli');
  assert.equal(repoFromMetadata({ url: 'ssh://git@github.com/wave-av/cli.git' }), 'wave-av/cli');
});

test('repoFromMetadata returns null for a non-GitHub host — never guesses', () => {
  assert.equal(repoFromMetadata('https://gitlab.com/wave-av/sdk.git'), null);
});

test('repoFromMetadata returns null for missing/empty input', () => {
  assert.equal(repoFromMetadata(null), null);
  assert.equal(repoFromMetadata(undefined), null);
  assert.equal(repoFromMetadata({}), null);
  assert.equal(repoFromMetadata(''), null);
});

test('repoFromMetadata rejects owner/repo segments outside GitHub\'s charset (SSRF/path-injection hardening)', () => {
  // A crafted "repository" field cannot smuggle a path traversal or extra segment into the
  // eventual api.github.com request — this is the guard Corridor's plan review asked for.
  assert.equal(repoFromMetadata('https://github.com/wave-av/../../evil'), null);
  assert.equal(repoFromMetadata('https://github.com/wave av/sdk'), null);
});

test('fetchLatestRelease returns notFound:true on a 404 (repo/tag exists but has no release)', async () => {
  const fakeFetch = async (url) => {
    assert.equal(url, 'https://api.github.com/repos/wave-av/adk/releases/latest');
    return { status: 404, ok: false };
  };
  const result = await fetchLatestRelease('wave-av/adk', fakeFetch);
  assert.deepEqual(result, { notFound: true });
});

test('fetchLatestRelease throws on a non-404 error status — never silently treated as "no release"', async () => {
  const fakeFetch = async () => ({ status: 500, ok: false });
  await assert.rejects(() => fetchLatestRelease('wave-av/cli', fakeFetch), /HTTP 500/);
});

test('fetchLatestRelease passes an AbortSignal so a stalled response can be cancelled', async () => {
  let receivedSignal;
  const fakeFetch = async (url, opts) => {
    receivedSignal = opts.signal;
    return { status: 404, ok: false };
  };
  await fetchLatestRelease('wave-av/adk', fakeFetch);
  assert.ok(receivedSignal instanceof AbortSignal, 'expected an AbortSignal to be passed to fetchImpl');
});

test('fetchLatestRelease distinguishes a 403 rate-limit response (x-ratelimit-remaining: 0) from a real error', async () => {
  const fakeFetch = async () => ({
    status: 403,
    ok: false,
    headers: { get: (h) => (h === 'x-ratelimit-remaining' ? '0' : null) },
  });
  const result = await fetchLatestRelease('wave-av/cli', fakeFetch);
  assert.deepEqual(result, { rateLimited: true, status: 403 });
});

test('fetchLatestRelease treats a 429 as rate-limited even without the ratelimit header', async () => {
  const fakeFetch = async () => ({ status: 429, ok: false, headers: { get: () => null } });
  const result = await fetchLatestRelease('wave-av/cli', fakeFetch);
  assert.deepEqual(result, { rateLimited: true, status: 429 });
});

test('fetchLatestRelease treats an ordinary 403 (no ratelimit signal) as a real error, not a rate limit', async () => {
  const fakeFetch = async () => ({ status: 403, ok: false, headers: { get: () => '42' } });
  await assert.rejects(() => fetchLatestRelease('wave-av/cli', fakeFetch), /HTTP 403/);
});

test('checkSbomPresence FAILS with a distinguishable message on a rate-limited lookup — never silently reads as "SBOM missing"', async () => {
  const fakeFetch = async () => ({
    status: 403,
    ok: false,
    headers: { get: (h) => (h === 'x-ratelimit-remaining' ? '0' : null) },
  });
  const result = await checkSbomPresence({
    packageLabel: '@wave-av/cli@1.0.10',
    repoRaw: { url: 'git+https://github.com/wave-av/cli.git' },
    fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /RATE LIMITED/);
  assert.doesNotMatch(result.detail, /NO SBOM asset/);
});

test('checkSbomPresence FAILS (negative control, real shape) when the latest release carries no SBOM asset', async () => {
  // Real shape observed live 2026-09-08: wave-av/cli releases/latest tag v1.0.10 carries only the
  // npm pack tarball — no *.spdx.json / *.cdx.json asset exists yet anywhere in the fleet.
  const fakeFetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({ tag_name: 'v1.0.10', assets: [{ name: 'wave-av-cli-1.0.10.tgz' }] }),
  });
  const result = await checkSbomPresence({
    packageLabel: '@wave-av/cli@1.0.10',
    repoRaw: { url: 'git+https://github.com/wave-av/cli.git' },
    fetchImpl: fakeFetch,
  });
  assert.equal(result.name, 'sbom-presence');
  assert.equal(result.ok, false);
  assert.match(result.detail, /NO SBOM asset/);
});

test('checkSbomPresence FAILS when the repo has zero releases (real shape: wave-av/adk today)', async () => {
  const fakeFetch = async () => ({ status: 404, ok: false });
  const result = await checkSbomPresence({
    packageLabel: '@wave-av/adk@1.0.6',
    repoRaw: { url: 'git+https://github.com/wave-av/adk.git', directory: 'packages/adk' },
    fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /no GitHub Release at all/);
});

test('checkSbomPresence PASSES when the latest release carries a matching SBOM asset (spdx or cdx, case-insensitive)', async () => {
  const fakeFetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      tag_name: 'sdk-v2.1.4',
      assets: [
        { name: 'wave-av-sdk-2.1.4.tgz' },
        { name: 'wave-av-sdk-2.1.4.SPDX.JSON' },
      ],
    }),
  });
  const result = await checkSbomPresence({
    packageLabel: '@wave-av/sdk@2.1.4',
    repoRaw: { url: 'git+https://github.com/wave-av/sdk.git' },
    fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, true);
  assert.match(result.detail, /SPDX\.JSON/);
});

test('checkSbomPresence FAILS, never fabricates a pass, when the package declares no GitHub repository', () => {
  return checkSbomPresence({ packageLabel: 'some-pkg@1.0.0', repoRaw: null }).then((result) => {
    assert.equal(result.ok, false);
    assert.match(result.detail, /declares no GitHub repository/);
  });
});

test('checkSbomPresence FAILS (not skipped) when the GitHub API call itself errors', async () => {
  const fakeFetch = async () => { throw new Error('network unreachable'); };
  const result = await checkSbomPresence({
    packageLabel: '@wave-av/mcp-server@0.3.0',
    repoRaw: { url: 'git+https://github.com/wave-av/mcp-server.git' },
    fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /could not query/);
});
