import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { StudioAPI, createStudioAPI } from "./index";

describe("@wave-av/studio", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createStudioAPI returns a StudioAPI bound to the core client", () => {
    expect(createStudioAPI(client)).toBeInstanceOf(StudioAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new StudioAPI(client)).toBeInstanceOf(StudioAPI);
  });
});
