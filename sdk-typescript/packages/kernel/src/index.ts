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

// Resilience seams (slice-2 wiring lands later)
export type {
  ResilienceHooks,
  CircuitBreakerLike,
  SignerLike,
} from './resilience.js';
