import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { SentimentAPI, createSentimentAPI } from "./index";

describe("@wave-av/sentiment", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createSentimentAPI returns a SentimentAPI bound to the core client", () => {
    expect(createSentimentAPI(client)).toBeInstanceOf(SentimentAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new SentimentAPI(client)).toBeInstanceOf(SentimentAPI);
  });
});
