import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { CaptionsAPI, createCaptionsAPI } from "./index";

describe("@wave-av/captions", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createCaptionsAPI returns a CaptionsAPI bound to the core client", () => {
    expect(createCaptionsAPI(client)).toBeInstanceOf(CaptionsAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new CaptionsAPI(client)).toBeInstanceOf(CaptionsAPI);
  });
});
