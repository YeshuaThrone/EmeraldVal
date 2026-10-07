import { mkdtempSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyLipSync,
  buildStudioConcatArgs,
  buildStudioHlsArgs,
  compileAndPackageEpisode,
  generateSceneMotion,
  parseAudioPhonemes,
  parseMasterAudioTrack,
} from "./studio-engine";

describe("parseAudioPhonemes", () => {
  it("extracts word timestamps and phonemes from alignment segments", () => {
    const timestamps = parseAudioPhonemes(
      JSON.stringify({
        segments: [
          {
            words: [
              { word: " Hello ", start: "0.12", end: "0.40", phonemes: ["HH", "AH"] },
              { word: "world", start: 0.41, end: 0.9 },
            ],
          },
          { words: [{ word: "", start: 1, end: 2 }] },
        ],
      }),
    );
    expect(timestamps).toEqual([
      { word: "Hello", start: 0.12, end: 0.4, phonemes: ["HH", "AH"] },
      { word: "world", start: 0.41, end: 0.9, phonemes: [] },
    ]);
  });

  it("rejects payloads without a segments array", () => {
    expect(() => parseAudioPhonemes("{}")).toThrow(
      /Invalid audio alignment payload: Missing segments array/,
    );
  });

  it("rejects malformed JSON", () => {
    expect(() => parseAudioPhonemes("{not json")).toThrow(
      /Failed to parse alignment timestamps/,
    );
  });
});

describe("parseMasterAudioTrack", () => {
  it("parses WhisperX segments", () => {
    const words = parseMasterAudioTrack(
      JSON.stringify({
        segments: [{ words: [{ word: "city", start: 1.2, end: 1.6 }] }],
      }),
    );
    expect(words[0]).toMatchObject({ word: "city", start: 1.2, end: 1.6 });
  });

  it("parses Deepgram channel alternatives", () => {
    const words = parseMasterAudioTrack(
      JSON.stringify({
        results: {
          channels: [
            {
              alternatives: [
                {
                  words: [
                    { punctuated_word: "Hold.", word: "Hold", start: "0", end: "0.4" },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    expect(words).toEqual([{ word: "Hold", start: 0, end: 0.4, phonemes: [] }]);
  });

  it("rejects an unknown alignment payload", () => {
    expect(() => parseMasterAudioTrack("{}")).toThrow(
      /Invalid audio alignment payload structure/,
    );
  });
});

describe("motion and lip-sync dispatch hooks", () => {
  it("returns the SeeDance target motion path without requiring a GPU upload yet", async () => {
    const workDir = mkdtempSync(path.join(os.tmpdir(), "studio-motion-"));
    const target = await generateSceneMotion(
      {
        shotId: "shot_01",
        speakerId: "hero_01",
        dialogueText: "Hold the city.",
        characterModelId: "hero_01",
        motionPrompt: "push-in",
      },
      workDir,
    );
    expect(target).toBe(path.join(workDir, "motion_shot_01.mp4"));
  });

  it("names the lip-synced output from the motion basename", async () => {
    const workDir = mkdtempSync(path.join(os.tmpdir(), "studio-lipsync-"));
    const synced = await applyLipSync(
      path.join(workDir, "motion_shot_01.mp4"),
      path.join(workDir, "master.wav"),
      [],
      workDir,
    );
    expect(synced).toBe(path.join(workDir, "synced_motion_shot_01.mp4"));
  });
});

describe("studio FFmpeg argv builders", () => {
  it("builds concat argv with libx264, aac, and no shell string", () => {
    const args = buildStudioConcatArgs({
      concatListPath: "/tmp/internal-studio/ep1/concat_list.txt",
      masterAudioPath: "/tmp/internal-studio/ep1/master.wav",
      stitchedMp4Path: "/tmp/internal-studio/ep1/master_stitched.mp4",
      targetFps: 24,
    });
    expect(args).toContain("-f");
    expect(args[args.indexOf("-f") + 1]).toBe("concat");
    expect(args[args.indexOf("-r") + 1]).toBe("24");
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args.at(-1)).toBe("/tmp/internal-studio/ep1/master_stitched.mp4");
    expect(args.join(" ")).not.toContain("ffmpeg -y");
    expect(args.every((part) => !part.includes("&&"))).toBe(true);
  });

  it("builds HLS argv with 6-second segments", () => {
    const args = buildStudioHlsArgs({
      stitchedMp4Path: "/tmp/internal-studio/ep1/master_stitched.mp4",
      hlsMasterManifest: "/tmp/internal-studio/ep1/hls/index.m3u8",
    });
    expect(args[args.indexOf("-hls_time") + 1]).toBe("6");
    expect(args[args.indexOf("-f") + 1]).toBe("hls");
    expect(args.at(-1)).toBe("/tmp/internal-studio/ep1/hls/index.m3u8");
  });
});

describe("compileAndPackageEpisode", () => {
  it("throws before spawn when an input file is missing", async () => {
    const workDir = mkdtempSync(path.join(os.tmpdir(), "studio-engine-missing-"));
    await expect(
      compileAndPackageEpisode(
        [path.join(workDir, "temp_scene_1.mp4")],
        path.join(workDir, "master.wav"),
        workDir,
        30,
      ),
    ).rejects.toThrow(/missing input/);
  });

  it("rejects paths that escape the work directory", async () => {
    const workDir = mkdtempSync(path.join(os.tmpdir(), "studio-engine-escape-"));
    await expect(
      compileAndPackageEpisode(["../outside.mp4"], "master.wav", workDir, 30),
    ).rejects.toThrow(/escapes the work directory/);
  });

  it("stitches then packages HLS via spawn argv using a fake ffmpeg", async () => {
    const workDir = mkdtempSync(path.join(os.tmpdir(), "studio-engine-hls-"));
    writeFileSync(path.join(workDir, "scene_1.mp4"), "scene");
    writeFileSync(path.join(workDir, "master.wav"), "audio");

    const fakeBin = path.join(workDir, "fake-ffmpeg");
    writeFileSync(
      fakeBin,
      `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const out = process.argv[process.argv.length - 1];
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, out.endsWith(".m3u8") ? "#EXTM3U\\n" : "ok");
process.exit(0);
`,
    );
    chmodSync(fakeBin, 0o755);

    const manifest = await compileAndPackageEpisode(
      [path.join(workDir, "scene_1.mp4")],
      path.join(workDir, "master.wav"),
      workDir,
      30,
      fakeBin,
    );

    expect(manifest).toBe(path.join(workDir, "hls", "index.m3u8"));
    expect(existsSync(manifest)).toBe(true);
    expect(existsSync(path.join(workDir, "master_stitched.mp4"))).toBe(true);
    expect(existsSync(path.join(workDir, "concat_list.txt"))).toBe(false);
  });
});
