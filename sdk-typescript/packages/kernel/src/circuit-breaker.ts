/**
 * Circuit breaker for Kernel calls — concrete impl of the {@link CircuitBreakerLike}
 * seam, backed by opossum.
 *
 * The breaker is OPT-IN: construct one and inject it via `resilience.breaker`.
 * When absent, the client behaves exactly like the plain SDK wrapper.
 *
 * Params mirror WAVE's prior internal Kernel client:
 *   errorThresholdPercentage 50 · resetTimeout 30000 · rollingCountTimeout
 *   60000 · volumeThreshold 5.
 *
 * On open / halfOpen / close the breaker emits a breadcrumb through the
 * INJECTED {@link CaptureBreadcrumb} hook — never a hard error-reporter import —
 * so this stays framework-agnostic (usable from non-Next hosts).
 */
import CircuitBreaker from 'opossum';
import { KernelApiError, type CircuitOpenError } from './errors.js';
import type { CaptureBreadcrumb, CircuitBreakerLike } from './resilience.js';

/** Options for {@link createCircuitBreaker}. Defaults match the WAVE reference. */
export interface CircuitBreakerOptions {
  /** Failure percentage that trips the breaker. Default 50. */
  errorThresholdPercentage?: number;
  /** Time (ms) the breaker stays open before a trial (half-open) call. Default 30000. */
  resetTimeout?: number;
  /** Rolling statistics window (ms) for failure counting. Default 60000. */
  rollingCountTimeout?: number;
  /** Minimum requests in the window before the breaker can trip. Default 5. */
  volumeThreshold?: number;
  /**
   * Per-call timeout (ms) enforced by the breaker, or `false` to disable.
   * Defaults to `false` — the underlying SDK already owns request timeouts, so
   * the breaker does not impose a second one unless asked.
   */
  timeoutMs?: number | false;
  /** Service name used in breadcrumbs and the circuit-open error. Default `'kernel'`. */
  serviceName?: string;
  /** Injected sink for open/halfOpen/close breadcrumbs. */
  captureBreadcrumb?: CaptureBreadcrumb;
}

/** opossum's rejection code when a call is shed because the circuit is open. */
const OPEN_BREAKER_CODE = 'EOPENBREAKER';

function isOpenBreakerError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === OPEN_BREAKER_CODE
  );
}

/**
 * opossum-backed {@link CircuitBreakerLike}. A single breaker guards the whole
 * Kernel call path: every action runs through one shared rolling window, so
 * failures across different SDK calls trip the breaker together.
 */
export class OpossumCircuitBreaker implements CircuitBreakerLike {
  private readonly breaker: CircuitBreaker<[() => Promise<unknown>], unknown>;
  private readonly serviceName: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.serviceName = options.serviceName ?? 'kernel';

    this.breaker = new CircuitBreaker(
      (action: () => Promise<unknown>) => action(),
      {
        errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
        resetTimeout: options.resetTimeout ?? 30_000,
        rollingCountTimeout: options.rollingCountTimeout ?? 60_000,
        volumeThreshold: options.volumeThreshold ?? 5,
        timeout: options.timeoutMs ?? false,
        name: this.serviceName,
      },
    );

    const breadcrumb = options.captureBreadcrumb;
    if (breadcrumb) {
      this.breaker.on('open', () =>
        breadcrumb({
          category: this.serviceName,
          message: 'Circuit breaker opened',
          level: 'warning',
          data: { state: 'open' },
        }),
      );
      this.breaker.on('halfOpen', () =>
        breadcrumb({
          category: this.serviceName,
          message: 'Circuit breaker half-open',
          level: 'info',
          data: { state: 'halfOpen' },
        }),
      );
      this.breaker.on('close', () =>
        breadcrumb({
          category: this.serviceName,
          message: 'Circuit breaker closed',
          level: 'info',
          data: { state: 'close' },
        }),
      );
    }
  }

  /** Whether the breaker is currently open (shedding requests). */
  get opened(): boolean {
    return this.breaker.opened;
  }

  /**
   * Run `action` through the breaker. While open it rejects fast with a
   * {@link CircuitOpenError} rather than opossum's internal open-breaker error.
   */
  async fire<T>(action: () => Promise<T>): Promise<T> {
    try {
      return (await this.breaker.fire(action)) as T;
    } catch (error) {
      if (isOpenBreakerError(error)) {
        throw KernelApiError.circuitOpen(this.serviceName) as CircuitOpenError;
      }
      throw error;
    }
  }
}

/**
 * Build an opossum-backed circuit breaker implementing {@link CircuitBreakerLike}.
 * Inject the result via `new WaveKernel({ resilience: { breaker } })`.
 *
 * @example
 * ```typescript
 * const breaker = createCircuitBreaker({
 *   captureBreadcrumb: (b) => Sentry.addBreadcrumb(b),
 * });
 * const kernel = new WaveKernel({ apiKey, resilience: { breaker } });
 * await kernel.run(() => kernel.browsers.create({}));
 * ```
 */
export function createCircuitBreaker(
  options: CircuitBreakerOptions = {},
): CircuitBreakerLike {
  return new OpossumCircuitBreaker(options);
}
