import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { createPrompterApi } from "./index";

describe("@wave-av/prompter", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createPrompterApi returns a bound client object exposing methods", () => {
    const api = createPrompterApi(client);
    expect(api).toBeTruthy();
    expect(typeof api).toBe("object");
    expect(Object.values(api).some((v) => typeof v === "function")).toBe(true);
  });
});
