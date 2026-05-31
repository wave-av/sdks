import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { CollabAPI, createCollabAPI } from "./index";

describe("@wave-av/collab", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createCollabAPI returns a CollabAPI bound to the core client", () => {
    expect(createCollabAPI(client)).toBeInstanceOf(CollabAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new CollabAPI(client)).toBeInstanceOf(CollabAPI);
  });
});
