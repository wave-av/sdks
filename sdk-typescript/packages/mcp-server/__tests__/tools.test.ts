import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TOOLS_DIR = join(__dirname, '../src/tools');
const SERVER_FILE = join(__dirname, '../src/server.ts');

const EXPECTED_TOOL_FILES = [
  'streams.ts', 'studio.ts', 'analytics.ts', 'billing.ts', 'production.ts',
  'safety.ts', 'docs.ts', 'config-branch.ts', 'diagnostics.ts',
  'auth-mgmt.ts', 'types-gen.ts', 'captions.ts', 'chat.ts', 'clips.ts',
  'platform.ts',
];

describe('MCP Server Tool Registration', () => {
  it('all tool files exist', () => {
    for (const file of EXPECTED_TOOL_FILES) {
      expect(existsSync(join(TOOLS_DIR, file))).toBe(true);
    }
  });

  it('server.ts imports all tool registrations', () => {
    const server = readFileSync(SERVER_FILE, 'utf-8');
    expect(server).toContain('registerStreamTools');
    expect(server).toContain('registerSafetyTools');
    expect(server).toContain('registerDocsTools');
    expect(server).toContain('registerConfigBranchTools');
    expect(server).toContain('registerDiagnosticsTools');
    expect(server).toContain('registerAuthMgmtTools');
    expect(server).toContain('registerTypesTools');
    expect(server).toContain('registerCaptionTools');
    expect(server).toContain('registerChatTools');
    expect(server).toContain('registerClipTools');
    expect(server).toContain('registerPlatformTools');
  });

  it.each(EXPECTED_TOOL_FILES)('tool file %s exports a register function', (file) => {
    const content = readFileSync(join(TOOLS_DIR, file), 'utf-8');
    expect(content).toMatch(/export function register\w+Tools/);
  });

  it('has 38+ tool definitions across all files', () => {
    let totalTools = 0;
    for (const file of EXPECTED_TOOL_FILES) {
      const content = readFileSync(join(TOOLS_DIR, file), 'utf-8');
      const matches = content.match(/server\.tool\(/g);
      totalTools += matches?.length ?? 0;
    }
    expect(totalTools).toBeGreaterThanOrEqual(44);
  });
});
