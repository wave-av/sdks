/**
 * @wave-av/rdrs — offline ledger verification.
 *
 * `verifyChain` never makes a network call. It is the same check the CLI's `verify-chain`
 * command runs against ledger entries it already fetched — that split (fetch, then verify) is
 * what makes the check reproducible by anyone, not just RDRS's own server.
 *
 * Chain rule: `hash(n) = sha256(hash(n-1) + canonicalRecord(record(n)))`. Genesis
 * (`entries[0]`) has `prev_hash === GENESIS_HASH` (64 zeros).
 *
 * Signature rule (optional): when `publicKeyBase64` is supplied, every entry carrying a
 * `signature` is additionally checked with Ed25519 (WebCrypto) against that key. A chain whose
 * hashes are all internally consistent still fails verification if it was signed by a
 * different key than the caller expects — that is what stops a forged verdict with a
 * self-consistent, freshly-minted ledger from passing as genuine.
 */
import type { LedgerEntry, LedgerVerifyResult } from "./rdrs-types";
import { sha256Hex } from "./client";
export { bytesToHex } from "./client";

export const GENESIS_HASH = "0".repeat(64);

export interface VerifyChainOptions {
  /** Base64-encoded raw (32-byte) Ed25519 public key. When supplied, signed entries are also
   * signature-checked; a wrong key fails those entries even though their hashes are fine. */
  publicKeyBase64?: string;
}

/** Deterministic JSON: object keys sorted (recursively), so the same record always hashes the
 * same way regardless of key insertion order over the wire. */
export function canonicalRecord(record: unknown): string {
  return JSON.stringify(sortKeysDeep(record));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atobPolyfill(b64), (c) => c.charCodeAt(0));
}

function atobPolyfill(b64: string): string {
  if (typeof atob === "function") return atob(b64);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer.from(b64, "base64").toString("binary");
}

async function verifySignature(publicKeyBase64: string, signatureBase64: string, message: string): Promise<boolean> {
  try {
    const keyBytes = base64ToBytes(publicKeyBase64);
    const key = await crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "Ed25519" }, false, ["verify"]);
    const sig = base64ToBytes(signatureBase64);
    const data = new TextEncoder().encode(message);
    return await crypto.subtle.verify("Ed25519", key, sig.buffer as ArrayBuffer, data);
  } catch {
    return false;
  }
}

/**
 * Verifies an append-only ledger chain offline. Returns `{ ok: true, head }` for a good chain,
 * or `{ ok: false, head, bad_index }` naming the FIRST index that fails — a hash mismatch, a
 * broken `prev_hash` link, a non-genesis `entries[0]`, or (when `publicKeyBase64` is given) a
 * signature that does not verify under that key.
 */
export async function verifyChain(entries: LedgerEntry[], options: VerifyChainOptions = {}): Promise<LedgerVerifyResult> {
  if (entries.length === 0) {
    return { ok: true, head: GENESIS_HASH };
  }

  let prevHash = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry === undefined) {
      return { ok: false, head: prevHash, bad_index: i };
    }
    if (entry.index !== i) {
      return { ok: false, head: prevHash, bad_index: i };
    }
    if (entry.prev_hash !== prevHash) {
      return { ok: false, head: prevHash, bad_index: i };
    }

    const computedHash = await sha256Hex(prevHash + canonicalRecord(entry.record));
    if (computedHash !== entry.hash) {
      return { ok: false, head: prevHash, bad_index: i };
    }

    if (options.publicKeyBase64 && entry.signature) {
      const sigOk = await verifySignature(options.publicKeyBase64, entry.signature, canonicalRecord(entry.record));
      if (!sigOk) {
        return { ok: false, head: prevHash, bad_index: i };
      }
    }

    prevHash = entry.hash;
  }

  return { ok: true, head: prevHash };
}
