import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { PipelineAPI, createPipelineAPI } from "./index";

describe("@wave-av/pipeline", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createPipelineAPI returns a PipelineAPI bound to the core client", () => {
    expect(createPipelineAPI(client)).toBeInstanceOf(PipelineAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new PipelineAPI(client)).toBeInstanceOf(PipelineAPI);
  });
});
