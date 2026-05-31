import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { EdgeAPI, createEdgeAPI } from "./index";

describe("@wave-av/edge", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createEdgeAPI returns a EdgeAPI bound to the core client", () => {
    expect(createEdgeAPI(client)).toBeInstanceOf(EdgeAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new EdgeAPI(client)).toBeInstanceOf(EdgeAPI);
  });
});
