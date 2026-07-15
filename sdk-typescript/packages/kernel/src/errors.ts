/**
 * Kernel error taxonomy. Mirrors the WSC taxonomy
 * (wave-surfer-connect/src/lib/kernel/client.ts) so consumers can migrate
 * onto the shared client without rewriting error handling.
 */

/** Stable, machine-readable Kernel error codes. */
export const KernelErrorCode = {
  API_ERROR: 'KERNEL_API_ERROR',
  CIRCUIT_OPEN: 'KERNEL_CIRCUIT_OPEN',
  RATE_LIMITED: 'KERNEL_RATE_LIMITED',
  SESSION_NOT_FOUND: 'KERNEL_SESSION_NOT_FOUND',
  POOL_EXHAUSTED: 'KERNEL_POOL_EXHAUSTED',
  TIMEOUT: 'KERNEL_TIMEOUT',
} as const;

export type KernelErrorCodeValue =
  (typeof KernelErrorCode)[keyof typeof KernelErrorCode];

/** Base error for all Kernel client failures. */
export class KernelApiError extends Error {
  /** Machine-readable error code (see {@link KernelErrorCode}). */
  readonly code: string;
  /** Optional structured context for the error. */
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string = KernelErrorCode.API_ERROR,
    context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'KernelApiError';
    this.code = code;
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }

  /** The circuit breaker is open — requests are being shed. */
  static circuitOpen(serviceName = 'kernel'): CircuitOpenError {
    return new CircuitOpenError(
      `Circuit breaker is open for ${serviceName}`,
      { serviceName },
    );
  }

  /** The request was rate limited. */
  static rateLimited(retryAfterMs?: number): KernelApiError {
    const suffix =
      retryAfterMs !== undefined ? ` Retry after ${retryAfterMs}ms` : '';
    return new KernelApiError(
      `Rate limited.${suffix}`,
      KernelErrorCode.RATE_LIMITED,
      retryAfterMs !== undefined ? { retryAfterMs } : {},
    );
  }

  /** The referenced browser session does not exist. */
  static sessionNotFound(sessionId: string): KernelApiError {
    return new KernelApiError(
      `Browser session not found: ${sessionId}`,
      KernelErrorCode.SESSION_NOT_FOUND,
      { sessionId },
    );
  }

  /** The referenced browser pool has no available capacity. */
  static poolExhausted(poolId: string): KernelApiError {
    return new KernelApiError(
      `Browser pool exhausted: ${poolId}`,
      KernelErrorCode.POOL_EXHAUSTED,
      { poolId },
    );
  }

  /** The operation exceeded its time budget. */
  static timeout(durationMs: number): KernelApiError {
    return new KernelApiError(
      `Operation timed out after ${durationMs}ms`,
      KernelErrorCode.TIMEOUT,
      { durationMs },
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}

/** Raised when the circuit breaker is open and requests are shed fast. */
export class CircuitOpenError extends KernelApiError {
  constructor(
    message = 'Circuit breaker is open',
    context: Record<string, unknown> = {},
  ) {
    super(message, KernelErrorCode.CIRCUIT_OPEN, context);
    this.name = 'CircuitOpenError';
  }
}

/** Type guard for {@link KernelApiError} (and its subclasses). */
export function isKernelApiError(error: unknown): error is KernelApiError {
  return error instanceof KernelApiError;
}
