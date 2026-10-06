import { describe, expect, it, vi } from "vitest";
import {
  AnimationStudioEngine,
  exampleStudioPipelineConfig,
} from "@/sdk/AnimationStudioEngine";

describe("AnimationStudioEngine", () => {
  it("runs audio ingest, motion, lip-sync, and internal compose", async () => {
    const stages: string[] = [];
    const engine = new AnimationStudioEngine(exampleStudioPipelineConfig());
    engine.on("status", (event: { stage: string }) => stages.push(event.stage));

    const url = await engine.runFullPipeline();
    expect(url).toContain("/streams/comic_issue_01/master_episode.m3u8");
    expect(stages).toEqual([
      "AUDIO_INGEST",
      "VIDEO_GEN",
      "LIP_SYNC",
      "VIDEO_GEN",
      "LIP_SYNC",
      "COMPOSING",
      "PUBLISHING",
    ]);
  });

  it("fails when the character vault is empty", async () => {
    const engine = new AnimationStudioEngine({
      ...exampleStudioPipelineConfig(),
      characterVault: [],
    });
    await expect(engine.runFullPipeline()).rejects.toThrow(/characterVault is empty/);
  });
});
