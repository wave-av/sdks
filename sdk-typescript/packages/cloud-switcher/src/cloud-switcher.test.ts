import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { CloudSwitcherAPI, createCloudSwitcherAPI } from "./index";

describe("@wave-av/cloud-switcher", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createCloudSwitcherAPI returns a CloudSwitcherAPI bound to the core client", () => {
    expect(createCloudSwitcherAPI(client)).toBeInstanceOf(CloudSwitcherAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new CloudSwitcherAPI(client)).toBeInstanceOf(CloudSwitcherAPI);
  });
});
