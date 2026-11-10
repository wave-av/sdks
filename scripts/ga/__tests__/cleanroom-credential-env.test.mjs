// Unit tests for clean-room child-process env isolation.
//
// The registry clean-room suite enables npm/pip lifecycle scripts on purpose (a
// customer install runs them). Those children must not inherit the workflow
// token that registry-cleanroom.yml sets for GitHub Releases API rate limits.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanRoomChildEnv, scrubRunnerCredentials } from '../cleanroom-util.mjs';

test('scrubRunnerCredentials drops runner credential names and keeps PATH', () => {
  const out = scrubRunnerCredentials({
    PATH: '/usr/bin',
    HOME: '/tmp',
    GITHUB_TOKEN: 'not-a-credential',
    GH_TOKEN: 'not-a-credential',
    GH_PAT: 'not-a-credential',
    NODE_AUTH_TOKEN: 'not-a-credential',
    NPM_TOKEN: 'not-a-credential',
    ACTIONS_RUNTIME_TOKEN: 'not-a-credential',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'not-a-credential',
    npm_config__auth: 'not-a-credential',
    'npm_config_//registry.npmjs.org/:_authToken': 'not-a-credential',
    CLEANROOM_VERSIONS: '@wave-av/sdk=1.0.0',
  });
  assert.equal(out.PATH, '/usr/bin');
  assert.equal(out.HOME, '/tmp');
  assert.equal(out.CLEANROOM_VERSIONS, '@wave-av/sdk=1.0.0');
  assert.equal(out.GITHUB_TOKEN, undefined);
  assert.equal(out.GH_TOKEN, undefined);
  assert.equal(out.GH_PAT, undefined);
  assert.equal(out.NODE_AUTH_TOKEN, undefined);
  assert.equal(out.NPM_TOKEN, undefined);
  assert.equal(out.ACTIONS_RUNTIME_TOKEN, undefined);
  assert.equal(out.ACTIONS_ID_TOKEN_REQUEST_TOKEN, undefined);
  assert.equal(out.npm_config__auth, undefined);
  assert.equal(out['npm_config_//registry.npmjs.org/:_authToken'], undefined);
});

test('cleanRoomChildEnv does not forward GITHUB_TOKEN from process.env', () => {
  const prev = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'not-a-credential';
  try {
    const env = cleanRoomChildEnv({ npm_config_registry: 'https://registry.npmjs.org/' });
    assert.equal(env.GITHUB_TOKEN, undefined);
    assert.equal(env.npm_config_registry, 'https://registry.npmjs.org/');
  } finally {
    if (prev === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prev;
  }
});
