import { describe, it, expect } from "vitest";
import { ConsoleModule, createConsoleModule } from "./index";

describe("@wave-av/console", () => {
  // Legacy config-based module: constructed from a WaveClientConfig, not a WaveClient.
  const config = { apiKey: "wave_test_x", baseUrl: "https://api.wave.online" };

  it("createConsoleModule returns a ConsoleModule", () => {
    expect(createConsoleModule(config)).toBeInstanceOf(ConsoleModule);
  });

  it("the API surface is a constructable class", () => {
    expect(new ConsoleModule(config)).toBeInstanceOf(ConsoleModule);
  });
});
