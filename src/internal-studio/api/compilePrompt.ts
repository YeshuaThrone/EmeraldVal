import {
  DEFAULT_ART_STYLE,
  DEFAULT_SCENE_SETTING,
  imageTagForSpeaker,
  videoStemForSpeaker,
} from "../config/masterAssetMap";
import { lookupMetaHuman } from "@/lib/MetaHumanRegistry";
import type { ShotCard } from "@/sdk/studio-engine";

export interface StudioShotBeat {
  camera?: string;
  action: string;
  dialogue?: string;
  speaker?: "primary" | "secondary";
  durationSeconds?: number;
}

export interface CompileAnimationPromptInput {
  artStyle?: string;
  sceneSetting?: string;
  shots?: StudioShotBeat[];
  script?: string;
  durationSecondsPerShot?: number;
}

export interface CompiledShot {
  index: number;
  startSeconds: number;
  endSeconds: number;
  camera: string;
  action: string;
  dialogue?: string;
  speaker: "primary" | "secondary";
  videoStem: "@video1" | "@video2";
  imageTag: "@image1" | "@image2";
}

const DEFAULT_CAMERAS = [
  "Medium shot, static 35mm lens.",
  "Over-the-shoulder wide shot.",
  "Close-up, locked-off 50mm lens.",
];

function padTimecode(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resolveSpeaker(
  raw: string | undefined,
  index: number,
): "primary" | "secondary" {
  const key = (raw ?? "").trim().toLowerCase();
  if (
    key.includes("image2") ||
    key.includes("video2") ||
    key === "secondary" ||
    key === "b"
  ) {
    return "secondary";
  }
  if (
    key.includes("image1") ||
    key.includes("video1") ||
    key === "primary" ||
    key === "a"
  ) {
    return "primary";
  }
  return index % 2 === 0 ? "primary" : "secondary";
}

export function parseStudioScript(script: string): StudioShotBeat[] {
  const beats: StudioShotBeat[] = [];
  for (const rawLine of script.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const tagged = line.match(
      /^(PRIMARY|SECONDARY|@image1|@image2|@video1|@video2)\s*[:\-]\s*(.+)$/i,
    );
    if (tagged) {
      beats.push({
        speaker: resolveSpeaker(tagged[1], beats.length),
        dialogue: tagged[2]!.replace(/^["']|["']$/g, "").trim(),
        action: "",
      });
      continue;
    }
    const spoken = line.match(/^([A-Za-z0-9_ @]+):\s*(.+)$/);
    if (spoken) {
      beats.push({
        speaker: resolveSpeaker(spoken[1], beats.length),
        dialogue: spoken[2]!.replace(/^["']|["']$/g, "").trim(),
        action: "",
      });
    }
  }
  return beats;
}

function defaultAction(
  speaker: "primary" | "secondary",
  dialogue: string | undefined,
): string {
  const tag = imageTagForSpeaker(speaker);
  if (dialogue) {
    return `${tag} delivers the line in character.`;
  }
  return `${tag} holds the beat.`;
}

export function compileAnimationPrompt(
  input: CompileAnimationPromptInput,
): { prompt: string; shots: CompiledShot[] } {
  const duration = Math.max(1, Math.round(input.durationSecondsPerShot ?? 4));
  const beats =
    input.shots && input.shots.length > 0
      ? input.shots
      : parseStudioScript(input.script ?? "");

  if (beats.length === 0) {
    throw new Error("AnimationStudioOS needs shots or a script");
  }

  const shots: CompiledShot[] = [];
  let cursor = 0;
  beats.forEach((beat, index) => {
    const speaker = resolveSpeaker(beat.speaker, index);
    const length = Math.max(1, Math.round(beat.durationSeconds ?? duration));
    const imageTag = imageTagForSpeaker(speaker);
    let action = (beat.action ?? "").trim();
    if (!action) {
      action = defaultAction(speaker, beat.dialogue);
    } else if (!action.includes("@image")) {
      action = `${imageTag} ${action}`;
    }
    shots.push({
      index: index + 1,
      startSeconds: cursor,
      endSeconds: cursor + length,
      camera: (beat.camera ?? DEFAULT_CAMERAS[index % DEFAULT_CAMERAS.length]!).trim(),
      action,
      dialogue: beat.dialogue?.trim() || undefined,
      speaker,
      videoStem: videoStemForSpeaker(speaker),
      imageTag,
    });
    cursor += length;
  });

  const artStyle = (input.artStyle ?? DEFAULT_ART_STYLE).trim();
  const sceneSetting = (input.sceneSetting ?? DEFAULT_SCENE_SETTING).trim();
  const sceneLine = sceneSetting.toLowerCase().includes("@location_view1")
    ? sceneSetting
    : `Shown in @location_view1. ${sceneSetting}`;

  const body = shots
    .map((shot) => {
      const lines = [
        `--- SHOT ${shot.index} ---`,
        `[${padTimecode(shot.startSeconds)} - ${padTimecode(shot.endSeconds)}]`,
        `- Camera: ${shot.camera}`,
        `- Action: ${shot.action}`,
      ];
      if (shot.dialogue) {
        lines.push(`- Dialogue: "${shot.dialogue}" ${shot.videoStem}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const prompt = [
    `[Art Style: ${artStyle}]`,
    "",
    `[Scene Setting: ${sceneLine}]`,
    "",
    body,
  ].join("\n");

  return { prompt, shots };
}

export function shotCardsFromCompiledShots(
  shots: CompiledShot[],
  hosts: { primary?: string; secondary?: string } = {},
): ShotCard[] {
  const primary = hosts.primary || "HOST_01";
  const secondary = hosts.secondary || "GUEST_01";
  return shots.map((shot) => {
    const hostId = shot.speaker === "secondary" ? secondary : primary;
    const meta = lookupMetaHuman(hostId);
    return {
      shotId: `shot_${shot.index}`,
      speakerId: meta?.id ?? hostId,
      dialogueText: shot.dialogue || shot.action,
      characterModelId: meta?.id ?? hostId,
      motionPrompt: shot.action,
      cameraAngle: shot.camera,
    };
  });
}
