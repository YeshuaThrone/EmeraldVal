import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BROADCAST_FPS } from "@/sdk/studio-engine";
import {
  acquireMetaHuman,
  lookupMetaHuman,
  releaseMetaHuman,
} from "@/lib/MetaHumanRegistry";

export interface UE5RemoteControlRequest {
  objectPath: string;
  functionName: string;
  parameters?: Record<string, unknown>;
}

export interface UE5ShotRenderTask {
  uprojectPath: string;
  sequencePath: string;
  outputDirectory: string;
  targetResolution?: "1080p" | "4K";
  targetFps?: number;
}

export const WERFI_STUDIO_BRIDGE_OBJECT_PATH =
  "/Game/WerfiStudio/Blueprints/WerfiStudioBridge.WerfiStudioBridge";

export function ue5MrqPythonScript(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.UE5_MRQ_PYTHON ||
    path.resolve("unreal/WerfiStudio/Content/Python/render-ue5-mrq.py")
  ).trim();
}

const DEFAULT_UE5_REMOTE =
  "http://127.0.0.1:30010/remote/object/call";
const DEFAULT_UE5_BIN =
  process.platform === "win32"
    ? "C:\\Program Files\\Epic Games\\UE_5.4\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe"
    : "UnrealEditor-Cmd";

export function ue5RemoteControlUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.UE5_REMOTE_CONTROL_URL || DEFAULT_UE5_REMOTE).trim();
}

export function ue5BinaryPath(env: NodeJS.ProcessEnv = process.env): string {
  return (env.UNREAL_ENGINE_BIN || DEFAULT_UE5_BIN).trim();
}

export function inspectUe5Studio(env: NodeJS.ProcessEnv = process.env): {
  binary: string;
  binaryExists: boolean;
  pythonScript: string;
  pythonExists: boolean;
  remoteUrl: string;
  ready: boolean;
  note: string;
} {
  const binary = ue5BinaryPath(env);
  const pythonScript = ue5MrqPythonScript(env);
  const binaryExists = existsSync(binary);
  const pythonExists = existsSync(pythonScript);
  return {
    binary,
    binaryExists,
    pythonScript,
    pythonExists,
    remoteUrl: ue5RemoteControlUrl(env),
    ready: binaryExists && pythonExists,
    note: binaryExists
      ? "UnrealEditor-Cmd found. Compile UWerfiStudioBridge into the .uproject and set UE5_BRIDGE_OBJECT_PATH."
      : "Set UNREAL_ENGINE_BIN to UnrealEditor-Cmd on the render machine. Node will not fake a UE5 editor.",
  };
}

function assertSafePath(filePath: string, label: string): string {
  if (!filePath || filePath.includes("\0")) {
    throw new Error(`UE5 ${label} path is invalid`);
  }
  return filePath;
}

function resolutionSize(targetResolution?: "1080p" | "4K"): { width: number; height: number } {
  if (targetResolution === "4K") {
    return { width: 3840, height: 2160 };
  }
  return { width: 1920, height: 1080 };
}

function runProcess(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
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
      reject(
        new Error(
          `UE5 Movie Render Queue Failure: process failed (${code}): ${stderr.slice(0, 500)}`,
        ),
      );
    });
  });
}

/**
 * Triggers live functions inside a running Unreal Engine 5 editor instance.
 */
export async function callUE5RemoteControl(
  payload: UE5RemoteControlRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  const objectPath = payload.objectPath?.trim();
  const functionName = payload.functionName?.trim();
  if (!objectPath || !functionName) {
    throw new Error("UE5 Remote Control requires objectPath and functionName");
  }

  try {
    const response = await fetch(ue5RemoteControlUrl(env), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectPath,
        functionName,
        parameters: payload.parameters ?? {},
      }),
    });

    if (!response.ok) {
      throw new Error(`UE5 Remote Control REST Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(
      `Failed to communicate with Unreal Engine REST API: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}

/**
 * Connects Rodecaster audio to NVIDIA Audio2Face / LiveLink for a MetaHuman rig.
 */
export async function triggerAudio2FaceLiveLink(
  audioFilePath: string,
  metaHumanTargetId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ status: string; streamingChannel: string }> {
  const audio = assertSafePath(audioFilePath, "audio");
  const target = metaHumanTargetId.trim();
  if (!target) {
    throw new Error("MetaHuman target id is required");
  }

  const registered = lookupMetaHuman(target);
  const asset = registered ? acquireMetaHuman(registered.id) : null;
  const characterId = asset?.id ?? target;
  const streamingChannel = asset?.liveLinkSubjectName ?? `livelink_${target}`;

  console.log(
    `[UE5 LiveLink] Ingesting Rodecaster track ${audio} for MetaHuman: ${characterId}`,
  );

  const remotePayload: UE5RemoteControlRequest = {
    objectPath:
      env.UE5_BRIDGE_OBJECT_PATH?.trim() || WERFI_STUDIO_BRIDGE_OBJECT_PATH,
    functionName: "StreamAudioTrackToRig",
    parameters: {
      AudioPath: path.resolve(audio),
      TargetCharacter: characterId,
      BlueprintPath: asset?.blueprintPath,
      LiveLinkSubjectName: streamingChannel,
      LightingRig: asset?.defaultLightingRig,
    },
  };

  try {
    await callUE5RemoteControl(remotePayload, env);
  } catch (error) {
    if (asset) releaseMetaHuman(asset.id);
    throw error;
  }

  return {
    status: "STREAMING_ACTIVE",
    streamingChannel,
  };
}

export async function updateUE5StageProperties(
  cameraAngle: string,
  lightingPreset: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return callUE5RemoteControl(
    {
      objectPath:
        env.UE5_BRIDGE_OBJECT_PATH?.trim() || WERFI_STUDIO_BRIDGE_OBJECT_PATH,
      functionName: "UpdateStageProperties",
      parameters: {
        CameraAngle: cameraAngle,
        LightingPreset: lightingPreset,
      },
    },
    env,
  );
}

export function buildUe5MrqArgs(
  task: UE5ShotRenderTask,
  env: NodeJS.ProcessEnv = process.env,
): { bin: string; args: string[]; outputPath: string } {
  const uprojectPath = path.resolve(assertSafePath(task.uprojectPath, "uproject"));
  const sequencePath = assertSafePath(task.sequencePath, "sequence");
  const outputDirectory = path.resolve(
    assertSafePath(task.outputDirectory, "output"),
  );
  const targetFps = task.targetFps ?? DEFAULT_BROADCAST_FPS;
  if (!Number.isFinite(targetFps) || targetFps < 1 || targetFps > 120) {
    throw new Error("targetFps must be between 1 and 120");
  }

  const outputFileName = `ue5_render_${Date.now()}.mp4`;
  const outputPath = path.join(outputDirectory, outputFileName);
  const scriptPath = path.resolve(assertSafePath(ue5MrqPythonScript(env), "python"));
  const { width, height } = resolutionSize(task.targetResolution);

  return {
    bin: ue5BinaryPath(env),
    args: [
      uprojectPath,
      "-log",
      "-NoLoadingScreen",
      "-Unattended",
      `-ExecutePythonScript=${scriptPath} ${sequencePath} ${outputDirectory} ${targetFps} ${width} ${height}`,
    ],
    outputPath,
  };
}

/**
 * Runs a headless Unreal Movie Render Queue job via spawn argv (not a shell string).
 */
export async function renderHeadlessUE5Shot(
  task: UE5ShotRenderTask,
  env: NodeJS.ProcessEnv = process.env,
  runner: (bin: string, args: string[]) => Promise<void> = runProcess,
): Promise<string> {
  const planned = buildUe5MrqArgs(task, env);
  mkdirSync(path.dirname(planned.outputPath), { recursive: true });

  console.log(
    `[UE5 MRQ Engine] Executing Headless Render for Sequence: ${task.sequencePath}`,
  );

  try {
    await runner(planned.bin, planned.args);
    return planned.outputPath;
  } catch (err) {
    throw new Error(
      `UE5 Movie Render Queue Failure: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}
