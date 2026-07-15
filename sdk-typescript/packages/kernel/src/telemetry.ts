/**
 * Telemetry helpers for Kernel browser sessions — the Phase C foundation.
 *
 * Kernel exposes per-category CDP telemetry on `browsers.create`. The
 * operational categories (control / connection / system / captcha) are ON by
 * default whenever telemetry is enabled; the CDP categories (console / network
 * / page / interaction) and `screenshot` are OFF by default and must be opted
 * into. We default WAVE sessions to console + network + page — enough to debug
 * agent runs — and deliberately leave `screenshot` off (high-volume) and never
 * enable capture of credential fields.
 *
 * Typed against the SDK's exported types (`@onkernel/sdk`), so the shape stays
 * in lockstep with the vendored surface.
 */
import type { Kernel } from '@onkernel/sdk';

/** The `telemetry` block accepted by `browsers.create`. */
export type BrowserTelemetry = Kernel.BrowserCreateParams.Telemetry;

/**
 * The SDK's per-category CDP telemetry config. Derived from the create-params
 * telemetry shape — the SDK exports this under the `Browsers` namespace rather
 * than at the `Kernel` root, so we take it from the surface we already type.
 */
export type BrowserTelemetryCategoriesConfig = NonNullable<
  BrowserTelemetry['browser']
>;

/** Params object accepted by `browsers.create`. */
export type BrowserCreateParams = Kernel.BrowserCreateParams;

/**
 * WAVE's default browser telemetry categories: console + network + page ON.
 * `screenshot` is intentionally omitted (off by default — high volume).
 */
export const WAVE_TELEMETRY_DEFAULT: BrowserTelemetryCategoriesConfig = {
  console: { enabled: true },
  network: { enabled: true },
  page: { enabled: true },
};

/**
 * Merge WAVE's telemetry defaults into a `browsers.create` params object.
 *
 * @param createParams The params you would pass to `kernel.browsers.create`.
 * @param categories   Optional category overrides. When omitted,
 *                      {@link WAVE_TELEMETRY_DEFAULT} (console + network + page)
 *                      is used. Provided categories layer onto the SDK default
 *                      operational set server-side.
 * @returns A new params object with `telemetry: { enabled: true, browser }` set.
 *
 * @example
 * ```typescript
 * await kernel.browsers.create(withTelemetry({ headless: true }));
 * ```
 */
export function withTelemetry<T extends BrowserCreateParams>(
  createParams: T,
  categories: BrowserTelemetryCategoriesConfig = WAVE_TELEMETRY_DEFAULT,
): T & { telemetry: BrowserTelemetry } {
  return {
    ...createParams,
    telemetry: {
      enabled: true,
      browser: { ...categories },
    },
  };
}
