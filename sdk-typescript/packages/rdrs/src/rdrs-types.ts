/**
 * @wave-av/rdrs — type definitions.
 *
 * PROVENANCE: RDRS (api.rdrs.sh) is not live yet (see README "Status"). These types are
 * hand-authored against the v1 contract documented for this package's build task — they are
 * NOT machine-generated. Once `wave-av/rdrs` publishes `openapi.yaml`, regenerate this file
 * from the pinned SHA and vendor the spec (per the carve convention used by every other
 * `@wave-av/*` package: a vendored copy of the source-of-truth plus its SHA in a header).
 * Until then, treat this file as the typed doc of the contract, not a generated artifact.
 */

/** Every RDRS response carries this — RDRS never takes custody of funds. */
export type Custody = "none";

// ---------------------------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------------------------

/**
 * Stable RDRS error codes. `no_signed_receipt` and `cannot_decide_yet` are named explicitly in
 * the v1 contract; the remaining `invalid_*` codes are the four `POST /remedies` checks
 * (verdict_hash, paid_to, amount, rail) reported individually so a client can tell which one
 * failed.
 */
export const RDRS_ERROR_CODES = [
  "no_signed_receipt",
  "cannot_decide_yet",
  "dispute_not_found",
  "seller_not_found",
  "invalid_verdict_hash",
  "invalid_paid_to",
  "invalid_amount",
  "invalid_rail",
  "already_appealed",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "validation_error",
  "internal_error",
] as const;

export type RdrsErrorCode = (typeof RDRS_ERROR_CODES)[number];

export interface RdrsErrorBody {
  error: {
    code: RdrsErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  };
  request_id?: string;
}

// ---------------------------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------------------------

export interface RdrsClientConfig {
  /** `rk_test_...` / `rk_live_...`. Omit for the public, unauthenticated endpoints. */
  apiKey?: string;
  /** Default: https://api.rdrs.sh */
  baseUrl?: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Default: 30000 */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------------------------

export type DisputeStatus =
  | "open"
  | "evidence_pending"
  | "under_review"
  | "decided"
  | "appealed"
  | "closed";

export interface OpenDisputeRequest {
  seller: string;
  order: string;
  claim: string;
  /** Rush review lane ($49). */
  rush?: boolean;
}

export interface Dispute {
  id: string;
  seller: string;
  order: string;
  claim: string;
  status: DisputeStatus;
  rush: boolean;
  custody: Custody;
  created_at: string;
}

// ---------------------------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------------------------

export interface EvidenceSubmission {
  /** The signed receipt payload — a JWS/JSON string or raw bytes. */
  receipt: string | Uint8Array;
  filename?: string;
  contentType?: string;
}

export interface EvidenceManifest {
  sha256: string;
  size: number;
  filename?: string;
  contentType?: string;
}

export type EvidenceStatus = "accepted" | "rejected";

export interface EvidenceResult {
  id: string;
  dispute_id: string;
  manifest: EvidenceManifest;
  status: EvidenceStatus;
  custody: Custody;
}

// ---------------------------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------------------------

export type VerdictDecision = "favor_claimant" | "favor_respondent" | "split";

/** An Ed25519-signed verdict. `verdict_hash` is sha256 of the canonical decision payload. */
export interface Verdict {
  status: "decided";
  dispute_id: string;
  verdict_hash: string;
  decision: VerdictDecision;
  amount?: number;
  currency?: string;
  rationale?: string;
  /** Ed25519 signature over `verdict_hash`, base64. */
  signature: string;
  /** Ed25519 public key that produced `signature`, base64 (SPKI or raw 32-byte key, base64). */
  signer_public_key: string;
  decided_at: string;
  custody: Custody;
}

export interface CannotDecideYet {
  status: "cannot_decide_yet";
  dispute_id: string;
}

export type VerdictResponse = Verdict | CannotDecideYet;

// ---------------------------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------------------------

export type AppealStatus = "pending" | "granted" | "denied";

export interface AppealRequest {
  reason: string;
}

export interface Appeal {
  id: string;
  dispute_id: string;
  reason: string;
  status: AppealStatus;
  custody: Custody;
  created_at: string;
}

// ---------------------------------------------------------------------------------------------
// Remedies
// ---------------------------------------------------------------------------------------------

export type RemedyRail = "ach" | "wire" | "card" | "stripe" | "crypto";

export interface RemedyRequest {
  dispute_id: string;
  verdict_hash: string;
  paid_to: string;
  amount: number;
  rail: RemedyRail;
}

export interface RemedyChecks {
  verdict_hash: boolean;
  paid_to: boolean;
  amount: boolean;
  rail: boolean;
}

export interface Remedy {
  id: string;
  dispute_id: string;
  verdict_hash: string;
  paid_to: string;
  amount: number;
  rail: RemedyRail;
  checks: RemedyChecks;
  ledger_entry_index: number;
  ledger_hash: string;
  custody: Custody;
  created_at: string;
}

// ---------------------------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------------------------

export interface LedgerHead {
  head: string;
  index: number;
}

/**
 * One append-only ledger entry. `hash = sha256(prev_hash + canonicalRecord(record))`, genesis
 * (`index === 0`) has `prev_hash === "0".repeat(64)`. `signature`/`public_key` are present only
 * on entries that carry a signed verdict.
 */
export interface LedgerEntry {
  index: number;
  prev_hash: string;
  hash: string;
  record: Record<string, unknown>;
  timestamp: string;
  signature?: string;
  public_key?: string;
}

export interface LedgerVerifyResult {
  ok: boolean;
  head: string;
  /** Index of the first entry that fails to verify, when `ok` is false. */
  bad_index?: number;
}

// ---------------------------------------------------------------------------------------------
// Sellers
// ---------------------------------------------------------------------------------------------

export type SellerAttestationStatus = "clean" | "disputed" | "flagged";

export interface SellerAttestation {
  seller_id: string;
  status: SellerAttestationStatus;
  open_disputes: number;
  resolved_disputes: number;
  custody: Custody;
  as_of: string;
}

// ---------------------------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------------------------

export interface PreflightRequest {
  seller: string;
  order: string;
  claim?: string;
}

export interface PreflightPanelResult {
  panel: string;
  passed: boolean;
  detail?: string;
}

export interface PreflightResult {
  seller: string;
  risk_tier: string;
  panels: PreflightPanelResult[];
  writes_to_ledger: false;
  custody: Custody;
}
