import { describe, it, expect } from 'vitest';
import { normalizeGatewayPath } from '../src/tools/gateway.js';

describe('normalizeGatewayPath (SSRF / host-escape guard)', () => {
  it('accepts the /v1 root and /v1/* paths', () => {
    expect(normalizeGatewayPath('/v1')).toBe('/v1');
    expect(normalizeGatewayPath('/v1/streams')).toBe('/v1/streams');
    expect(normalizeGatewayPath('/v1/clips/abc-123')).toBe('/v1/clips/abc-123');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeGatewayPath('  /v1/streams  ')).toBe('/v1/streams');
  });

  it('rejects empty / missing paths', () => {
    expect(() => normalizeGatewayPath('')).toThrow(/required/);
    expect(() => normalizeGatewayPath('   ')).toThrow(/required/);
  });

  it('rejects absolute URLs (host escape)', () => {
    expect(() => normalizeGatewayPath('https://evil.example/v1/x')).toThrow(/start with "\/"/);
    expect(() => normalizeGatewayPath('/v1/x://y')).toThrow(/absolute URL/);
  });

  it('rejects protocol-relative //host paths', () => {
    expect(() => normalizeGatewayPath('//evil.example/v1')).toThrow(/\/\//);
  });

  it('rejects paths that escape the /v1 gateway mount', () => {
    expect(() => normalizeGatewayPath('/internal/admin')).toThrow(/\/v1 surface/);
    expect(() => normalizeGatewayPath('/v2/streams')).toThrow(/\/v1 surface/);
    expect(() => normalizeGatewayPath('/v1abc')).toThrow(/\/v1 surface/);
  });
});
