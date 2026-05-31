import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { EditorAPI, createEditorAPI } from "./index";

describe("@wave-av/editor", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createEditorAPI returns a EditorAPI bound to the core client", () => {
    expect(createEditorAPI(client)).toBeInstanceOf(EditorAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new EditorAPI(client)).toBeInstanceOf(EditorAPI);
  });
});
