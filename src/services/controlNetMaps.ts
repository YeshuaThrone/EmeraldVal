import sharp from "sharp";

export interface ProcessedControlMaps {
  lineartBuffer: Buffer;
  depthBuffer: Buffer;
  mimeType: string;
}

export async function processControlNetBuffers(
  inputBuffer: Buffer,
): Promise<ProcessedControlMaps> {
  const lineartBuffer = await sharp(inputBuffer)
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
    })
    .negate()
    .png()
    .toBuffer();

  const depthBuffer = await sharp(inputBuffer)
    .grayscale()
    .linear(1.5, -0.2)
    .blur(1.5)
    .png()
    .toBuffer();

  return {
    lineartBuffer,
    depthBuffer,
    mimeType: "image/png",
  };
}

/**
 * Downloads a source keyframe, applies edge detection (Lineart)
 * and luminosity mapping (Depth proxy), returning ready-to-upload Buffers.
 */
export async function generateControlNetMaps(
  imageUrl: string,
): Promise<ProcessedControlMaps> {
  if (!imageUrl.trim()) {
    throw new Error("imageUrl is required");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download keyframe (${response.status})`);
  }
  const inputBuffer = Buffer.from(await response.arrayBuffer());
  return processControlNetBuffers(inputBuffer);
}
