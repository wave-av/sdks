/**
 * Resilience seams — the clean boundaries the WaveKernel constructor accepts.
 *
 * These interfaces let concrete resilience layers (circuit breaker, request
 * signer, observability capture) drop in without changing the public surface.
 * Everything here is optional and inert by default: the client typechecks and
 * runs unchanged when none of it is wired up.
 *
 * Concrete implementations of these seams live alongside this module:
 *   - `createCircuitBreaker` (opossum-backed; errorThresholdPercentage 50,
 *     resetTimeout 30000, rollingCountTimeout 60000, volumeThreshold 5)
 *   - `createWebBotAuthSigner` (RFC-9421 Ed25519 request signing, fail-open)
 * Observability is injected, not imported — see {@link CaptureError} /
 * {@link CaptureBreadcrumb}. This package never hard-depends on any error
 * reporter, so it stays usable from non-framework hosts.
 */

/**
 * A structured breadcrumb describing a resilience event (e.g. a circuit-breaker
 * state transition). The consumer maps this onto its own reporter (Sentry,
 * OpenTelemetry, a logger). Mirrors the breadcrumb shape used by common error
 * reporters without importing one.
 */
export interface KernelBreadcrumb {
  /** Grouping category — always `'kernel'` for signals from this client. */
  category: string;
  /** Human-readable message describing the event. */
  message: string;
  /** Severity of the event. */
  level?: 'info' | 'warning' | 'error';
  /** Optional structured context (e.g. `{ state: 'open' }`). */
  data?: Record<string, unknown>;
}

/**
 * Injected error-capture sink (e.g. wired to `Sentry.captureException`).
 * Implementations SHOULD tag captures with `service: 'kernel'`.
 */
export type CaptureError = (
  error: unknown,
  context?: Record<string, unknown>,
) => void;

/**
 * Injected breadcrumb sink (e.g. wired to `Sentry.addBreadcrumb`). Receives
 * resilience events such as circuit-breaker open/halfOpen/close transitions.
 */
export type CaptureBreadcrumb = (breadcrumb: KernelBreadcrumb) => void;

/**
 * Minimal circuit-breaker contract. Backed by opossum via
 * `createCircuitBreaker` (errorThresholdPercentage 50, resetTimeout 30000,
 * rollingCountTimeout 60000, volumeThreshold 5).
 */
export interface CircuitBreakerLike {
  /** Run `action` through the breaker; rejects fast with a circuit-open error while open. */
  fire<T>(action: () => Promise<T>): Promise<T>;
  /** Whether the breaker is currently open (shedding requests). */
  readonly opened: boolean;
}

/**
 * WebBotAuth (RFC 9421 HTTP Message Signatures) signer contract. Backed by an
 * Ed25519 signer via `createWebBotAuthSigner` that FAILS OPEN — a signing
 * failure must never block a request.
 */
export interface SignerLike {
  /**
   * Produce RFC-9421 signature headers for an outbound request. Implementations
   * MUST fail open (return `{}`) rather than throw on signing failure.
   */
  sign(input: {
    method: string;
    url: string;
    headers: Record<string, string>;
  }): Promise<Record<string, string>>;
}

/**
 * Optional resilience wiring accepted by the WaveKernel constructor. Every
 * field is optional and inert by default — a client constructed without any of
 * these behaves exactly like the plain SDK wrapper.
 */
export interface ResilienceHooks {
  /** Circuit breaker guarding Kernel calls (see `createCircuitBreaker`). */
  breaker?: CircuitBreakerLike;
  /** WebBotAuth request signer, fail-open (see `createWebBotAuthSigner`). */
  signer?: SignerLike;
  /** Capture sink for errors (e.g. Sentry), tagged `service: 'kernel'`. */
  captureError?: CaptureError;
  /** Breadcrumb sink for resilience events (e.g. breaker state transitions). */
  captureBreadcrumb?: CaptureBreadcrumb;
}
