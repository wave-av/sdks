import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { ClipsAPI, createClipsAPI } from "./index";

describe("@wave-av/clips", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createClipsAPI returns a ClipsAPI bound to the core client", () => {
    const clips = createClipsAPI(client);
    expect(clips).toBeInstanceOf(ClipsAPI);
  });

  it("exposes the typed clips surface", () => {
    const clips = new ClipsAPI(client);
    for (const m of ["create", "get", "update", "remove", "list", "exportClip"]) {
      expect(typeof (clips as unknown as Record<string, unknown>)[m]).toBe("function");
    }
  });
});
