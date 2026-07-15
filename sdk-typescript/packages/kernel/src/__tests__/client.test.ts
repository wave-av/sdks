import { describe, it, expect } from 'vitest';
import { WaveKernel } from '../client.js';
import { KernelApiError, KernelErrorCode, isKernelApiError } from '../errors.js';
import { withTelemetry, WAVE_TELEMETRY_DEFAULT } from '../telemetry.js';

describe('WaveKernel', () => {
  it('constructs with an explicit apiKey without throwing (no network)', () => {
    expect(() => new WaveKernel({ apiKey: 'test-key' })).not.toThrow();
  });

  it('exposes the SDK resource surface', () => {
    const kernel = new WaveKernel({ apiKey: 'test-key' });
    expect(kernel.browsers).toBeDefined();
    expect(kernel.invocations).toBeDefined();
    expect(kernel.browserPools).toBeDefined();
    expect(kernel.credentials).toBeDefined();
  });
});

describe('withTelemetry', () => {
  it('enables console/network/page and leaves screenshot undefined', () => {
    const params = withTelemetry({});
    expect(params.telemetry.enabled).toBe(true);
    expect(params.telemetry.browser?.console?.enabled).toBe(true);
    expect(params.telemetry.browser?.network?.enabled).toBe(true);
    expect(params.telemetry.browser?.page?.enabled).toBe(true);
    expect(params.telemetry.browser?.screenshot).toBeUndefined();
  });

  it('does not enable screenshot in the default categories', () => {
    expect(WAVE_TELEMETRY_DEFAULT.screenshot).toBeUndefined();
  });
});

describe('KernelApiError', () => {
  it('timeout() sets a code', () => {
    const err = KernelApiError.timeout(30000);
    expect(err.code).toBe(KernelErrorCode.TIMEOUT);
    expect(err.code).toBeTruthy();
    expect(isKernelApiError(err)).toBe(true);
  });
});
