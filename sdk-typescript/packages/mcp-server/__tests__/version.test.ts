import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MCP_SERVER_VERSION, UNKNOWN_VERSION } from '../src/version.js';

const PKG_PATH = join(__dirname, '../package.json');
const PKG_VERSION = (JSON.parse(readFileSync(PKG_PATH, 'utf-8')) as { version: string }).version;
const SERVER_FILE = join(__dirname, '../src/server.ts');

/**
 * VER-001 — @wave-av/mcp-server@0.2.0 reported `serverInfo.version="0.1.0"` because
 * `server.ts` passed a hardcoded string literal to `new McpServer({ version: "0.1.0" })`
 * instead of deriving it from package.json. An MCP client cannot identify the build it
 * connected to when the two disagree (registry clean-room acceptance, GA-2026-09-04).
 *
 * These tests fail if MCP_SERVER_VERSION drifts from package.json, or if a new hardcoded
 * semver-shaped literal is reintroduced into server.ts's `new McpServer({...})` call.
 */
describe('VER-001: MCP server version is a single source of truth', () => {
  it('derives MCP_SERVER_VERSION from package.json', () => {
    expect(MCP_SERVER_VERSION).toBe(PKG_VERSION);
    expect(MCP_SERVER_VERSION).not.toBe(UNKNOWN_VERSION);
  });

  it('never hardcodes a version literal in the McpServer constructor', () => {
    const src = readFileSync(SERVER_FILE, 'utf-8');
    // The bug shipped as literally `version: "0.1.0"`. Match ANY quoted semver-shaped
    // literal passed as `version:` so a different hardcoded value doesn't slip back in.
    const literal = /version:\s*["'`]\d+\.\d+\.\d+["'`]/.exec(src);
    expect(literal, `found a hardcoded version literal in server.ts: ${literal?.[0]}`).toBeNull();
    expect(src).toContain('MCP_SERVER_VERSION');
  });
});
