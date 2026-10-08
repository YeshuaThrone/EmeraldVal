import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { studioWorkDir } from "../src/internal-studio/api/ffmpegStitcher";
import { inspectUe5Studio } from "../src/lib/UnrealEngineStudioSDK";
import { processStudioRenderJob } from "../src/sdk/studio-queue";
import type { ShotCard } from "../src/sdk/studio-engine";

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} failed (${code}): ${stderr.slice(0, 400)}`));
    });
  });
}

function pingRedis(port = 6379): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(1500);
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

async function makeClip(outputPath: string): Promise<void> {
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=320x240:d=1",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    outputPath,
  ]);
}

async function main() {
  process.env.STUDIO_PERSIST_RENDER_JOBS ??= "0";
  console.log("Werfi Studio harness\n");

  await run("ffmpeg", ["-version"]);
  console.log("ffmpeg: ok");

  const redisUp = await pingRedis(
    Number.parseInt(process.env.REDIS_PORT || "6379", 10),
  );
  console.log(redisUp ? "redis: PONG" : "redis: not listening (queue enqueue skipped)");

  const ue5 = inspectUe5Studio();
  console.log(`ue5 binary: ${ue5.binary} (${ue5.binaryExists ? "found" : "missing"})`);
  console.log(`ue5 python: ${ue5.pythonExists ? "found" : "missing"}`);
  console.log(`ue5 note: ${ue5.note}`);

  const episodeId = `harness_${Date.now()}`;
  const workDir = path.join(studioWorkDir(), episodeId);
  mkdirSync(workDir, { recursive: true });
  const audioPath = path.join(workDir, "master.wav");
  const sceneA = path.join(workDir, "scene_a.mp4");
  const sceneB = path.join(workDir, "scene_b.mp4");

  await makeClip(sceneA);
  await makeClip(sceneB);
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    audioPath,
  ]);

  const shotCards: ShotCard[] = [
    {
      shotId: "shot_01",
      speakerId: "HOST_01",
      dialogueText: "Harness shot one.",
      characterModelId: "HOST_01",
      motionPrompt: "hold",
    },
    {
      shotId: "shot_02",
      speakerId: "GUEST_01",
      dialogueText: "Harness shot two.",
      characterModelId: "GUEST_01",
      motionPrompt: "hold",
    },
  ];

  copyFileSync(sceneA, path.join(workDir, "motion_shot_01.mp4"));
  copyFileSync(sceneB, path.join(workDir, "motion_shot_02.mp4"));
  copyFileSync(sceneA, path.join(workDir, "synced_motion_shot_01.mp4"));
  copyFileSync(sceneB, path.join(workDir, "synced_motion_shot_02.mp4"));
  writeFileSync(path.join(workDir, "script.txt"), "PRIMARY: Harness.\n", "utf8");

  const result = await processStudioRenderJob({
    id: `harness-job`,
    data: {
      episodeId,
      showId: "wurfi-harness",
      rodecasterAudioPath: audioPath,
      shotCards,
      outputDir: workDir,
      requestedBy: "3bbullion@gmail.com",
      targetFps: 29.97,
    },
    updateProgress: async () => undefined,
  });

  if (!existsSync(result.hlsUrl)) {
    throw new Error(`Expected HLS manifest at ${result.hlsUrl}`);
  }
  console.log(`\nHLS manifest: ${result.hlsUrl}`);
  console.log("Harness passed. Public WURFI player was not written.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
