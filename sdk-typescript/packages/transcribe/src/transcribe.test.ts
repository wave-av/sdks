import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { TranscribeAPI, createTranscribeAPI } from "./index";

describe("@wave-av/transcribe", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createTranscribeAPI returns a TranscribeAPI bound to the core client", () => {
    expect(createTranscribeAPI(client)).toBeInstanceOf(TranscribeAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new TranscribeAPI(client)).toBeInstanceOf(TranscribeAPI);
  });
});
