export interface GeneratedBlock {
  x: number;
  y: number;
  z: number;
  blockId: string;
}

export class TerrainGenerator {
  private readonly seaLevel = 62;

  public getSeaLevel(): number {
    return this.seaLevel;
  }

  /**
   * Simple multi-octave pseudo-random gradient noise function for 2D heightmap generation.
   */
  private generateHeight(x: number, z: number, seed: number): number {
    const scale = 0.05;
    const octave1 = Math.sin(x * scale + seed) * Math.cos(z * scale + seed) * 12;
    const octave2 =
      Math.sin(x * scale * 2 + seed * 1.5) * Math.cos(z * scale * 2 + seed * 1.5) * 6;

    return Math.floor(this.seaLevel + octave1 + octave2);
  }

  /**
   * Generates a complete 16x384x16 block chunk for given world coordinates.
   */
  public generateChunk(chunkX: number, chunkZ: number, seed = 1337): GeneratedBlock[] {
    if (![chunkX, chunkZ, seed].every(Number.isFinite)) {
      throw new Error("chunkX, chunkZ, and seed must be numbers");
    }

    const blocks: GeneratedBlock[] = [];

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const worldX = chunkX * 16 + x;
        const worldZ = chunkZ * 16 + z;
        const surfaceY = this.generateHeight(worldX, worldZ, seed);

        for (let y = -64; y <= surfaceY; y++) {
          let blockId = "minecraft:stone";

          if (y === surfaceY) {
            blockId = surfaceY >= this.seaLevel ? "minecraft:grass_block" : "minecraft:sand";
          } else if (y > surfaceY - 4) {
            blockId = "minecraft:dirt";
          } else if (y === -64) {
            blockId = "minecraft:bedrock";
          }

          blocks.push({ x, y, z, blockId });
        }

        // Fill sea level water
        for (let y = surfaceY + 1; y <= this.seaLevel; y++) {
          blocks.push({ x, y, z, blockId: "minecraft:water" });
        }
      }
    }

    return blocks;
  }
}
