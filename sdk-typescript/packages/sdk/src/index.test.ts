import { describe, it, expect } from "vitest";
import * as sdk from "./index";

describe("@wave-av/sdk umbrella", () => {
  it("re-exports the core client factory", () => {
    expect(typeof sdk.createClient).toBe("function");
    const client = sdk.createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });
    expect(client).toBeDefined();
  });

  it("exposes every product as a namespace", () => {
    const products = [
      "clips", "voice", "captions", "chapters", "editor", "phone",
      "collab", "podcast", "studioAi", "transcribe", "sentiment", "search",
    ] as const;
    for (const p of products) {
      expect(sdk[p as keyof typeof sdk], `missing namespace: ${p}`).toBeDefined();
    }
  });
});
