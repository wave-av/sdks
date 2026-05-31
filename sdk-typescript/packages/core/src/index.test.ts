import { describe, it, expect } from "vitest";
import { WaveClient, createClient, WaveError, RateLimitError } from "./index";

describe("@wave-av/core", () => {
  it("createClient returns a WaveClient", () => {
    const c = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });
    expect(c).toBeInstanceOf(WaveClient);
  });

  it("WaveError carries code + statusCode", () => {
    const e = new WaveError("nope", "AUTH_REQUIRED", 401);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("AUTH_REQUIRED");
    expect(e.statusCode).toBe(401);
  });

  it("RateLimitError is a WaveError", () => {
    const e = new RateLimitError("slow down", 30);
    expect(e).toBeInstanceOf(WaveError);
    expect(e.statusCode).toBe(429);
  });
});
