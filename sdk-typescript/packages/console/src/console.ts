/**
 * WAVE SDK — Console module
 *
 * Multi-source agentic query surface for customer-side agents. Wraps:
 *   POST /v1/wave-console/query
 *   GET  /v1/wave-console/health
 *
 * Customer agents use this to query their own org's data across 15+
 * vendor sources (Stripe, Sentry, Dash0, PostHog, Mux, LiveKit, Vercel,
 * Twilio, etc.) with one call. The API gates by RBAC — agent's API key
 * must match the org_id passed.
 *
 * @see ADR-0137 WAVE Console architecture
 *
 * @example
 * ```ts
 * import { WaveClient } from '@wave-av/sdk';
 *
 * const wave = new WaveClient({ apiKey: process.env.WAVE_API_KEY });
 * const result = await wave.console.query({
 *   query: 'show recent payment failures',
 *   orgId: '00000000-0000-0000-0000-000000000000',
 * });
 *
 * console.log(result.synthesis);
 * for (const r of result.results) {
 *   console.log(`${r.source}: ${r.row_count} rows in ${r.query_ms}ms`);
 * }
 * ```
 */

import type { WaveClientConfig } from '@wave-av/core';

export interface ConsoleQueryInput {
  /** Natural language query — what you want to know */
  query: string;
  /** Org UUID — must match the API key's org */
  orgId: string;
  /** Time window start (ISO 8601) — defaults to 1h ago */
  since?: string;
  /** Time window end (ISO 8601) — defaults to now */
  until?: string;
  /** Max rows per source — default 100, max 500 */
  limit?: number;
  /** Source-specific filters (e.g. { org_prefix: 'org_abc__' } for LiveKit) */
  filters?: Record<string, unknown>;
}

export interface ConsoleSourceResult<T = unknown> {
  source:
    | 'argus'
    | 'dash0'
    | 'sentry'
    | 'supabase'
    | 'posthog'
    | 'stripe'
    | 'mux'
    | 'linear'
    | 'github'
    | 'slack'
    | 'cloudflare'
    | 'inngest'
    | 'livekit'
    | 'vercel'
    | 'twilio';
  query_translated: string;
  rows: T[];
  row_count: number;
  query_ms: number;
  cost_cents: number;
  meta?: Record<string, unknown>;
}

export interface ConsoleQueryResult {
  query: string;
  sources_queried: string[];
  results: ConsoleSourceResult[];
  synthesis: string;
  total_rows: number;
  total_query_ms: number;
  total_cost_cents: number;
}

export interface ConsoleHealthResult {
  sources: Record<string, { ok: boolean; reason?: string }>;
  summary: {
    healthy: number;
    total: number;
    all_healthy: boolean;
  };
}

/**
 * Console module for the WAVE SDK.
 */
export class ConsoleModule {
  constructor(private readonly config: WaveClientConfig) {}

  /**
   * Run a multi-source query. Returns aggregated rows across vendor sources
   * relevant to the query, plus an LLM-generated synthesis.
   *
   * @example
   * await wave.console.query({ query: 'p95 latency last hour', orgId });
   */
  async query(input: ConsoleQueryInput): Promise<ConsoleQueryResult> {
    const baseUrl = (this.config as { baseUrl?: string }).baseUrl ?? 'https://api.wave.online';
    const apiKey = (this.config as { apiKey?: string }).apiKey;

    if (!apiKey) {
      throw new Error('WAVE_API_KEY required — pass apiKey to WaveClient constructor');
    }

    const body = {
      query: input.query,
      org_id: input.orgId,
      ...(input.since ? { since: input.since } : {}),
      ...(input.until ? { until: input.until } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
      ...(input.filters ? { filters: input.filters } : {}),
    };

    const response = await fetch(`${baseUrl}/v1/wave-console/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Console query failed: HTTP ${response.status} — ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as { data?: ConsoleQueryResult };
    if (!json.data) {
      throw new Error('Console query returned malformed response');
    }
    return json.data;
  }

  /**
   * Health probe across all vendor adapters. Returns per-source ok/reason.
   *
   * @example
   * const health = await wave.console.health();
   * if (!health.summary.all_healthy) console.warn(health.sources);
   */
  async health(): Promise<ConsoleHealthResult> {
    const baseUrl = (this.config as { baseUrl?: string }).baseUrl ?? 'https://api.wave.online';
    const apiKey = (this.config as { apiKey?: string }).apiKey;

    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl}/v1/wave-console/health`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    // 503 is expected when not all sources healthy — still parseable
    if (!response.ok && response.status !== 503) {
      const text = await response.text();
      throw new Error(`Console health failed: HTTP ${response.status} — ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as { data?: ConsoleHealthResult };
    if (!json.data) {
      throw new Error('Console health returned malformed response');
    }
    return json.data;
  }
}

/**
 * Factory used internally by the WaveClient barrel.
 */
export function createConsoleModule(config: WaveClientConfig): ConsoleModule {
  return new ConsoleModule(config);
}
