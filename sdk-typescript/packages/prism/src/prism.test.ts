import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { PrismAPI, createPrismAPI } from "./index";

describe("@wave-av/prism", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createPrismAPI returns a PrismAPI bound to the core client", () => {
    expect(createPrismAPI(client)).toBeInstanceOf(PrismAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new PrismAPI(client)).toBeInstanceOf(PrismAPI);
  });
});
