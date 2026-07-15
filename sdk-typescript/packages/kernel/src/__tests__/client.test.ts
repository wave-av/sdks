import { describe, it, expect } from 'vitest';
import { WaveKernel } from '../client.js';
import {
  KernelApiError,
  KernelErrorCode,
  CircuitOpenError,
  isKernelApiError,
} from '../errors.js';
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

  it('exposes the full 0.78 resource surface (all 15 resources)', () => {
    const kernel = new WaveKernel({ apiKey: 'test-key' });
    for (const resource of [
      kernel.browsers,
      kernel.invocations,
      kernel.browserPools,
      kernel.profiles,
      kernel.credentials,
      kernel.credentialProviders,
      kernel.apiKeys,
      kernel.projects,
      kernel.auth,
      kernel.proxies,
      kernel.deployments,
      kernel.apps,
      kernel.organization,
      kernel.auditLogs,
      kernel.extensions,
    ]) {
      expect(resource).toBeDefined();
    }
  });

  it('defaults to the api.onkernel.com base URL (never api.kernel.sh)', () => {
    const kernel = new WaveKernel({ apiKey: 'x' });
    expect(kernel.raw.baseURL).toBe('https://api.onkernel.com/');
  });

  it('honors an explicit baseURL override', () => {
    const kernel = new WaveKernel({
      apiKey: 'x',
      baseURL: 'https://kernel.test.internal/',
    });
    expect(kernel.raw.baseURL).toBe('https://kernel.test.internal/');
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

  it('rateLimited() sets code, name, and retryAfterMs context', () => {
    const err = KernelApiError.rateLimited(1500);
    expect(err.code).toBe(KernelErrorCode.RATE_LIMITED);
    expect(err.name).toBe('KernelApiError');
    expect(err.context).toEqual({ retryAfterMs: 1500 });
    expect(isKernelApiError(err)).toBe(true);
  });

  it('sessionNotFound() sets code, name, and sessionId context', () => {
    const err = KernelApiError.sessionNotFound('sess_123');
    expect(err.code).toBe(KernelErrorCode.SESSION_NOT_FOUND);
    expect(err.name).toBe('KernelApiError');
    expect(err.context).toEqual({ sessionId: 'sess_123' });
    expect(isKernelApiError(err)).toBe(true);
  });

  it('poolExhausted() sets code, name, and poolId context', () => {
    const err = KernelApiError.poolExhausted('pool_abc');
    expect(err.code).toBe(KernelErrorCode.POOL_EXHAUSTED);
    expect(err.name).toBe('KernelApiError');
    expect(err.context).toEqual({ poolId: 'pool_abc' });
    expect(isKernelApiError(err)).toBe(true);
  });

  it('circuitOpen() returns a CircuitOpenError with the circuit-open code', () => {
    const err = KernelApiError.circuitOpen('kernel');
    expect(err).toBeInstanceOf(CircuitOpenError);
    expect(err.code).toBe(KernelErrorCode.CIRCUIT_OPEN);
    expect(err.name).toBe('CircuitOpenError');
    expect(err.context).toEqual({ serviceName: 'kernel' });
    expect(isKernelApiError(err)).toBe(true);
  });
});
