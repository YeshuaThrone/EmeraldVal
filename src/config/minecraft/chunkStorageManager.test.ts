import { describe, expect, it } from "vitest";
import {
  ChunkStorageManager,
  type BlockData,
  type ChunkRedisClient,
  type WorldChunk,
} from "./chunkStorageManager";

class MemoryRedis implements ChunkRedisClient {
  store = new Map<string, Record<string, string>>();
  connected = false;
  closed = false;

  async connect() {
    this.connected = true;
  }

  async hSet(key: string, value: Record<string, string>) {
    const existing = this.store.get(key) ?? {};
    this.store.set(key, { ...existing, ...value });
  }

  async hGetAll(key: string) {
    return { ...(this.store.get(key) ?? {}) };
  }

  async quit() {
    this.closed = true;
  }
}

function cobble(x: number, y: number, z: number): BlockData {
  return { x, y, z, blockId: "minecraft:cobblestone" };
}

describe("ChunkStorageManager", () => {
  it("round-trips a chunk hash under chunk:dimension:x:z", async () => {
    const redis = new MemoryRedis();
    const storage = new ChunkStorageManager("redis://localhost:6379", {
      redis,
      autoConnect: false,
    });

    const chunk: WorldChunk = {
      chunkX: 4,
      chunkZ: -2,
      dimension: "overworld",
      blocks: new Map([
        ["3,64,7", cobble(3, 64, 7)],
        [
          "3,65,7",
          {
            x: 3,
            y: 65,
            z: 7,
            blockId: "minecraft:oak_door",
            stateData: { facing: "north", half: "lower" },
          },
        ],
      ]),
    };

    await storage.saveChunk(chunk);
    expect(redis.store.has("chunk:overworld:4:-2")).toBe(true);

    const loaded = await storage.loadChunk("overworld", 4, -2);
    expect(loaded.chunkX).toBe(4);
    expect(loaded.chunkZ).toBe(-2);
    expect(loaded.blocks.get("3,64,7")?.blockId).toBe("minecraft:cobblestone");
    expect(loaded.blocks.get("3,65,7")?.stateData).toEqual({
      facing: "north",
      half: "lower",
    });

    await storage.close();
    expect(redis.closed).toBe(true);
  });

  it("returns an empty block map for a missing chunk", async () => {
    const storage = new ChunkStorageManager("redis://localhost:6379", {
      redis: new MemoryRedis(),
      autoConnect: false,
    });
    const loaded = await storage.loadChunk("nether", 0, 0);
    expect(loaded.blocks.size).toBe(0);
    expect(loaded.dimension).toBe("nether");
  });

  it("rejects blocks outside the local 16x height bounds", async () => {
    const storage = new ChunkStorageManager("redis://localhost:6379", {
      redis: new MemoryRedis(),
      autoConnect: false,
    });
    await expect(
      storage.saveChunk({
        chunkX: 0,
        chunkZ: 0,
        dimension: "overworld",
        blocks: new Map([["16,64,0", cobble(16, 64, 0)]]),
      }),
    ).rejects.toThrow(/x must be an integer from 0 to 15/);
  });
});
