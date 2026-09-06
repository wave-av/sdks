/**
 * WAVE SDK — Control-plane module
 *
 * Typed methods for the console-management surfaces the console pages drive
 * (rendering-completeness-epic P2): review, insights, pricing, identity,
 * custody, audit, members, mail, engine, gpu.
 *
 * Shapes are derived from the gateway handlers (probed live 2026-08-25/26 —
 * see FLEET-OPEN-WORK.md receipts), never assumed. Surfaces that are
 * operator-plane (custody writes, audit reads, identity directory) still get
 * typed methods: a customer key without the operator scope gets the gateway's
 * own 401/403 surfaced, which IS the honest contract.
 */

import type { WaveClientConfig } from '@wave-av/core';

const API = 'https://api.wave.online';
const REVIEW_API = 'https://review.wave.online';

export class ControlPlaneError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ControlPlaneError';
    this.status = status;
  }
}

async function call(
  config: WaveClientConfig,
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const apiKey = (config as { apiKey?: string }).apiKey;
  if (!apiKey) throw new ControlPlaneError('WAVE_API_KEY required — pass apiKey to the client', 0);
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = (body.error as { code?: string; message?: string })?.message ?? JSON.stringify(body).slice(0, 200);
    throw new ControlPlaneError(`HTTP ${res.status} — ${detail}`, res.status);
  }
  return body;
}

/* ── shapes (from the gateway handlers) ─────────────────────────────── */

export interface ReviewUsage {
  today?: { reviews?: number; limit?: number };
}
export interface ReviewRunResult {
  results?: Array<{ reviewer?: string; [field: string]: unknown }>;
  [field: string]: unknown;
}

export interface InsightsResult {
  org?: string;
  window_days: number;
  generatedAt: string;
  total_events?: number;
  by_category?: Array<{ key?: string; count?: number; [f: string]: unknown }>;
  by_spoke?: Array<Record<string, unknown>>;
  by_product?: Array<Record<string, unknown>>;
}
export interface TrendsResult {
  dimension?: string;
  window_days: number;
  generatedAt: string;
  k_anonymity?: { min_orgs?: number; max_dominance?: number; min_events?: number };
  trends: unknown[];
}

export interface PricingManifest {
  [field: string]: unknown;
}

export interface IdentityResolveResult {
  [field: string]: unknown;
}

export interface AuditEvent {
  [field: string]: unknown;
}
export interface AuditResult {
  rows?: AuditEvent[];
  [field: string]: unknown;
}

export interface MailTimelineResult {
  [field: string]: unknown;
}

export interface EngineCapabilities {
  [field: string]: unknown;
}

export interface GpuResult {
  [field: string]: unknown;
}

/* ── module ─────────────────────────────────────────────────────────── */

export class ControlPlaneModule {
  constructor(private readonly config: WaveClientConfig) {}

  /** Run an orchestrated multi-adapter code review (review plane; separate API). */
  async review(repo: string): Promise<ReviewRunResult> {
    return (await call(this.config, `${REVIEW_API}/v1/review`, { method: 'POST', body: { repo } })) as ReviewRunResult;
  }

  /** Review-plane usage for this tenant (reviews today vs the daily limit). */
  async reviewUsage(): Promise<ReviewUsage> {
    return (await call(this.config, `${REVIEW_API}/v1/tenant/usage`)) as ReviewUsage;
  }

  /** Org-scoped facet rollups (insights:read). */
  async insights(): Promise<InsightsResult> {
    return (await call(this.config, `${API}/v1/insights`)) as InsightsResult;
  }

  /** k-anonymized usage trends (insights:read). */
  async trends(): Promise<TrendsResult> {
    return (await call(this.config, `${API}/v1/insights/trends`)) as TrendsResult;
  }

  /** Seller-facing pricing tier manifests (pricing:read). */
  async pricingManifests(): Promise<PricingManifest[]> {
    const body = (await call(this.config, `${API}/v1/pricing/manifests`)) as unknown;
    if (Array.isArray(body)) return body as PricingManifest[];
    const wrapped = body as { manifests?: PricingManifest[] };
    return wrapped.manifests ?? [];
  }

  /** Resolve a fleet agent identity (directory:read — operator-plane). */
  async identityResolve(identifier: string): Promise<IdentityResolveResult> {
    return (await call(this.config, `${API}/v1/identity/resolve`, { method: 'POST', body: { identifier } })) as IdentityResolveResult;
  }

  /** Custody operations (custody:write — operator-plane). */
  async custody(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await call(this.config, `${API}/v1/custody`, { method: 'POST', body })) as Record<string, unknown>;
  }

  /** The org's audit-event trail (audit:read — operator-plane). */
  async audit(from?: string, to?: string): Promise<AuditResult> {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return (await call(this.config, `${API}/v1/audit${qs ? `?${qs}` : ''}`)) as AuditResult;
  }

  /** The org's mail event timeline (mail plane). */
  async mailTimeline(): Promise<MailTimelineResult> {
    return (await call(this.config, `${API}/v1/mail/timeline`)) as MailTimelineResult;
  }

  /** The media-engine capability contract. */
  async engineCapabilities(): Promise<EngineCapabilities> {
    return (await call(this.config, `${API}/v1/engine/capabilities`)) as EngineCapabilities;
  }

  /** GPU render-rail status (mesh:gpu). */
  async gpu(): Promise<GpuResult> {
    return (await call(this.config, `${API}/v1/gpu`)) as GpuResult;
  }
}

export function createControlPlaneModule(config: WaveClientConfig): ControlPlaneModule {
  return new ControlPlaneModule(config);
}
