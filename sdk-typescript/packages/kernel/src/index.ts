/**
 * @wave-av/kernel — the ONE shared Kernel cloud-browser client for WAVE.
 *
 * A thin, typed wrapper over `@onkernel/sdk` (api.onkernel.com) with a
 * telemetry-ready surface and clean resilience seams. Every WAVE consumer
 * talks to Kernel through {@link WaveKernel}, never the raw SDK
 * (law: kernel-substrate-governed).
 *
 * @example
 * ```typescript
 * import { WaveKernel, withTelemetry } from '@wave-av/kernel';
 *
 * const kernel = new WaveKernel({ apiKey: process.env.KERNEL_API_KEY });
 * const browser = await kernel.browsers.create(withTelemetry({}));
 * ```
 */

// Client
export {
  WaveKernel,
  DEFAULT_TIMEOUT_MS,
  type WaveKernelConfig,
} from './client.js';

// Errors
export {
  KernelApiError,
  CircuitOpenError,
  KernelErrorCode,
  isKernelApiError,
  type KernelErrorCodeValue,
} from './errors.js';

// Telemetry (also available at the ./telemetry subpath)
export {
  WAVE_TELEMETRY_DEFAULT,
  withTelemetry,
  type BrowserTelemetry,
  type BrowserTelemetryCategoriesConfig,
  type BrowserCreateParams,
} from './telemetry.js';

// Resilience seams (contracts)
export type {
  ResilienceHooks,
  CircuitBreakerLike,
  SignerLike,
  CaptureError,
  CaptureBreadcrumb,
  KernelBreadcrumb,
} from './resilience.js';

// Circuit breaker (opossum-backed, opt-in)
export {
  createCircuitBreaker,
  OpossumCircuitBreaker,
  type CircuitBreakerOptions,
} from './circuit-breaker.js';

// WebBotAuth request signing (RFC-9421 Ed25519, fail-open, opt-in)
export {
  createWebBotAuthSigner,
  WebBotAuthSigner,
  type WebBotAuthConfig,
} from './web-bot-auth.js';
