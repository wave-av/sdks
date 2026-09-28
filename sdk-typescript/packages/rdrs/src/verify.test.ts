import { describe, it, expect } from "vitest";
import { sha256Hex, bytesToHex } from "./client";
import { verifyChain, canonicalRecord, GENESIS_HASH } from "./verify";
import type { LedgerEntry } from "./rdrs-types";

async function buildChain(records: Record<string, unknown>[]): Promise<LedgerEntry[]> {
  const entries: LedgerEntry[] = [];
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const hash = await sha256Hex(prevHash + canonicalRecord(record));
    entries.push({ index: i, prev_hash: prevHash, hash, record, timestamp: new Date(2026, 0, i + 1).toISOString() });
    prevHash = hash;
  }
  return entries;
}

function b64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64");
}

describe("canonicalRecord", () => {
  it("is key-order independent", () => {
    expect(canonicalRecord({ b: 1, a: 2 })).toBe(canonicalRecord({ a: 2, b: 1 }));
  });

  it("is not value independent", () => {
    expect(canonicalRecord({ a: 1 })).not.toBe(canonicalRecord({ a: 2 }));
  });
});

describe("verifyChain", () => {
  it("passes an empty chain (genesis, nothing appended yet)", async () => {
    const result = await verifyChain([]);
    expect(result).toEqual({ ok: true, head: GENESIS_HASH });
  });

  it("passes a good chain and reports the real head", async () => {
    const entries = await buildChain([{ kind: "dispute_opened", id: "d_1" }, { kind: "remedy", id: "r_1" }, { kind: "remedy", id: "r_2" }]);
    const result = await verifyChain(entries);
    expect(result.ok).toBe(true);
    expect(result.head).toBe(entries[2]!.hash);
    expect(result.bad_index).toBeUndefined();
  });

  it("rejects a chain whose genesis prev_hash is not 64 zeros", async () => {
    const entries = await buildChain([{ kind: "dispute_opened" }]);
    entries[0]!.prev_hash = "1".repeat(64);
    const result = await verifyChain(entries);
    expect(result.ok).toBe(false);
    expect(result.bad_index).toBe(0);
  });

  it("fails at the tampered index when a record is edited after the fact", async () => {
    const entries = await buildChain([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    // Tamper entry 2's record without recomputing its hash or the downstream chain.
    entries[2]!.record = { id: "TAMPERED" };
    const result = await verifyChain(entries);
    expect(result.ok).toBe(false);
    expect(result.bad_index).toBe(2);
  });

  it("fails at the tampered index when a hash is rewritten to a plausible-looking value", async () => {
    const entries = await buildChain([{ id: "a" }, { id: "b" }, { id: "c" }]);
    entries[1]!.hash = "f".repeat(64);
    entries[2]!.prev_hash = "f".repeat(64); // rewritten downstream link, still self-consistent
    const result = await verifyChain(entries);
    expect(result.ok).toBe(false);
    // index 1 is the first entry whose claimed hash does not match sha256(prev+record)
    expect(result.bad_index).toBe(1);
  });

  it("verifies a signed entry against the right Ed25519 public key", async () => {
    const kp = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const publicKeyBase64 = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
    const entries = await buildChain([{ kind: "verdict", verdict_hash: "abc" }]);
    const message = canonicalRecord(entries[0]!.record);
    const sig = await crypto.subtle.sign("Ed25519", kp.privateKey, new TextEncoder().encode(message));
    entries[0]!.signature = b64(sig);

    const result = await verifyChain(entries, { publicKeyBase64 });
    expect(result.ok).toBe(true);
  });

  it("fails a signed entry when checked against the WRONG Ed25519 public key", async () => {
    const signingKey = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const wrongKey = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const wrongPublicKeyBase64 = b64(await crypto.subtle.exportKey("raw", wrongKey.publicKey));

    const entries = await buildChain([{ kind: "verdict", verdict_hash: "abc" }]);
    const message = canonicalRecord(entries[0]!.record);
    const sig = await crypto.subtle.sign("Ed25519", signingKey.privateKey, new TextEncoder().encode(message));
    entries[0]!.signature = b64(sig);

    // Hashes are all internally consistent — only the signature check should catch this.
    const result = await verifyChain(entries, { publicKeyBase64: wrongPublicKeyBase64 });
    expect(result.ok).toBe(false);
    expect(result.bad_index).toBe(0);
  });
});

describe("sha256Hex / bytesToHex", () => {
  it("matches a known sha256 vector", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hex-encodes bytes lowercase, zero-padded", () => {
    expect(bytesToHex(new Uint8Array([0, 255, 16]))).toBe("00ff10");
  });
});
