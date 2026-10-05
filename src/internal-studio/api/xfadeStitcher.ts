import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_XFADE_CLIP_SECONDS = 5;
export const DEFAULT_XFADE_DURATION = 0.5;

export function buildXfadeFilterComplex(
  clipCount: number,
  transitionDuration = DEFAULT_XFADE_DURATION,
  clipDurationSeconds = DEFAULT_XFADE_CLIP_SECONDS,
): { filterComplex: string; lastOutput: string } {
  if (clipCount < 2) {
    throw new Error("At least two video paths are required to perform stitching.");
  }

  let filterComplex = "";
  let lastOutput = "[0:v]";
  for (let i = 1; i < clipCount; i++) {
    const nextInput = `[${i}:v]`;
    const currentOutput = `[v${i}]`;
    const offset = i * (clipDurationSeconds - transitionDuration);
    filterComplex += `${lastOutput}${nextInput}xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${currentOutput};`;
    lastOutput = currentOutput;
  }
  if (filterComplex.endsWith(";")) {
    filterComplex = filterComplex.slice(0, -1);
  }
  return { filterComplex, lastOutput };
}

export function buildXfadeFfmpegArgs(input: {
  inputPaths: string[];
  outputPath: string;
  transitionDuration?: number;
  clipDurationSeconds?: number;
}): string[] {
  const transitionDuration = input.transitionDuration ?? DEFAULT_XFADE_DURATION;
  const { filterComplex, lastOutput } = buildXfadeFilterComplex(
    input.inputPaths.length,
    transitionDuration,
    input.clipDurationSeconds ?? DEFAULT_XFADE_CLIP_SECONDS,
  );
  const args = ["-y", "-hide_banner"];
  for (const inputPath of input.inputPaths) {
    args.push("-i", inputPath);
  }
  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    lastOutput,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    input.outputPath,
  );
  return args;
}

function runFfmpeg(
  args: string[],
  bin: string,
): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stderr });
        return;
      }
      reject(new Error(`FFmpeg processing failed: ffmpeg failed (${code}): ${stderr.slice(0, 400)}`));
    });
  });
}

/**
 * Stitches multiple video clips using FFmpeg crossfade transitions.
 */
export async function stitchMultiStyleClips(
  inputPaths: string[],
  outputPath: string,
  transitionDuration = DEFAULT_XFADE_DURATION,
  options?: { ffmpegBin?: string; clipDurationSeconds?: number },
): Promise<{ success: true; outputPath: string; logs: string; args: string[] }> {
  if (!inputPaths || inputPaths.length < 2) {
    throw new Error("At least two video paths are required to perform stitching.");
  }

  for (const inputPath of inputPaths) {
    try {
      await access(inputPath);
    } catch {
      throw new Error(`Input file not found: ${inputPath}`);
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const args = buildXfadeFfmpegArgs({
    inputPaths,
    outputPath,
    transitionDuration,
    clipDurationSeconds: options?.clipDurationSeconds,
  });
  const { stderr } = await runFfmpeg(args, options?.ffmpegBin || "ffmpeg");
  return {
    success: true,
    outputPath,
    logs: stderr,
    args,
  };
}
