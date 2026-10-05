import { describe, expect, it } from "vitest";
import {
  compileConditioningPayload,
  parseAdvancedShotConditioningPayload,
} from "./conditioningPipeline";

describe("compileConditioningPayload", () => {
  it("locks character, camera, and ControlNet layers", () => {
    const compiled = compileConditioningPayload(
      parseAdvancedShotConditioningPayload({
        shotId: "act1-02",
        projectId: "pilot",
        prompt: "Maya turns into the key light.",
        negativePrompt: "morphing face",
        seed: 42,
        characterRef: {
          characterId: "11111111-1111-4111-8111-111111111111",
          turnaroundSheetUrl: "https://cdn.example/maya.png",
          faceEmbeddingUrl: "https://cdn.example/maya.emb",
          weight: 1.4,
        },
        controlNet: {
          depthMapUrl: "https://cdn.example/depth.png",
          lineartUrl: "https://cdn.example/line.png",
          weight: -0.2,
        },
        motionVector: {
          type: "orbit",
          speed: 0.8,
          videoUrl: "https://cdn.example/orbit.mp4",
        },
      }),
    );

    expect(compiled.generation_params.prompt).toContain("[CHARACTER_LOCK:");
    expect(compiled.generation_params.prompt).toContain("[CAMERA_MOTION: orbit SPEED=0.8]");
    expect(compiled.conditioning_layers.ip_adapter.weight).toBe(1);
    expect(compiled.conditioning_layers.controlnet?.weight).toBe(0);
    expect(compiled.conditioning_layers.motion_vector.reference_video).toContain(
      "orbit.mp4",
    );
  });
});
