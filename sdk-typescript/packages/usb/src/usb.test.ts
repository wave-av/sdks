import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { UsbAPI, createUsbAPI } from "./index";

describe("@wave-av/usb", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createUsbAPI returns a UsbAPI bound to the core client", () => {
    expect(createUsbAPI(client)).toBeInstanceOf(UsbAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new UsbAPI(client)).toBeInstanceOf(UsbAPI);
  });
});
