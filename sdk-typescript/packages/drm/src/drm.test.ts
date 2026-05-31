import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { DrmAPI, createDrmAPI } from "./index";

describe("@wave-av/drm", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createDrmAPI returns a DrmAPI bound to the core client", () => {
    expect(createDrmAPI(client)).toBeInstanceOf(DrmAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new DrmAPI(client)).toBeInstanceOf(DrmAPI);
  });
});
