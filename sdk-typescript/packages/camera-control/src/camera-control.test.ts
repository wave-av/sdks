import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { CameraControlAPI, createCameraControlAPI } from "./index";

describe("@wave-av/camera-control", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("createCameraControlAPI returns a CameraControlAPI bound to the core client", () => {
    expect(createCameraControlAPI(client)).toBeInstanceOf(CameraControlAPI);
  });

  it("the API surface is a constructable class", () => {
    expect(new CameraControlAPI(client)).toBeInstanceOf(CameraControlAPI);
  });
});
