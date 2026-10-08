import { describe, expect, it } from "vitest";
import { TerrainGenerator } from "./terrainGenerator";

function column(
  blocks: Array<{ x: number; y: number; z: number; blockId: string }>,
  x: number,
  z: number,
) {
  return blocks
    .filter((block) => block.x === x && block.z === z)
    .sort((a, b) => a.y - b.y);
}

describe("TerrainGenerator", () => {
  const generator = new TerrainGenerator();

  it("fills a 16x16 chunk with bedrock, dirt, and grass or sand", () => {
    const blocks = generator.generateChunk(0, 0, 1337);
    const coords = new Set(blocks.map((block) => `${block.x},${block.z}`));
    expect(coords.size).toBe(16 * 16);

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const stack = column(blocks, x, z);
        expect(stack[0]).toMatchObject({ y: -64, blockId: "minecraft:bedrock" });
        const surface = [...stack].reverse().find((block) =>
          block.blockId === "minecraft:grass_block" || block.blockId === "minecraft:sand",
        );
        expect(surface).toBeTruthy();
        if (surface!.y >= generator.getSeaLevel()) {
          expect(surface!.blockId).toBe("minecraft:grass_block");
          expect(stack.some((block) => block.blockId === "minecraft:water")).toBe(false);
        } else {
          expect(surface!.blockId).toBe("minecraft:sand");
          const water = stack.filter((block) => block.blockId === "minecraft:water");
          expect(water[0]?.y).toBe(surface!.y + 1);
          expect(water.at(-1)?.y).toBe(generator.getSeaLevel());
        }
        const dirt = stack.filter((block) => block.blockId === "minecraft:dirt");
        expect(dirt.length).toBeGreaterThan(0);
        expect(dirt.every((block) => block.y > surface!.y - 4 && block.y < surface!.y)).toBe(
          true,
        );
      }
    }
  });

  it("is deterministic for a seed and uses world coordinates across chunks", () => {
    const a = generator.generateChunk(2, -1, 42);
    const b = generator.generateChunk(2, -1, 42);
    expect(a).toEqual(b);

    const neighbor = generator.generateChunk(3, -1, 42);
    const local = column(a, 15, 0);
    const next = column(neighbor, 0, 0);
    expect(local.map((block) => block.y + block.blockId).join()).not.toBe(
      next.map((block) => block.y + block.blockId).join(),
    );
  });
});
