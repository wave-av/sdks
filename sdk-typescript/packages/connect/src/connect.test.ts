import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { ConnectAPI, createConnectAPI } from "./index";

describe("@wave-av/connect", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createConnectAPI returns a ConnectAPI bound to the core client", () => {
    expect(createConnectAPI(client)).toBeInstanceOf(ConnectAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new ConnectAPI(client)).toBeInstanceOf(ConnectAPI);
  });
});
