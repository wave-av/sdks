import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { SceneAPI, createSceneAPI } from "./index";

describe("@wave-av/scene", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createSceneAPI returns a SceneAPI bound to the core client", () => {
    expect(createSceneAPI(client)).toBeInstanceOf(SceneAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new SceneAPI(client)).toBeInstanceOf(SceneAPI);
  });
});
