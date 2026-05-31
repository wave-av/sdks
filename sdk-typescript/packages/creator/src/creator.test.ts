import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { CreatorAPI, createCreatorAPI } from "./index";

describe("@wave-av/creator", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createCreatorAPI returns a CreatorAPI bound to the core client", () => {
    expect(createCreatorAPI(client)).toBeInstanceOf(CreatorAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new CreatorAPI(client)).toBeInstanceOf(CreatorAPI);
  });
});
