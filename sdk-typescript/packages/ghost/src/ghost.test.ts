import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { GhostAPI, createGhostAPI } from "./index";

describe("@wave-av/ghost", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createGhostAPI returns a GhostAPI bound to the core client", () => {
    expect(createGhostAPI(client)).toBeInstanceOf(GhostAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new GhostAPI(client)).toBeInstanceOf(GhostAPI);
  });
});
