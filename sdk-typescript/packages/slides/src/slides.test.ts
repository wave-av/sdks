import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { SlidesAPI, createSlidesAPI } from "./index";

describe("@wave-av/slides", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createSlidesAPI returns a SlidesAPI bound to the core client", () => {
    expect(createSlidesAPI(client)).toBeInstanceOf(SlidesAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new SlidesAPI(client)).toBeInstanceOf(SlidesAPI);
  });
});
