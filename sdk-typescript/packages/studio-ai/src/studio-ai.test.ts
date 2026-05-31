import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { StudioAIAPI, createStudioAIAPI } from "./index";

describe("@wave-av/studio-ai", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createStudioAIAPI returns a StudioAIAPI bound to the core client", () => {
    expect(createStudioAIAPI(client)).toBeInstanceOf(StudioAIAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new StudioAIAPI(client)).toBeInstanceOf(StudioAIAPI);
  });
});
