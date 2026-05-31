import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { VaultAPI, createVaultAPI } from "./index";

describe("@wave-av/vault", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createVaultAPI returns a VaultAPI bound to the core client", () => {
    expect(createVaultAPI(client)).toBeInstanceOf(VaultAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new VaultAPI(client)).toBeInstanceOf(VaultAPI);
  });
});
