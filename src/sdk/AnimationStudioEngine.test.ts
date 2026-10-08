import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnimationStudioEngine,
  DEFAULT_BROADCAST_FPS,
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

  it("re-exports the worker SDK without constructing a BullMQ Worker", () => {
    expect(DEFAULT_BROADCAST_FPS).toBe(29.97);
    const src = readFileSync(
      path.join(import.meta.dirname, "AnimationStudioEngine.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/new Worker/);
    expect(src).not.toMatch(/promisify\(exec\)/);
  });
});
