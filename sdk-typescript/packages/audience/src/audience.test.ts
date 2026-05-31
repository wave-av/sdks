import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { AudienceAPI, createAudienceAPI } from "./index";

describe("@wave-av/audience", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createAudienceAPI returns a AudienceAPI bound to the core client", () => {
    expect(createAudienceAPI(client)).toBeInstanceOf(AudienceAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new AudienceAPI(client)).toBeInstanceOf(AudienceAPI);
  });
});
