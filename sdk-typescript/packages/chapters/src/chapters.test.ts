import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { ChaptersAPI, createChaptersAPI } from "./index";

describe("@wave-av/chapters", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createChaptersAPI returns a ChaptersAPI bound to the core client", () => {
    expect(createChaptersAPI(client)).toBeInstanceOf(ChaptersAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new ChaptersAPI(client)).toBeInstanceOf(ChaptersAPI);
  });
});
