import { describe, it, expect } from "vitest";
import { AutopilotModule, createAutopilotModule } from "./index";

describe("@wave-av/autopilot", () => {
  // Legacy config-based module: constructed from a WaveClientConfig, not a WaveClient.
  const config = { apiKey: "wave_test_x", baseUrl: "https://api.wave.online" };

  it("createAutopilotModule returns an AutopilotModule", () => {
    expect(createAutopilotModule(config)).toBeInstanceOf(AutopilotModule);
  });

  it("the API surface is a constructable class", () => {
    expect(new AutopilotModule(config)).toBeInstanceOf(AutopilotModule);
  });
});
