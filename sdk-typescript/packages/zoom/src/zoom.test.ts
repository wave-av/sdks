import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { ZoomAPI, createZoomAPI } from "./index";

describe("@wave-av/zoom", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createZoomAPI returns a ZoomAPI bound to the core client", () => {
    expect(createZoomAPI(client)).toBeInstanceOf(ZoomAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new ZoomAPI(client)).toBeInstanceOf(ZoomAPI);
  });
});
