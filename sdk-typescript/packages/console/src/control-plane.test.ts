import { describe, expect, it, vi, beforeEach } from "vitest";
import { ControlPlaneModule, ControlPlaneError } from "./control-plane";

const config = { apiKey: "e2e-fake-key-0123456789" };

describe("ControlPlaneModule", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("review posts the repo to the review plane", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [{ reviewer: "wave" }] }) });
    const m = new ControlPlaneModule(config);
    const r = await m.review("wave-av/example-repo");
    expect(fetchMock.mock.calls[0][0]).toBe("https://review.wave.online/v1/review");
    expect(r.results?.length).toBe(1);
  });

  it("insights hits the gateway with the bearer key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ window_days: 7, generatedAt: "t", by_category: [] }) });
    const m = new ControlPlaneModule(config);
    await m.insights();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.wave.online/v1/insights");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer e2e-fake-key-0123456789");
  });

  it("surfaces the gateway's own 401 as a ControlPlaneError with status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { code: "AUTH_INVALID_KEY", message: "authentication required" } }) });
    const m = new ControlPlaneModule(config);
    await expect(m.engineCapabilities()).rejects.toMatchObject({ status: 401, name: "ControlPlaneError" });
  });

  it("identity resolve posts the identifier", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ resolved: true }) });
    const m = new ControlPlaneModule(config);
    await m.identityResolve("agent-x");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.wave.online/v1/identity/resolve");
  });

  it("audit passes from/to query params", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: [] }) });
    const m = new ControlPlaneModule(config);
    await m.audit("2026-08-25", "2026-08-26");
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/audit?from=2026-08-25&to=2026-08-26");
  });

  it("gpu hits /v1/gpu", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const m = new ControlPlaneModule(config);
    await m.gpu();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.wave.online/v1/gpu");
  });
});
