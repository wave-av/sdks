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
import type { ResilienceHooks, SignerLike } from './resilience.js';

/** A `fetch`-compatible function, as accepted by the underlying SDK. */
type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

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
   * Optional resilience hooks (circuit breaker, request signer, observability
   * capture). Every field is optional and inert by default — see
   * {@link ResilienceHooks}, `createCircuitBreaker`, and `createWebBotAuthSigner`.
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
    const signer = this.resilience?.signer;
    this.kernel = new Kernel({
      apiKey: config.apiKey ?? process.env.KERNEL_API_KEY,
      // Only override baseURL when explicitly provided so the SDK default
      // (https://api.onkernel.com/) is used otherwise.
      ...(config.baseURL !== undefined ? { baseURL: config.baseURL } : {}),
      ...(config.projectID !== undefined ? { projectID: config.projectID } : {}),
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      // Wire the WebBotAuth signer into the SDK's request path only when a
      // signer is configured. Absent = the SDK uses global fetch, unchanged.
      ...(signer ? { fetch: this.buildSigningFetch(signer) } : {}),
    });
  }

  /**
   * Run an SDK action through the configured circuit breaker. When no breaker
   * is wired the action runs directly (behavior unchanged). Errors surfaced by
   * the breaker are reported through the injected `captureError` hook.
   *
   * @example
   * ```typescript
   * const browser = await kernel.run(() => kernel.browsers.create({}));
   * ```
   */
  async run<T>(action: () => Promise<T>): Promise<T> {
    const breaker = this.resilience?.breaker;
    if (!breaker) return action();
    try {
      return await breaker.fire(action);
    } catch (error) {
      this.resilience?.captureError?.(error, { service: 'kernel' });
      throw error;
    }
  }

  /**
   * Build a `fetch` wrapper that adds WebBotAuth signature headers to every
   * outbound SDK request. Fail-open: any signing error is captured and the
   * request proceeds unsigned (the signer itself also fails open).
   */
  private buildSigningFetch(signer: SignerLike): FetchLike {
    return async (input, init) => {
      const headers = new Headers(init?.headers);
      try {
        const method = (init?.method ?? 'GET').toUpperCase();
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const record: Record<string, string> = {};
        headers.forEach((value, key) => {
          record[key] = value;
        });
        const signed = await signer.sign({ method, url, headers: record });
        for (const [key, value] of Object.entries(signed)) {
          headers.set(key, value);
        }
      } catch (error) {
        this.resilience?.captureError?.(error, {
          service: 'kernel',
          component: 'web-bot-auth',
        });
      }
      return globalThis.fetch(input, { ...init, headers });
    };
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
