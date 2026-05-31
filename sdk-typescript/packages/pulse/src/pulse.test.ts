import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { PulseAPI, createPulseAPI } from "./index";

describe("@wave-av/pulse", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createPulseAPI returns a PulseAPI bound to the core client", () => {
    expect(createPulseAPI(client)).toBeInstanceOf(PulseAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new PulseAPI(client)).toBeInstanceOf(PulseAPI);
  });
});
