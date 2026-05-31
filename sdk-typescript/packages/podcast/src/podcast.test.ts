import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { PodcastAPI, createPodcastAPI } from "./index";

describe("@wave-av/podcast", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createPodcastAPI returns a PodcastAPI bound to the core client", () => {
    expect(createPodcastAPI(client)).toBeInstanceOf(PodcastAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new PodcastAPI(client)).toBeInstanceOf(PodcastAPI);
  });
});
