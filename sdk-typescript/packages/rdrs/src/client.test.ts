import { describe, it, expect, vi } from "vitest";
import { RdrsClient, RdrsError, createRdrsClient, DEFAULT_BASE_URL, sha256Hex } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("@wave-av/rdrs client", () => {
  it("createRdrsClient returns an RdrsClient", () => {
    expect(createRdrsClient({ apiKey: "rk_test_x" })).toBeInstanceOf(RdrsClient);
  });

  it("defaults to https://api.rdrs.sh", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(`${DEFAULT_BASE_URL}/v1/sellers/seller_1/attestation`);
      return jsonResponse(200, { seller_id: "seller_1", status: "clean", open_disputes: 0, resolved_disputes: 3, custody: "none", as_of: "2026-09-28" });
    });
    const client = new RdrsClient({ fetch: fetchMock as unknown as typeof fetch });
    const attestation = await client.checkSeller("seller_1");
    expect(attestation.status).toBe("clean");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never sends an Authorization header when no apiKey is configured (public reads)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
      return jsonResponse(200, { head: "a".repeat(64), index: 3 });
    });
    const client = new RdrsClient({ fetch: fetchMock as unknown as typeof fetch });
    await client.getLedgerHead();
  });

  it("sends Bearer auth when an apiKey is configured", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer rk_test_abc");
      return jsonResponse(200, { id: "d_1", seller: "s", order: "o", claim: "c", status: "open", rush: false, custody: "none", created_at: "now" });
    });
    const client = new RdrsClient({ apiKey: "rk_test_abc", fetch: fetchMock as unknown as typeof fetch });
    await client.openDispute({ seller: "s", order: "o", claim: "c" });
  });

  it("attachEvidence computes a sha256 manifest of the receipt before sending", async () => {
    const receipt = "signed-receipt-payload";
    const expectedSha = await sha256Hex(receipt);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/v1/disputes/d_1/evidence");
      const sent = JSON.parse(String(init?.body));
      expect(sent.manifest.sha256).toBe(expectedSha);
      expect(sent.manifest.size).toBe(receipt.length);
      expect(sent.receipt).toBe(receipt);
      return jsonResponse(200, { id: "e_1", dispute_id: "d_1", manifest: sent.manifest, status: "accepted", custody: "none" });
    });
    const client = new RdrsClient({ apiKey: "rk_test_x", fetch: fetchMock as unknown as typeof fetch });
    const result = await client.attachEvidence("d_1", { receipt });
    expect(result.status).toBe("accepted");
    expect(result.manifest.sha256).toBe(expectedSha);
  });

  it("surfaces no_signed_receipt as a typed RdrsError", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(422, { error: { code: "no_signed_receipt", message: "receipt is not signed" }, request_id: "req_1" })
    );
    const client = new RdrsClient({ apiKey: "rk_test_x", fetch: fetchMock as unknown as typeof fetch });
    await expect(client.attachEvidence("d_1", { receipt: "plain-text-not-signed" })).rejects.toMatchObject({
      name: "RdrsError",
      code: "no_signed_receipt",
      status: 422,
      requestId: "req_1",
    });
  });

  it("getVerdict returns the cannot_decide_yet sentinel while pending", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { status: "cannot_decide_yet", dispute_id: "d_1" }));
    const client = new RdrsClient({ apiKey: "rk_test_x", fetch: fetchMock as unknown as typeof fetch });
    const verdict = await client.getVerdict("d_1");
    expect(verdict.status).toBe("cannot_decide_yet");
  });

  it("getVerdict returns a decided, signed verdict", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        status: "decided",
        dispute_id: "d_1",
        verdict_hash: "h".repeat(64),
        decision: "favor_claimant",
        signature: "c2ln",
        signer_public_key: "cGs=",
        decided_at: "2026-09-28T00:00:00Z",
        custody: "none",
      })
    );
    const client = new RdrsClient({ apiKey: "rk_test_x", fetch: fetchMock as unknown as typeof fetch });
    const verdict = await client.getVerdict("d_1");
    expect(verdict.status).toBe("decided");
    if (verdict.status === "decided") {
      expect(verdict.decision).toBe("favor_claimant");
    }
  });

  it("submitRemedy sends the four-check fields and returns the ledger append", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/v1/remedies");
      const sent = JSON.parse(String(init?.body));
      expect(sent).toEqual({ dispute_id: "d_1", verdict_hash: "h".repeat(64), paid_to: "acct_1", amount: 1900, rail: "stripe" });
      return jsonResponse(200, {
        id: "r_1",
        dispute_id: "d_1",
        verdict_hash: "h".repeat(64),
        paid_to: "acct_1",
        amount: 1900,
        rail: "stripe",
        checks: { verdict_hash: true, paid_to: true, amount: true, rail: true },
        ledger_entry_index: 4,
        ledger_hash: "e".repeat(64),
        custody: "none",
        created_at: "now",
      });
    });
    const client = new RdrsClient({ apiKey: "rk_test_x", fetch: fetchMock as unknown as typeof fetch });
    const remedy = await client.submitRemedy({ dispute_id: "d_1", verdict_hash: "h".repeat(64), paid_to: "acct_1", amount: 1900, rail: "stripe" });
    expect(remedy.checks).toEqual({ verdict_hash: true, paid_to: true, amount: true, rail: true });
  });

  it("preflight never touches the ledger (writes_to_ledger: false)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { seller: "s", risk_tier: "low", panels: [{ panel: "identity", passed: true }], writes_to_ledger: false, custody: "none" })
    );
    const client = new RdrsClient({ apiKey: "rk_test_x", fetch: fetchMock as unknown as typeof fetch });
    const result = await client.preflight({ seller: "s", order: "o" });
    expect(result.writes_to_ledger).toBe(false);
  });

  it("getLedgerEntries forwards since/limit as query params", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(`${DEFAULT_BASE_URL}/v1/ledger/entries?since=2&limit=10`);
      return jsonResponse(200, []);
    });
    const client = new RdrsClient({ fetch: fetchMock as unknown as typeof fetch });
    await client.getLedgerEntries({ since: 2, limit: 10 });
  });

  it("wraps a non-JSON error body in a generic RdrsError", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("upstream 502", { status: 502, headers: { "content-type": "text/plain" } })
    );
    const client = new RdrsClient({ fetch: fetchMock as unknown as typeof fetch });
    await expect(client.checkSeller("s")).rejects.toBeInstanceOf(RdrsError);
  });

  it("throws when no fetch implementation is available anywhere", () => {
    const realFetch = globalThis.fetch;
    // @ts-expect-error — deliberately removing fetch to exercise the constructor guard
    delete globalThis.fetch;
    try {
      expect(() => new RdrsClient({})).toThrow(/no fetch implementation/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
