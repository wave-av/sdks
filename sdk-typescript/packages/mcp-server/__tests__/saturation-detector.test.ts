import { describe, it, expect, vi } from 'vitest';
import {
  SSE_CAP_BYTES,
  WARN_THRESHOLD_BYTES,
  detectSaturation,
  captureSaturationEvent,
  checkAndReportSaturation,
} from '../src/tools/saturation-detector.js';

describe('saturation-detector', () => {
  describe('constants', () => {
    it('SSE_CAP_BYTES is 16 MB (CC 2.1.139 spec)', () => {
      expect(SSE_CAP_BYTES).toBe(16 * 1024 * 1024);
    });

    it('WARN_THRESHOLD_BYTES is 15 MB (94% of cap, 1 MB headroom)', () => {
      expect(WARN_THRESHOLD_BYTES).toBe(15 * 1024 * 1024);
    });
  });

  describe('detectSaturation', () => {
    it('small body — no warn, no truncation, low saturation', () => {
      const m = detectSaturation('query', 'wave-codebase', 'hello world');
      expect(m.bodyBytes).toBe(11);
      expect(m.willWarn).toBe(false);
      expect(m.willTruncate).toBe(false);
      expect(m.saturationPct).toBeLessThan(1);
      expect(m.tool).toBe('query');
      expect(m.server).toBe('wave-codebase');
    });

    it('body just below warn threshold — no warn, no truncation', () => {
      const body = 'a'.repeat(WARN_THRESHOLD_BYTES - 1);
      const m = detectSaturation('query', 'srv', body);
      expect(m.willWarn).toBe(false);
      expect(m.willTruncate).toBe(false);
      expect(m.bodyBytes).toBe(WARN_THRESHOLD_BYTES - 1);
    });

    it('body exactly at warn threshold — warn but no truncation', () => {
      const body = 'a'.repeat(WARN_THRESHOLD_BYTES);
      const m = detectSaturation('query', 'srv', body);
      expect(m.willWarn).toBe(true);
      expect(m.willTruncate).toBe(false);
      expect(m.saturationPct).toBeCloseTo(93.75, 1);
    });

    it('body just below SSE cap — warn, no truncation', () => {
      const body = 'a'.repeat(SSE_CAP_BYTES - 1);
      const m = detectSaturation('query', 'srv', body);
      expect(m.willWarn).toBe(true);
      expect(m.willTruncate).toBe(false);
    });

    it('body at SSE cap — warn AND truncation, saturation 100%', () => {
      const body = 'a'.repeat(SSE_CAP_BYTES);
      const m = detectSaturation('query', 'srv', body);
      expect(m.willWarn).toBe(true);
      expect(m.willTruncate).toBe(true);
      expect(m.saturationPct).toBe(100);
    });

    it('multi-byte UTF-8 — correct byte count', () => {
      // 'é' = 2 UTF-8 bytes; '€' = 3; '𝄞' (musical symbol, surrogate pair) = 4
      const m = detectSaturation('q', 's', 'aé€𝄞');
      // 'a'=1, 'é'=2, '€'=3, '𝄞'=4 → 10 bytes
      expect(m.bodyBytes).toBe(10);
    });

    it('empty body — no warn, no truncation', () => {
      const m = detectSaturation('q', 's', '');
      expect(m.bodyBytes).toBe(0);
      expect(m.willWarn).toBe(false);
      expect(m.willTruncate).toBe(false);
      expect(m.saturationPct).toBe(0);
    });
  });

  describe('captureSaturationEvent', () => {
    it('no-op when willWarn is false', () => {
      const captureMessage = vi.fn();
      const m = detectSaturation('q', 's', 'short');
      captureSaturationEvent(m, { captureMessage });
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it('no-op when sentry is undefined', () => {
      const body = 'a'.repeat(WARN_THRESHOLD_BYTES);
      const m = detectSaturation('q', 's', body);
      // Should not throw
      expect(() => captureSaturationEvent(m)).not.toThrow();
    });

    it('emits warning (not error) when at warn threshold but below SSE cap', () => {
      const captureMessage = vi.fn();
      const body = 'a'.repeat(WARN_THRESHOLD_BYTES);
      const m = detectSaturation('my-tool', 'my-server', body);
      captureSaturationEvent(m, { captureMessage });

      expect(captureMessage).toHaveBeenCalledOnce();
      const [msg, opts] = captureMessage.mock.calls[0]!;
      expect(msg).toContain('my-tool');
      expect(opts.level).toBe('warning');
      expect(opts.tags!['mcp.server']).toBe('my-server');
      expect(opts.tags!['mcp.tool']).toBe('my-tool');
      expect(opts.tags!['mcp.will_truncate']).toBe('false');
      // truncationApplied should be false until the actual SSE cap is hit
      expect(opts.extra!.truncationApplied).toBe(false);
    });

    it('emits error (not warning) when body reaches SSE cap', () => {
      const captureMessage = vi.fn();
      const body = 'a'.repeat(SSE_CAP_BYTES);
      const m = detectSaturation('my-tool', 'my-server', body);
      captureSaturationEvent(m, { captureMessage });

      expect(captureMessage).toHaveBeenCalledOnce();
      const [, opts] = captureMessage.mock.calls[0]!;
      expect(opts.level).toBe('error');
      expect(opts.tags!['mcp.will_truncate']).toBe('true');
      expect(opts.extra!.truncationApplied).toBe(true);
    });

    it('swallows Sentry errors gracefully', () => {
      const captureMessage = vi.fn(() => {
        throw new Error('Sentry down');
      });
      const body = 'a'.repeat(WARN_THRESHOLD_BYTES);
      const m = detectSaturation('q', 's', body);
      expect(() => captureSaturationEvent(m, { captureMessage })).not.toThrow();
    });
  });

  describe('checkAndReportSaturation', () => {
    it('returns metrics and reports in one call', () => {
      const captureMessage = vi.fn();
      const body = 'a'.repeat(WARN_THRESHOLD_BYTES);
      const m = checkAndReportSaturation('t', 's', body, { captureMessage });
      // willTruncate is false at WARN_THRESHOLD_BYTES (15MB) — only true at SSE_CAP_BYTES (16MB)
      // per saturation-detector.ts:66. Resolves CodeRabbit r3249315039.
      expect(m.willTruncate).toBe(false);
      expect(captureMessage).toHaveBeenCalledOnce();
    });
  });
});
