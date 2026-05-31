import { describe, it, expect } from "vitest";
import { WaveDiscoveryClient } from "./index";

describe("@wave-av/discovery", () => {
  // Class-only client (no factory): constructed directly from (baseUrl, apiKey).
  it("constructs a WaveDiscoveryClient from baseUrl + apiKey", () => {
    expect(
      new WaveDiscoveryClient("https://api.wave.online", "wave_test_x"),
    ).toBeInstanceOf(WaveDiscoveryClient);
  });
});
