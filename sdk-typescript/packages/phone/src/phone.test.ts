import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { PhoneAPI, createPhoneAPI } from "./index";

describe("@wave-av/phone", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createPhoneAPI returns a PhoneAPI bound to the core client", () => {
    expect(createPhoneAPI(client)).toBeInstanceOf(PhoneAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new PhoneAPI(client)).toBeInstanceOf(PhoneAPI);
  });
});
