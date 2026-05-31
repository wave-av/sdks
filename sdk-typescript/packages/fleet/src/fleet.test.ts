import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { FleetAPI, createFleetAPI } from "./index";

describe("@wave-av/fleet", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createFleetAPI returns a FleetAPI bound to the core client", () => {
    expect(createFleetAPI(client)).toBeInstanceOf(FleetAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new FleetAPI(client)).toBeInstanceOf(FleetAPI);
  });
});
