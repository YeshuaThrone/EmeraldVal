import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_WORK_DIR = "/tmp/internal-studio";

export function studioWorkDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.ANIMATION_STUDIO_OS_WORK_DIR || DEFAULT_WORK_DIR);
}

export function assertInsideWorkDir(
  filePath: string,
  workDir: string = studioWorkDir(),
): string {
  const resolved = path.resolve(workDir, filePath);
  const root = path.resolve(workDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Studio stitcher path escapes the work directory");
  }
  if (filePath.includes("\0")) {
    throw new Error("Studio stitcher path is invalid");
  }
  return resolved;
}

export function buildFfmpegConcatArgs(input: {
  clipPaths: string[];
  outputFileName: string;
  workDir?: string;
}): { args: string[]; concatFile: string; outputPath: string } {
  const workDir = path.resolve(input.workDir ?? studioWorkDir());
  if (input.clipPaths.length < 2) {
    throw new Error("FFmpeg stitcher needs at least two clips");
  }
  const clips = input.clipPaths.map((clip) => assertInsideWorkDir(clip, workDir));
  const outputPath = assertInsideWorkDir(input.outputFileName, workDir);
  const concatFile = path.join(workDir, "concat.txt");
  return {
    concatFile,
    outputPath,
    args: [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-c",
      "copy",
      outputPath,
    ],
  };
}

export function concatFileContents(clipPaths: string[]): string {
  return clipPaths
    .map((clip) => `file '${clip.replace(/'/g, `'\\''`)}'`)
    .join("\n");
}

export async function stitchShotsWithFfmpeg(input: {
  clipPaths: string[];
  outputFileName: string;
  workDir?: string;
  ffmpegBin?: string;
}): Promise<{ outputPath: string; args: string[] }> {
  const workDir = path.resolve(input.workDir ?? studioWorkDir());
  const planned = buildFfmpegConcatArgs({ ...input, workDir });
  await mkdir(workDir, { recursive: true });
  await writeFile(
    planned.concatFile,
    concatFileContents(
      input.clipPaths.map((clip) => assertInsideWorkDir(clip, workDir)),
    ),
    "utf8",
  );

  const bin = input.ffmpegBin || "ffmpeg";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, planned.args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg stitch failed (${code}): ${stderr.slice(0, 500)}`));
    });
  });

  return { outputPath: planned.outputPath, args: planned.args };
}
