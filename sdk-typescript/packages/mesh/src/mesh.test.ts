import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { MeshAPI, createMeshAPI } from "./index";

describe("@wave-av/mesh", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createMeshAPI returns a MeshAPI bound to the core client", () => {
    expect(createMeshAPI(client)).toBeInstanceOf(MeshAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new MeshAPI(client)).toBeInstanceOf(MeshAPI);
  });
});
