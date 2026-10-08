import sharp from "sharp";

export interface LightingPassConfig {
  sunAngleDegrees: number; // 0-360 degrees
  shadowIntensity: number; // 0.0 (none) to 1.0 (deep shadow)
  ambientColorHex: string; // e.g. '#1e1b4b' for night, '#fef3c7' for golden hour
  celSteps: number; // e.g. 2 for hard anime shade, 4 for smooth toon
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseLightingPassConfig(raw: unknown): LightingPassConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("lighting pass config is invalid");
  }
  const record = raw as Record<string, unknown>;
  const sunAngleDegrees = Number(record.sunAngleDegrees);
  const shadowIntensity = Number(record.shadowIntensity);
  const celSteps = Number(record.celSteps);
  const ambientColorHex =
    typeof record.ambientColorHex === "string" ? record.ambientColorHex.trim() : "";
  if (!Number.isFinite(sunAngleDegrees)) {
    throw new Error("sunAngleDegrees must be a number");
  }
  if (!Number.isFinite(shadowIntensity)) {
    throw new Error("shadowIntensity must be a number");
  }
  if (!Number.isFinite(celSteps) || celSteps < 2) {
    throw new Error("celSteps must be an integer of at least 2");
  }
  if (!HEX_RE.test(ambientColorHex)) {
    throw new Error("ambientColorHex must be a #RGB or #RRGGBB color");
  }
  return {
    sunAngleDegrees: ((sunAngleDegrees % 360) + 360) % 360,
    shadowIntensity: clamp(shadowIntensity, 0, 1),
    ambientColorHex,
    celSteps: Math.round(celSteps),
  };
}

/**
 * Applies a directional light mask and tint overlay to a cartoon asset buffer.
 */
export async function applyCelShadingPass(
  inputBuffer: Buffer,
  config: LightingPassConfig,
): Promise<Buffer> {
  const lighting = parseLightingPassConfig(config);
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 450;

  const rad = (lighting.sunAngleDegrees * Math.PI) / 180;
  const x2 = Math.round(50 + 50 * Math.cos(rad));
  const y2 = Math.round(50 + 50 * Math.sin(rad));

  const shadowSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sunGrad" x1="50%" y1="50%" x2="${x2}%" y2="${y2}%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="1.0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="${lighting.shadowIntensity}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#sunGrad)" />
    </svg>
  `;

  const paletteColours = Math.min(256, Math.max(8, lighting.celSteps * 16));

  return sharp(inputBuffer)
    .composite([
      {
        input: Buffer.from(shadowSvg),
        blend: "multiply",
      },
      {
        input: {
          create: {
            width,
            height,
            channels: 4,
            background: lighting.ambientColorHex,
          },
        },
        blend: "soft-light",
      },
    ])
    .png({ palette: true, colours: paletteColours })
    .toBuffer();
}

export async function applyCelShadingPassFromUrl(
  imageUrl: string,
  config: LightingPassConfig,
): Promise<Buffer> {
  if (!imageUrl.trim()) {
    throw new Error("imageUrl is required");
  }
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download keyframe (${response.status})`);
  }
  return applyCelShadingPass(
    Buffer.from(await response.arrayBuffer()),
    config,
  );
}
