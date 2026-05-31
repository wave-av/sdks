import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { VoiceAPI, createVoiceAPI } from "./index";

describe("@wave-av/voice", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createVoiceAPI returns a VoiceAPI bound to the core client", () => {
    expect(createVoiceAPI(client)).toBeInstanceOf(VoiceAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new VoiceAPI(client)).toBeInstanceOf(VoiceAPI);
  });
});
