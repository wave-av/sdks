import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { SearchAPI, createSearchAPI } from "./index";

describe("@wave-av/search", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createSearchAPI returns a SearchAPI bound to the core client", () => {
    expect(createSearchAPI(client)).toBeInstanceOf(SearchAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new SearchAPI(client)).toBeInstanceOf(SearchAPI);
  });
});
