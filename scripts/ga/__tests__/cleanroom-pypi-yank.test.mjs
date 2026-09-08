// Unit tests for PyPI yank-state handling (PEP 592) in cleanroom-targets.mjs / cleanroom-util.mjs.
//
// WHY THESE TESTS EXIST: workflow run 34208693233 (2026-09-08) installed the YANKED
// wave-av-sdk 3.0.0 by downloading a direct wheel URL from `meta.urls` and running
// `pip install <local-file>` — a path that never asks PyPI's index resolver anything, so yank
// state (PEP 592) never had a chance to bite. `pip install wave-av-sdk` fails for a real user;
// the clean-room gate PASSED. These tests pin the decision logic that fix depends on:
//   1. a non-yanked release is reported installable (positive control, fixture = live wave-sdk)
//   2. a yanked release is reported NOT installable, with the yank reason surfaced (negative
//      control, fixture = live wave-av-sdk — the deliberately retired legacy package, IGV-D-024)
//   3. "latest" resolution cross-checks PyPI's `info.version` against the highest NON-yanked
//      release, because PyPI keeps `info.version` pointed at a release even after every file in
//      it is yanked
//   4. the version comparator sorts numerically, not lexicographically (2.10.0 > 2.9.0)
//
// Fixtures under __tests__/fixtures/*.pypi.json are real (trimmed) captures from
// https://pypi.org/pypi/<name>/json taken 2026-09-08 — no network call happens in this file.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluatePypiYankState } from '../cleanroom-targets.mjs';
import {
  comparePyVersions, latestNonYankedVersion, parsePyVersion, releaseIsYanked, yankReason,
} from '../cleanroom-util.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', name), 'utf8'));

const waveSdk = loadFixture('wave-sdk.pypi.json'); // canonical package, current 2.2.0, not yanked
const waveAvSdk = loadFixture('wave-av-sdk.pypi.json'); // retired legacy package, fully yanked

test('positive control: a non-yanked release (wave-sdk 2.2.0) is installable', () => {
  const result = evaluatePypiYankState({
    name: 'wave-sdk',
    version: '2.2.0',
    resolvedFromPin: false,
    projectMeta: waveSdk,
    versionMeta: waveSdk,
  });
  assert.equal(result.yanked, false);
  assert.equal(result.installable, true);
  const yankCheck = result.checks.find((c) => c.name === 'yank-state');
  assert.ok(yankCheck, 'expected a yank-state check to be produced');
  assert.equal(yankCheck.ok, true);
  // "latest" resolved to 2.2.0, and 2.2.0 IS the highest non-yanked release — no cross-check failure.
  assert.ok(!result.checks.some((c) => c.name === 'latest-is-non-yanked'));
});

test('negative control: a fully-yanked release (wave-av-sdk 3.0.0) is NOT installable, and the reason is surfaced', () => {
  const result = evaluatePypiYankState({
    name: 'wave-av-sdk',
    version: '3.0.0',
    resolvedFromPin: false,
    projectMeta: waveAvSdk,
    versionMeta: waveAvSdk,
  });
  assert.equal(result.yanked, true);
  assert.equal(result.installable, false);
  const yankCheck = result.checks.find((c) => c.name === 'yank-state');
  assert.ok(yankCheck);
  assert.equal(yankCheck.ok, false);
  assert.match(yankCheck.detail, /YANKED/);
  assert.match(yankCheck.detail, /wave-av-sdk==3\.0\.0/);
});

test('an explicit --versions pin skips the "latest is non-yanked" cross-check even if the pin is yanked', () => {
  const result = evaluatePypiYankState({
    name: 'wave-av-sdk',
    version: '3.0.0',
    resolvedFromPin: true, // caller explicitly asked for this exact version
    projectMeta: waveAvSdk,
    versionMeta: waveAvSdk,
  });
  assert.equal(result.installable, false); // still refused — an explicit pin does not override PEP 592
  assert.ok(!result.checks.some((c) => c.name === 'latest-is-non-yanked'));
});

test('"latest" resolution is flagged when info.version points at a yanked release but an earlier release is not yanked', () => {
  // Regression fixture: PyPI's project-level `info.version` stays "3.0.0" even though every file
  // under 3.0.0 (and 2.0.0) is yanked. If a package had one non-yanked release BELOW the yanked
  // "latest", an unconstrained `pip install <name>` would resolve there instead — the gate must
  // say so, not silently accept `info.version`.
  const projectMeta = {
    info: { version: '3.0.0', yanked: true, yanked_reason: null },
    releases: {
      '1.0.0': [{ filename: 'pkg-1.0.0.whl', yanked: false }],
      '3.0.0': [{ filename: 'pkg-3.0.0.whl', yanked: true }],
    },
  };
  const versionMeta = { info: projectMeta.info, urls: projectMeta.releases['3.0.0'] };
  const result = evaluatePypiYankState({
    name: 'pkg', version: '3.0.0', resolvedFromPin: false, projectMeta, versionMeta,
  });
  const crossCheck = result.checks.find((c) => c.name === 'latest-is-non-yanked');
  assert.ok(crossCheck, 'expected a latest-is-non-yanked check when a lower non-yanked release exists');
  assert.equal(crossCheck.ok, false);
  assert.match(crossCheck.detail, /1\.0\.0/);
});

test('a release with zero published files is treated as not-installable, not as "not yanked"', () => {
  const result = evaluatePypiYankState({
    name: 'pkg',
    version: '9.9.9',
    resolvedFromPin: true,
    projectMeta: { info: { version: '9.9.9' }, releases: {} },
    versionMeta: { info: { version: '9.9.9' }, urls: [] },
  });
  assert.equal(result.installable, false);
  assert.equal(result.checks[0].name, 'yank-state');
  assert.equal(result.checks[0].ok, false);
});

test('latestNonYankedVersion skips fully-yanked releases and sorts numerically (2.10.0 > 2.9.0)', () => {
  const projectMeta = {
    releases: {
      '2.9.0': [{ filename: 'a', yanked: false }],
      '2.10.0': [{ filename: 'b', yanked: false }],
      '2.11.0': [{ filename: 'c', yanked: true }], // yanked — must be skipped even though it sorts highest
    },
  };
  assert.equal(latestNonYankedVersion(projectMeta), '2.10.0');
});

test('latestNonYankedVersion returns null when every release is yanked (wave-av-sdk fixture)', () => {
  assert.equal(latestNonYankedVersion(waveAvSdk), null);
});

test('latestNonYankedVersion on the live wave-sdk fixture returns the current release 2.2.0', () => {
  assert.equal(latestNonYankedVersion(waveSdk), '2.2.0');
});

test('comparePyVersions orders numerically, not lexicographically', () => {
  assert.equal(comparePyVersions('2.9.0', '2.10.0'), -1);
  assert.equal(comparePyVersions('2.10.0', '2.9.0'), 1);
  assert.equal(comparePyVersions('2.2.0', '2.2.0'), 0);
  assert.equal(comparePyVersions('2.2', '2.2.0'), 0); // missing trailing segment == 0
});

test('parsePyVersion returns null for scheme it does not confidently understand', () => {
  assert.equal(parsePyVersion('2.2.0rc1'), null);
  assert.deepEqual(parsePyVersion('2.2.0'), [2, 2, 0]);
});

test('releaseIsYanked requires every file to be yanked, and false for an empty file list', () => {
  assert.equal(releaseIsYanked([{ yanked: true }, { yanked: true }]), true);
  assert.equal(releaseIsYanked([{ yanked: true }, { yanked: false }]), false);
  assert.equal(releaseIsYanked([]), false);
});

test('yankReason surfaces a real reason when present, and a fallback when PyPI gives none', () => {
  assert.equal(yankReason(waveAvSdk), '(no reason given)'); // matches the live capture: reason is null
  const withReason = {
    info: { yanked_reason: 'superseded by wave-sdk' },
    urls: [{ yanked: true, yanked_reason: 'superseded by wave-sdk' }],
  };
  assert.equal(yankReason(withReason), 'superseded by wave-sdk');
});
