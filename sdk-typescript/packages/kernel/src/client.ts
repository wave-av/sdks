/**
 * WAVE shared Kernel cloud-browser client.
 *
 * `WaveKernel` is the ONE Kernel entrypoint for all of WAVE (law:
 * kernel-substrate-governed). Every WAVE consumer — adk, render, and the other
 * product edge homes — talks to Kernel through this single typed wrapper over
 * `@onkernel/sdk`, never the raw SDK. That gives us one place to add telemetry,
 * resilience, and auth without touching callers.
 *
 * Base URL is the SDK default (`https://api.onkernel.com/`); we never point at
 * the legacy `api.kernel.sh` host.
 *
 * @example
 * ```typescript
 * import { WaveKernel } from '@wave-av/kernel';
 *
 * const kernel = new WaveKernel({ apiKey: process.env.KERNEL_API_KEY });
 * const browser = await kernel.browsers.create({});
 * ```
 */
import { Kernel } from '@onkernel/sdk';
import type { ResilienceHooks } from './resilience.js';

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Configuration for {@link WaveKernel}. */
export interface WaveKernelConfig {
  /** Kernel API key. Defaults to `process.env.KERNEL_API_KEY`. */
  apiKey?: string;
  /** Override the API base URL. Defaults to the SDK default (`https://api.onkernel.com/`). */
  baseURL?: string;
  /** Optional project scope applied to all requests. */
  projectID?: string;
  /** Request timeout in milliseconds. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Optional resilience hooks (circuit breaker, signer). Inert in slice 1 —
   * see {@link ResilienceHooks} and `src/resilience.ts`.
   */
  resilience?: ResilienceHooks;
}

/**
 * The single shared WAVE Kernel client. Wraps a private `@onkernel/sdk`
 * {@link Kernel} instance and re-exposes its full 0.78 resource surface as
 * typed passthrough getters so callers never touch the raw SDK.
 */
export class WaveKernel {
  private readonly kernel: Kernel;

  /** Resilience hooks captured at construction (inert in slice 1). */
  readonly resilience?: ResilienceHooks;

  constructor(config: WaveKernelConfig = {}) {
    this.resilience = config.resilience;
    this.kernel = new Kernel({
      apiKey: config.apiKey ?? process.env.KERNEL_API_KEY,
      // Only override baseURL when explicitly provided so the SDK default
      // (https://api.onkernel.com/) is used otherwise.
      ...(config.baseURL !== undefined ? { baseURL: config.baseURL } : {}),
      ...(config.projectID !== undefined ? { projectID: config.projectID } : {}),
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  /** Escape hatch to the underlying SDK client. Prefer the typed getters below. */
  get raw(): Kernel {
    return this.kernel;
  }

  /** Cloud browser sessions: create / retrieve / update / list / curl / loadExtensions. */
  get browsers() {
    return this.kernel.browsers;
  }

  /** App invocations: create / retrieve / update / list / follow. */
  get invocations() {
    return this.kernel.invocations;
  }

  /** Browser pools: create / update / list / delete / acquire / release. */
  get browserPools() {
    return this.kernel.browserPools;
  }

  /** Browser profiles: create / retrieve / update / list / delete. */
  get profiles() {
    return this.kernel.profiles;
  }

  /** Stored credentials: create / retrieve / update / list / delete / totpCode. */
  get credentials() {
    return this.kernel.credentials;
  }

  /** Credential providers: create / retrieve / update / list / delete / listItems / test. */
  get credentialProviders() {
    return this.kernel.credentialProviders;
  }

  /** API key management. */
  get apiKeys() {
    return this.kernel.apiKeys;
  }

  /** Project management. */
  get projects() {
    return this.kernel.projects;
  }

  /** Auth resource. */
  get auth() {
    return this.kernel.auth;
  }

  /** Proxy configuration. */
  get proxies() {
    return this.kernel.proxies;
  }

  /** App deployments. */
  get deployments() {
    return this.kernel.deployments;
  }

  /** Deployed apps. */
  get apps() {
    return this.kernel.apps;
  }

  /** Organization management. */
  get organization() {
    return this.kernel.organization;
  }

  /** Audit logs. */
  get auditLogs() {
    return this.kernel.auditLogs;
  }

  /** Browser extensions: upload / list / delete / download. */
  get extensions() {
    return this.kernel.extensions;
  }
}
