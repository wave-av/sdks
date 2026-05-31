import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { SignageAPI, createSignageAPI } from "./index";

describe("@wave-av/signage", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createSignageAPI returns a SignageAPI bound to the core client", () => {
    expect(createSignageAPI(client)).toBeInstanceOf(SignageAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new SignageAPI(client)).toBeInstanceOf(SignageAPI);
  });
});
