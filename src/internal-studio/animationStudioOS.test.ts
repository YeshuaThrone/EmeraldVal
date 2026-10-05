import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertStudioAccess, assertStudioStaff, verifyHs256Jwt } from "./auth";
import { compileAnimationPrompt } from "./api/compilePrompt";
import { buildFfmpegConcatArgs } from "./api/ffmpegStitcher";
import { buildSeeDancePayload, parseGenerateShotBody } from "./api/generateShot";
import {
  parseObviousWebhook,
  verifyObviousSignature,
} from "./api/obviousWebhooks";
import { isInternalStudioRole } from "./config/studioRoles";
import { resolveStudioStaff } from "./config/staffAllowlist";
import { parseCharacterModelBody } from "./api/characterModelsRepository";
import { parseShotCardBody } from "./api/shotCardsRepository";

const schema = readFileSync(
  path.join(import.meta.dirname, "config/studioSchema.sql"),
  "utf8",
);

describe("AnimationStudioOS schema", () => {
  it("defines studio roles, studio_shots, RLS, and internal-only policy", () => {
    expect(schema).toContain(
      "CREATE TYPE studio_role AS ENUM ('subscriber', 'hollywood_editor', 'director', 'studio_admin')",
    );
    expect(schema).toContain(
      "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS studio_role studio_role DEFAULT 'subscriber'",
    );
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.studio_shots");
    expect(schema).toContain("project_id TEXT NOT NULL");
    expect(schema).toContain("shot_id TEXT UNIQUE NOT NULL");
    expect(schema).toContain("animation_style TEXT");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.character_models");
    expect(schema).toContain("lora_checkpoint_url TEXT NOT NULL");
    expect(schema).toContain("turnaround_sheet_url TEXT NOT NULL");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.shot_cards");
    expect(schema).toContain("assigned_character_id UUID REFERENCES public.character_models(id)");
    expect(schema).toContain(
      "CONSTRAINT unique_shot_per_scene UNIQUE (project_id, scene_number, shot_number)",
    );
    expect(schema).toContain('CREATE POLICY "Studio Team Character Models"');
    expect(schema).toContain('CREATE POLICY "Studio Team Shot Cards"');
    expect(schema).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(schema).toContain("match_character_embedding");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.shot_render_jobs");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.shot_motion_trajectories");
    expect(schema).toContain("idx_motion_trajectories_shot");
    expect(schema).toContain('CREATE POLICY "Studio Team Motion Trajectories"');
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.scene_structures");
    expect(schema).toContain('CREATE POLICY "Studio Team Scene Structures"');
    expect(schema).toContain("ALTER TABLE public.studio_shots ENABLE ROW LEVEL SECURITY");
    expect(schema).toContain('CREATE POLICY "Studio Team Full Access"');
    expect(schema).toContain(
      "(auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')",
    );
    expect(isInternalStudioRole("subscriber")).toBe(false);
    expect(isInternalStudioRole("studio_admin")).toBe(true);
  });
});

describe("studio staff allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("makes the owner studio_admin and extra emails hollywood_editor", () => {
    vi.stubEnv(
      "ANIMATION_STUDIO_OS_STAFF",
      "maya@wurfi.tv,ops@wurfi.tv:director",
    );
    expect(resolveStudioStaff("3bbullion@gmail.com")?.role).toBe("studio_admin");
    expect(resolveStudioStaff("maya@wurfi.tv")?.role).toBe("hollywood_editor");
    expect(resolveStudioStaff("ops@wurfi.tv")?.role).toBe("director");
    expect(resolveStudioStaff("fan@example.com")).toBeNull();
  });
});

describe("assertStudioStaff", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("denies subscribers and missing secrets", () => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "");
    expect(
      assertStudioStaff(
        new Headers({
          "x-studio-staff-email": "3bbullion@gmail.com",
          "x-studio-staff-key": "x",
        }),
      ).ok,
    ).toBe(false);

    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
    expect(
      assertStudioStaff(
        new Headers({
          "x-studio-staff-email": "fan@example.com",
          "x-studio-staff-key": "studio-key",
        }),
      ).ok,
    ).toBe(false);

    const allowed = assertStudioStaff(
      new Headers({
        "x-studio-staff-email": "3bbullion@gmail.com",
        "x-studio-staff-key": "studio-key",
      }),
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.role).toBe("studio_admin");
  });
});

describe("compileAnimationPrompt", () => {
  it("emits timestamped multi-shot text with asset tags after dialogue", () => {
    const { prompt, shots } = compileAnimationPrompt({
      script: [
        'PRIMARY: I can\'t believe we have to re-render this entire act.',
        'SECONDARY: Relax, the Obvious OS pipeline already queued the new shots.',
      ].join("\n"),
    });
    expect(shots).toHaveLength(2);
    expect(prompt).toContain("[Art Style:");
    expect(prompt).toContain("@location_view1");
    expect(prompt).toContain("--- SHOT 1 ---");
    expect(prompt).toContain("[00:00 - 00:04]");
    expect(prompt).toContain("@image1");
    expect(prompt).toContain(
      '"I can\'t believe we have to re-render this entire act." @video1',
    );
    expect(prompt).toContain("@video2");
    expect(prompt.trim().endsWith("@video2")).toBe(true);
  });
});

describe("ffmpeg stitcher", () => {
  it("rejects path escape and builds concat args", () => {
    expect(() =>
      buildFfmpegConcatArgs({
        clipPaths: ["../etc/passwd", "b.mp4"],
        outputFileName: "out.mp4",
        workDir: "/tmp/internal-studio",
      }),
    ).toThrow(/escapes/);

    const planned = buildFfmpegConcatArgs({
      clipPaths: ["a.mp4", "b.mp4"],
      outputFileName: "out.mp4",
      workDir: "/tmp/internal-studio",
    });
    expect(planned.args).toContain("concat");
    expect(planned.outputPath).toBe("/tmp/internal-studio/out.mp4");
  });
});

describe("Obvious webhooks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a signed shot.ready payload", () => {
    vi.stubEnv("OBVIOUS_WEBHOOK_SECRET", "hook-secret");
    const raw = JSON.stringify({
      event: "shot.ready",
      shotId: "act1-shot-1",
      videoUrl: "https://example.com/shot.mp4",
    });
    const signature = createHmac("sha256", "hook-secret")
      .update(raw)
      .digest("hex");
    expect(verifyObviousSignature(raw, signature)).toBe(true);
    expect(parseObviousWebhook(JSON.parse(raw)).event).toBe("shot.ready");
  });
});

function signStudioJwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("studio JWT access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows directors and rejects subscribers", () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "jwt-secret");
    const director = signStudioJwt(
      { email: "ops@wurfi.tv", studio_role: "director" },
      "jwt-secret",
    );
    const allowed = assertStudioAccess(
      new Headers({ authorization: `Bearer ${director}` }),
    );
    expect(allowed.ok).toBe(true);
    expect(verifyHs256Jwt(director, "jwt-secret")?.studio_role).toBe("director");

    const fan = signStudioJwt(
      { email: "fan@example.com", studio_role: "subscriber" },
      "jwt-secret",
    );
    expect(
      assertStudioAccess(new Headers({ authorization: `Bearer ${fan}` })).ok,
    ).toBe(false);
  });
});

describe("character models and shot cards", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";

  it("parses a LoRA character model and a unique scene/shot card", () => {
    const character = parseCharacterModelBody({
      projectId,
      characterName: "Maya",
      loraCheckpointUrl: "https://cdn.example/maya.safetensors",
      turnaroundSheetUrl: "https://cdn.example/maya-turnaround.png",
      faceEmbeddingId: "face-maya-01",
    });
    expect(character.characterName).toBe("Maya");
    expect(character.loraCheckpointUrl).toContain("maya.safetensors");

    const card = parseShotCardBody({
      projectId,
      sceneNumber: 2,
      shotNumber: 4,
      scriptText: "Maya turns into the key light.",
      cameraMotion: "Dynamic Anime Zoom",
      assignedCharacterId: "22222222-2222-4222-8222-222222222222",
      promptOverride: "Hold on the eyes.",
    });
    expect(card.cameraMotion).toBe("Dynamic Anime Zoom");
    expect(card.sceneNumber).toBe(2);
    expect(card.assignedCharacterId).toContain("2222");
  });

  it("rejects missing turnaround sheets and overlong camera moves", () => {
    expect(() =>
      parseCharacterModelBody({
        projectId,
        characterName: "Maya",
        loraCheckpointUrl: "https://cdn.example/maya.safetensors",
      }),
    ).toThrow(/turnaroundSheetUrl is required/);

    expect(() =>
      parseShotCardBody({
        projectId,
        sceneNumber: 1,
        shotNumber: 1,
        scriptText: "Hold.",
        cameraMotion: "X".repeat(51),
      }),
    ).toThrow(/cameraMotion must be 50 characters or fewer/);
  });
});

describe("SeeDance generate-shot payload", () => {
  it("maps the modal fields into a 3D conditioned dispatch", () => {
    const input = parseGenerateShotBody({
      shotId: "act1-01",
      projectId: "pilot",
      scriptText: "Tailor sewing costume while camera orbits steady",
      characterSheetUrl: "https://cdn.example/sheet.png",
      startingFrameUrl: "https://cdn.example/frame.png",
      cameraMotionVideoUrl: "https://cdn.example/orbit.mp4",
      propReferenceUrl: "https://cdn.example/prop.png",
    });
    const payload = buildSeeDancePayload(input);
    expect(payload.engine).toBe("SeeDance");
    expect(payload.references["@image1"]).toBe("https://cdn.example/sheet.png");
    expect(payload.references.cameraMotionVideo).toContain("orbit.mp4");
  });
});

describe("HouseMaterialSelector", () => {
  it("builds Palais Rose housing prompts from the material catalog", () => {
    const src = readFileSync(
      path.join(import.meta.dirname, "components/HouseMaterialSelector.tsx"),
      "utf8",
    );
    expect(src).toContain("Cartoon Housing & Material Builder");
    expect(src).toContain("compileCartoonStructurePrompt");
    expect(src).toContain("PALAIS_ROSE_MANSION");
    expect(src).toContain("GHIBLI_WATERCOLOR");
  });
});

describe("ShotGeneratorModal", () => {
  it("posts 3D conditioned fields to /api/generate-shot", () => {
    const src = readFileSync(
      path.join(import.meta.dirname, "components/ShotGeneratorModal.tsx"),
      "utf8",
    );
    expect(src).toContain('fetch("/api/generate-shot"');
    expect(src).toContain("characterSheetUrl");
    expect(src).toContain("startingFrameUrl");
    expect(src).toContain("cameraMotionVideoUrl");
    expect(src).toContain("propReferenceUrl");
    expect(src).toContain("Dispatching 3D vector parameters to SeeDance");
  });
});
