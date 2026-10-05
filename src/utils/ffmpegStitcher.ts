import { spawn } from "node:child_process";

export interface PillarCutInput {
  shotAVideoPath: string;
  shotBVideoPath: string;
  outputPath: string;
  ffmpegBin?: string;
}

export interface BlackDetectEvent {
  blackStart: number;
  blackEnd: number;
  blackDuration: number;
}

export function parseBlackDetectLog(stderr: string): BlackDetectEvent[] {
  const events: BlackDetectEvent[] = [];
  const pattern =
    /black_start:\s*([0-9.]+)\s+black_end:\s*([0-9.]+)\s+black_duration:\s*([0-9.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stderr))) {
    events.push({
      blackStart: Number(match[1]),
      blackEnd: Number(match[2]),
      blackDuration: Number(match[3]),
    });
  }
  return events;
}

/** Last detected black hold is the pillar cut on shot A. */
export function pickPillarCutSeconds(events: BlackDetectEvent[]): number | null {
  const usable = events.filter((event) => event.blackDuration >= 0.04);
  const last = usable[usable.length - 1];
  if (!last) return null;
  return last.blackStart;
}

export function isPillarCutMetadata(metadata: unknown): metadata is {
  previous_shot_id: string;
  transition_type: "pillar_cut";
} {
  if (!metadata || typeof metadata !== "object") return false;
  const record = metadata as Record<string, unknown>;
  return (
    record.transition_type === "pillar_cut" &&
    typeof record.previous_shot_id === "string" &&
    record.previous_shot_id.length > 0
  );
}

export function buildPillarCutArgs(input: {
  shotAVideoPath: string;
  shotBVideoPath: string;
  outputPath: string;
  cutSeconds: number | null;
}): string[] {
  const trim =
    input.cutSeconds != null
      ? `[0:v]trim=0:${input.cutSeconds.toFixed(3)},setpts=PTS-STARTPTS[v0];`
      : `[0:v]setpts=PTS-STARTPTS[v0];`;
  return [
    "-y",
    "-hide_banner",
    "-i",
    input.shotAVideoPath,
    "-i",
    input.shotBVideoPath,
    "-filter_complex",
    `${trim}[1:v]setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[v]`,
    "-map",
    "[v]",
    "-an",
    input.outputPath,
  ];
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
      reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(0, 500)}`));
    });
  });
}

export async function stitchShotsAtPillarCut(
  input: PillarCutInput,
): Promise<{ outputPath: string; cutSeconds: number | null }> {
  const bin = input.ffmpegBin || "ffmpeg";
  const detect = await runFfmpeg(
    [
      "-hide_banner",
      "-i",
      input.shotAVideoPath,
      "-vf",
      "blackdetect=d=0.05:pix_th=0.10",
      "-an",
      "-f",
      "null",
      "-",
    ],
    bin,
  );
  const cutSeconds = pickPillarCutSeconds(parseBlackDetectLog(detect.stderr));
  await runFfmpeg(
    buildPillarCutArgs({
      shotAVideoPath: input.shotAVideoPath,
      shotBVideoPath: input.shotBVideoPath,
      outputPath: input.outputPath,
      cutSeconds,
    }),
    bin,
  );
  return { outputPath: input.outputPath, cutSeconds };
}
