import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { QrAPI, createQrAPI } from "./index";

describe("@wave-av/qr", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createQrAPI returns a QrAPI bound to the core client", () => {
    expect(createQrAPI(client)).toBeInstanceOf(QrAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new QrAPI(client)).toBeInstanceOf(QrAPI);
  });
});
