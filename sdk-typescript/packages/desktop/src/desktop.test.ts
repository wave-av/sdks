import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { DesktopAPI, createDesktopAPI } from "./index";

describe("@wave-av/desktop", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createDesktopAPI returns a DesktopAPI bound to the core client", () => {
    expect(createDesktopAPI(client)).toBeInstanceOf(DesktopAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new DesktopAPI(client)).toBeInstanceOf(DesktopAPI);
  });
});
