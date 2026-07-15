import { describe, it, expect } from 'vitest';
import {
  createCircuitBreaker,
  OpossumCircuitBreaker,
} from '../circuit-breaker.js';
import { CircuitOpenError, KernelErrorCode } from '../errors.js';
import type { KernelBreadcrumb } from '../resilience.js';

describe('createCircuitBreaker', () => {
  it('returns an OpossumCircuitBreaker', () => {
    expect(createCircuitBreaker()).toBeInstanceOf(OpossumCircuitBreaker);
  });

  it('passes through the action result while closed', async () => {
    const breaker = createCircuitBreaker();
    await expect(breaker.fire(async () => 42)).resolves.toBe(42);
    expect(breaker.opened).toBe(false);
  });

  it('propagates action errors while closed', async () => {
    // High volumeThreshold so a single failure does not trip the breaker.
    const breaker = createCircuitBreaker({ volumeThreshold: 100 });
    await expect(
      breaker.fire(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('opens after failures and rejects fast with CircuitOpenError', async () => {
    const breadcrumbs: KernelBreadcrumb[] = [];
    const breaker = createCircuitBreaker({
      volumeThreshold: 1,
      errorThresholdPercentage: 1,
      resetTimeout: 10_000,
      captureBreadcrumb: (b) => breadcrumbs.push(b),
    });

    await expect(
      breaker.fire(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(breaker.opened).toBe(true);

    const err = await breaker.fire(async () => 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CircuitOpenError);
    expect((err as CircuitOpenError).code).toBe(KernelErrorCode.CIRCUIT_OPEN);

    const open = breadcrumbs.find((b) => b.data?.state === 'open');
    expect(open).toBeDefined();
    expect(open?.category).toBe('kernel');
    expect(open?.level).toBe('warning');
  });

  it('names breadcrumbs and the circuit-open error after serviceName', async () => {
    const breadcrumbs: KernelBreadcrumb[] = [];
    const breaker = createCircuitBreaker({
      serviceName: 'kernel-edge',
      volumeThreshold: 1,
      errorThresholdPercentage: 1,
      captureBreadcrumb: (b) => breadcrumbs.push(b),
    });
    await breaker
      .fire(async () => {
        throw new Error('x');
      })
      .catch(() => undefined);
    const err = await breaker.fire(async () => 1).catch((e: unknown) => e);
    expect((err as CircuitOpenError).context).toEqual({
      serviceName: 'kernel-edge',
    });
    expect(breadcrumbs[0]?.category).toBe('kernel-edge');
  });
});
