import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { NotificationsAPI, createNotificationsAPI } from "./index";

describe("@wave-av/notifications", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createNotificationsAPI returns a NotificationsAPI bound to the core client", () => {
    expect(createNotificationsAPI(client)).toBeInstanceOf(NotificationsAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new NotificationsAPI(client)).toBeInstanceOf(NotificationsAPI);
  });
});
