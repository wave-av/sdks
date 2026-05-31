import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = join(__dirname, '../dist');
const SRC_DIR = join(__dirname, '../src');

describe('MCP Server Integration', () => {
  it('dist/index.js exists (build output)', () => {
    const content = readFileSync(join(DIST_DIR, 'index.js'), 'utf-8');
    expect(content).toContain('startServer');
  });

  it('exports startServer function', () => {
    const content = readFileSync(join(DIST_DIR, 'index.js'), 'utf-8');
    expect(content).toContain('startServer');
  });

  it('bundles all tool registrations', () => {
    const content = readFileSync(join(DIST_DIR, 'index.js'), 'utf-8');
    const toolNames = [
      'wave_list_streams',
      'wave_create_stream',
      'wave_get_cost',
      'wave_confirm_cost',
      'wave_set_read_only',
      'wave_search_docs',
      'wave_create_config_branch',
      'wave_get_logs',
      'wave_get_stream_tokens',
      'wave_generate_types',
      'wave_start_captions',
      'wave_moderate_chat',
      'wave_create_clip',
      'wave_platform_create_project',
    ];
    for (const tool of toolNames) {
      expect(content).toContain(tool);
    }
  });

  it('server.ts imports all tool modules', () => {
    const server = readFileSync(join(SRC_DIR, 'server.ts'), 'utf-8');
    const expectedImports = [
      'registerStreamTools',
      'registerStudioTools',
      'registerAnalyticsTools',
      'registerBillingTools',
      'registerProductionTools',
      'registerSafetyTools',
      'registerDocsTools',
      'registerConfigBranchTools',
      'registerDiagnosticsTools',
      'registerAuthMgmtTools',
      'registerTypesTools',
      'registerCaptionTools',
      'registerChatTools',
      'registerClipTools',
      'registerPlatformTools',
    ];
    for (const imp of expectedImports) {
      expect(server).toContain(imp);
    }
  });

  it('version is 0.2.0', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
    expect(pkg.version).toBe('0.2.0');
  });

  it('safety-state module exports correctly', () => {
    const content = readFileSync(join(SRC_DIR, 'middleware/safety-state.ts'), 'utf-8');
    expect(content).toContain('export const safetyState');
    expect(content).toContain('isReadOnly');
    expect(content).toContain('addEstimate');
    expect(content).toContain('confirmEstimate');
    expect(content).toContain('requiresConfirmation');
  });
});
