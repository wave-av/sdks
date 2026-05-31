import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { ReplayAPI, createReplayAPI } from "./index";

describe("@wave-av/replay", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createReplayAPI returns a ReplayAPI bound to the core client", () => {
    expect(createReplayAPI(client)).toBeInstanceOf(ReplayAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new ReplayAPI(client)).toBeInstanceOf(ReplayAPI);
  });
});
