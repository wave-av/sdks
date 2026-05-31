import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { MarketplaceAPI, createMarketplaceAPI } from "./index";

describe("@wave-av/marketplace", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createMarketplaceAPI returns a MarketplaceAPI bound to the core client", () => {
    expect(createMarketplaceAPI(client)).toBeInstanceOf(MarketplaceAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new MarketplaceAPI(client)).toBeInstanceOf(MarketplaceAPI);
  });
});
