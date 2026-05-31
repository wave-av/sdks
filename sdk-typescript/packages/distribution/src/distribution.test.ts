import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { DistributionAPI, createDistributionAPI } from "./index";

describe("@wave-av/distribution", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createDistributionAPI returns a DistributionAPI bound to the core client", () => {
    expect(createDistributionAPI(client)).toBeInstanceOf(DistributionAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new DistributionAPI(client)).toBeInstanceOf(DistributionAPI);
  });
});
