import { describe, it, expect, vi } from "vitest";
import { runCli } from "./cli";
import { sha256Hex } from "./client";
import { canonicalRecord } from "./verify";
import type { LedgerEntry } from "./rdrs-types";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function capture() {
  const lines: { out: string[]; err: string[] } = { out: [], err: [] };
  return {
    lines,
    stdout: (l: string) => lines.out.push(l),
    stderr: (l: string) => lines.err.push(l),
  };
}

describe("rdrs CLI", () => {
  it("verify-chain prints 'chain ok head=<hash>' and exits 0 for a good chain", async () => {
    const genesis = "0".repeat(64);
    const record = { kind: "dispute_opened", id: "d_1" };
    const hash = await sha256Hex(genesis + canonicalRecord(record));
    const entries: LedgerEntry[] = [{ index: 0, prev_hash: genesis, hash, record, timestamp: "2026-09-28T00:00:00Z" }];
    const fetchMock = vi.fn(async () => jsonResponse(200, entries));
    const c = capture();

    const code = await runCli(["verify-chain"], { fetch: fetchMock as unknown as typeof fetch, env: {}, ...c });

    expect(code).toBe(0);
    expect(c.lines.out[0]).toBe(`chain ok head=${hash}`);
    expect(c.lines.err).toEqual([]);
  });

  it("verify-chain exits 1 and names the bad index for a tampered chain", async () => {
    const genesis = "0".repeat(64);
    const record = { kind: "dispute_opened", id: "d_1" };
    const hash = await sha256Hex(genesis + canonicalRecord(record));
    const entries: LedgerEntry[] = [{ index: 0, prev_hash: genesis, hash, record: { kind: "TAMPERED" }, timestamp: "2026-09-28T00:00:00Z" }];
    const fetchMock = vi.fn(async () => jsonResponse(200, entries));
    const c = capture();

    const code = await runCli(["verify-chain"], { fetch: fetchMock as unknown as typeof fetch, env: {}, ...c });

    expect(code).toBe(1);
    expect(c.lines.err[0]).toBe(`chain BROKEN at index 0 head=${genesis}`);
  });

  it("verify-chain never sends RDRS_API_KEY as auth (public ledger read)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
      return jsonResponse(200, []);
    });
    const c = capture();
    await runCli(["verify-chain"], { fetch: fetchMock as unknown as typeof fetch, env: { RDRS_API_KEY: "rk_test_should_not_be_used" }, ...c });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("check requires a seller argument (exit 2, usage error)", async () => {
    const c = capture();
    const code = await runCli(["check"], { env: {}, ...c });
    expect(code).toBe(2);
    expect(c.lines.err[0]).toContain("usage: rdrs check");
  });

  it("check prints the seller attestation JSON", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { seller_id: "s_1", status: "clean", open_disputes: 0, resolved_disputes: 1, custody: "none", as_of: "now" }));
    const c = capture();
    const code = await runCli(["check", "s_1"], { fetch: fetchMock as unknown as typeof fetch, env: {}, ...c });
    expect(code).toBe(0);
    expect(JSON.parse(c.lines.out[0]!).status).toBe("clean");
  });

  it("open requires --seller --order --claim (exit 2 when missing)", async () => {
    const c = capture();
    const code = await runCli(["open", "--seller", "s_1"], { env: {}, ...c });
    expect(code).toBe(2);
  });

  it("open parses --rush as a boolean flag with no value", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent.rush).toBe(true);
      return jsonResponse(200, { id: "d_1", ...sent, status: "open", custody: "none", created_at: "now" });
    });
    const c = capture();
    const code = await runCli(["open", "--seller", "s_1", "--order", "o_1", "--claim", "item never shipped", "--rush"], {
      fetch: fetchMock as unknown as typeof fetch,
      env: { RDRS_API_KEY: "rk_test_x" },
      ...c,
    });
    expect(code).toBe(0);
  });

  it("verdict exits 1 with cannot_decide_yet while pending, 0 once decided", async () => {
    const pending = vi.fn(async () => jsonResponse(200, { status: "cannot_decide_yet", dispute_id: "d_1" }));
    const c1 = capture();
    expect(await runCli(["verdict", "d_1"], { fetch: pending as unknown as typeof fetch, env: {}, ...c1 })).toBe(1);

    const decided = vi.fn(async () =>
      jsonResponse(200, { status: "decided", dispute_id: "d_1", verdict_hash: "h".repeat(64), decision: "split", signature: "s", signer_public_key: "k", decided_at: "now", custody: "none" })
    );
    const c2 = capture();
    expect(await runCli(["verdict", "d_1"], { fetch: decided as unknown as typeof fetch, env: {}, ...c2 })).toBe(0);
  });

  it("keys prints help text and makes no network call", async () => {
    const fetchMock = vi.fn();
    const c = capture();
    const code = await runCli(["keys"], { fetch: fetchMock as unknown as typeof fetch, env: {}, ...c });
    expect(code).toBe(0);
    expect(c.lines.out[0]).toContain("rdrs keys");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an unknown command prints usage and exits 2", async () => {
    const c = capture();
    const code = await runCli(["bogus"], { env: {}, ...c });
    expect(code).toBe(2);
    expect(c.lines.err[0]).toContain("usage: rdrs");
  });

  it("a server error surfaces as an rdrs: <code>: <message> line and exits 1", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(404, { error: { code: "seller_not_found", message: "no such seller" } }));
    const c = capture();
    const code = await runCli(["check", "ghost"], { fetch: fetchMock as unknown as typeof fetch, env: {}, ...c });
    expect(code).toBe(1);
    expect(c.lines.err[0]).toBe("rdrs: seller_not_found: no such seller");
  });
});
