/**
 * Resilience seams — SLICE 1 provides interfaces only, no implementation.
 *
 * These are the clean boundaries the WaveKernel constructor accepts so that
 * slice 2 can drop in the real circuit breaker + signing without changing the
 * public surface. Everything here is optional and inert in slice 1: the client
 * typechecks and runs without any of it wired up.
 *
 * TODO(slice-2): port from wave-surfer-connect —
 *   - opossum circuit breaker (errorThresholdPercentage: 50, resetTimeout:
 *     30000, volumeThreshold: 5) from src/lib/kernel/client.ts
 *   - Sentry capture (tags: { service: 'kernel' }) from src/lib/kernel/client.ts
 *   - WebBotAuth Ed25519 request signing (RFC 9421, fail-open) from
 *     src/lib/kernel/web-bot-auth.ts
 */

/**
 * Minimal circuit-breaker contract. Slice 2 will back this with opossum
 * (errorThresholdPercentage: 50, resetTimeout: 30000, volumeThreshold: 5).
 */
export interface CircuitBreakerLike {
  /** Run `action` through the breaker; rejects fast with a circuit-open error while open. */
  fire<T>(action: () => Promise<T>): Promise<T>;
  /** Whether the breaker is currently open (shedding requests). */
  readonly opened: boolean;
}

/**
 * WebBotAuth (RFC 9421 HTTP Message Signatures) signer contract. Slice 2 will
 * back this with an Ed25519 signer that FAILS OPEN — a signing failure must
 * never block a request.
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
 * Optional resilience wiring accepted by the WaveKernel constructor. Inert in
 * slice 1; every field is optional.
 */
export interface ResilienceHooks {
  /** Circuit breaker guarding Kernel calls. */
  breaker?: CircuitBreakerLike;
  /** WebBotAuth request signer (fail-open). */
  signer?: SignerLike;
  /** Capture sink for errors (e.g. Sentry), tagged `service: 'kernel'` in slice 2. */
  captureError?: (error: unknown, context?: Record<string, unknown>) => void;
}
