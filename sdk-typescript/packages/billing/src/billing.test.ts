import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { BillingAPI, createBillingAPI } from "./index";

describe("@wave-av/billing", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createBillingAPI returns a BillingAPI bound to the core client", () => {
    expect(createBillingAPI(client)).toBeInstanceOf(BillingAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new BillingAPI(client)).toBeInstanceOf(BillingAPI);
  });
});
