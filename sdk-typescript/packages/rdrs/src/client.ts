/**
 * @wave-av/rdrs — client
 *
 * RDRS is standalone: unlike every other `@wave-av/*` package it does NOT depend on
 * `@wave-av/core`. It has its own base URL (https://api.rdrs.sh) and its own `rk_test_*` /
 * `rk_live_*` API keys — never a WAVE gateway key.
 */
import type {
  RdrsClientConfig,
  RdrsErrorBody,
  RdrsErrorCode,
  OpenDisputeRequest,
  Dispute,
  EvidenceSubmission,
  EvidenceManifest,
  EvidenceResult,
  VerdictResponse,
  AppealRequest,
  Appeal,
  RemedyRequest,
  Remedy,
  LedgerHead,
  LedgerEntry,
  SellerAttestation,
  PreflightRequest,
  PreflightResult,
} from "./rdrs-types";

export * from "./rdrs-types";

export const DEFAULT_BASE_URL = "https://api.rdrs.sh";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Thrown for every non-2xx RDRS response. `code` maps to the RDRS error-code taxonomy. */
export class RdrsError extends Error {
  readonly code: RdrsErrorCode | string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: RdrsErrorCode | string, status: number, requestId?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RdrsError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

/** sha256 of arbitrary text/bytes, hex-encoded. Uses WebCrypto so the same code runs on Node,
 * browsers, and edge runtimes (Cloudflare Workers) with no dependency. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return bytesToHex(new Uint8Array(digest));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Copies into a fresh ArrayBuffer so a view over a larger buffer never leaks neighboring bytes
 * into the digest. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export class RdrsClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: RdrsClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!this.fetchImpl) {
      throw new Error("@wave-av/rdrs: no fetch implementation available — pass { fetch } explicitly");
    }
  }

  // -- Disputes ----------------------------------------------------------------------------

  async openDispute(params: OpenDisputeRequest): Promise<Dispute> {
    return this.request<Dispute>("POST", "/v1/disputes", params);
  }

  /** Computes a sha256 manifest of the receipt before sending. The server rejects unsigned
   * receipts with `no_signed_receipt`. */
  async attachEvidence(disputeId: string, evidence: EvidenceSubmission): Promise<EvidenceResult> {
    const bytes = typeof evidence.receipt === "string" ? new TextEncoder().encode(evidence.receipt) : evidence.receipt;
    const manifest: EvidenceManifest = {
      sha256: await sha256Hex(bytes),
      size: bytes.byteLength,
      filename: evidence.filename,
      contentType: evidence.contentType,
    };
    const receiptPayload = typeof evidence.receipt === "string" ? evidence.receipt : bytesToHex(evidence.receipt);
    return this.request<EvidenceResult>("POST", `/v1/disputes/${encodeURIComponent(disputeId)}/evidence`, {
      manifest,
      receipt: receiptPayload,
    });
  }

  async getVerdict(disputeId: string): Promise<VerdictResponse> {
    return this.request<VerdictResponse>("GET", `/v1/disputes/${encodeURIComponent(disputeId)}/verdict`);
  }

  async appeal(disputeId: string, params: AppealRequest): Promise<Appeal> {
    return this.request<Appeal>("POST", `/v1/disputes/${encodeURIComponent(disputeId)}/appeal`, params);
  }

  // -- Remedies ------------------------------------------------------------------------------

  /** Runs the four checks (verdict_hash, paid_to, amount, rail) server-side, then appends to
   * the ledger. No hold or escrow — the loser is billed via `rdrs_*` meter events. */
  async submitRemedy(params: RemedyRequest): Promise<Remedy> {
    return this.request<Remedy>("POST", "/v1/remedies", params);
  }

  // -- Ledger --------------------------------------------------------------------------------

  async getLedgerHead(): Promise<LedgerHead> {
    return this.request<LedgerHead>("GET", "/v1/ledger/head");
  }

  async getLedgerEntries(params?: { since?: number; limit?: number }): Promise<LedgerEntry[]> {
    const query = new URLSearchParams();
    if (params?.since !== undefined) query.set("since", String(params.since));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<LedgerEntry[]>("GET", `/v1/ledger/entries${qs ? `?${qs}` : ""}`);
  }

  // -- Sellers (free, public) -----------------------------------------------------------------

  async checkSeller(sellerId: string): Promise<SellerAttestation> {
    return this.request<SellerAttestation>("GET", `/v1/sellers/${encodeURIComponent(sellerId)}/attestation`);
  }

  // -- Preflight -------------------------------------------------------------------------------

  /** R3: writes nothing to the ledger. */
  async preflight(params: PreflightRequest): Promise<PreflightResult> {
    return this.request<PreflightResult>("POST", "/v1/preflight", params);
  }

  // -- transport -------------------------------------------------------------------------------

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (body !== undefined) headers["content-type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      throw errorFromResponse(response.status, payload);
    }
    return payload as T;
  }
}

function errorFromResponse(status: number, payload: unknown): RdrsError {
  const body = payload as Partial<RdrsErrorBody> | string;
  if (body && typeof body === "object" && "error" in body && body.error) {
    const err = body.error;
    return new RdrsError(err.message ?? `RDRS request failed (${status})`, err.code ?? "internal_error", status, body.request_id, err.details);
  }
  const message = typeof body === "string" && body.length > 0 ? body : `RDRS request failed (${status})`;
  return new RdrsError(message, "internal_error", status);
}

export function createRdrsClient(config?: RdrsClientConfig): RdrsClient {
  return new RdrsClient(config);
}
