import { createClient, type RedisClientType } from "redis";

export interface BlockData {
  x: number; // Local 0-15
  y: number; // World -64 to 320
  z: number; // Local 0-15
  blockId: string;
  stateData?: Record<string, unknown>;
}

export interface WorldChunk {
  chunkX: number;
  chunkZ: number;
  dimension: string;
  blocks: Map<string, BlockData>;
}

export interface ChunkRedisClient {
  connect(): Promise<unknown>;
  hSet(key: string, value: Record<string, string>): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  quit(): Promise<unknown>;
}

export interface ChunkStorageManagerOptions {
  redis?: ChunkRedisClient;
  autoConnect?: boolean;
}

function assertBlock(block: BlockData): void {
  if (![block.x, block.y, block.z].every(Number.isFinite)) {
    throw new Error("Block coordinates must be numbers");
  }
  if (!Number.isInteger(block.x) || block.x < 0 || block.x > 15) {
    throw new Error("Block x must be an integer from 0 to 15");
  }
  if (!Number.isInteger(block.z) || block.z < 0 || block.z > 15) {
    throw new Error("Block z must be an integer from 0 to 15");
  }
  if (!Number.isInteger(block.y) || block.y < -64 || block.y > 320) {
    throw new Error("Block y must be an integer from -64 to 320");
  }
  if (typeof block.blockId !== "string" || !block.blockId.trim()) {
    throw new Error("blockId is required");
  }
}

function parseStoredBlock(localKey: string, jsonStr: string): BlockData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid block JSON at ${localKey}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid block payload at ${localKey}`);
  }
  const record = parsed as Record<string, unknown>;
  const block: BlockData = {
    x: Number(record.x),
    y: Number(record.y),
    z: Number(record.z),
    blockId: typeof record.blockId === "string" ? record.blockId : "",
    ...(record.stateData && typeof record.stateData === "object"
      ? { stateData: record.stateData as Record<string, unknown> }
      : {}),
  };
  assertBlock(block);
  return block;
}

export class ChunkStorageManager {
  private redis: ChunkRedisClient;

  constructor(
    redisUrl = "redis://localhost:6379",
    options: ChunkStorageManagerOptions = {},
  ) {
    this.redis = options.redis ?? (createClient({ url: redisUrl }) as RedisClientType);
    if (options.autoConnect !== false && !options.redis) {
      this.redis.connect().catch(console.error);
    }
  }

  private getChunkKey(dimension: string, chunkX: number, chunkZ: number): string {
    return `chunk:${dimension}:${chunkX}:${chunkZ}`;
  }

  /**
   * Saves a chunk's blocks to Redis as a serialized hash map.
   */
  public async saveChunk(chunk: WorldChunk): Promise<void> {
    if (!chunk.dimension.trim()) {
      throw new Error("dimension is required");
    }
    if (![chunk.chunkX, chunk.chunkZ].every(Number.isInteger)) {
      throw new Error("chunkX and chunkZ must be integers");
    }

    const key = this.getChunkKey(chunk.dimension, chunk.chunkX, chunk.chunkZ);
    const serializedData: Record<string, string> = {};

    chunk.blocks.forEach((block, localKey) => {
      assertBlock(block);
      serializedData[localKey] = JSON.stringify(block);
    });

    if (Object.keys(serializedData).length > 0) {
      await this.redis.hSet(key, serializedData);
    }
  }

  /**
   * Loads a chunk from Redis by spatial coordinates.
   */
  public async loadChunk(
    dimension: string,
    chunkX: number,
    chunkZ: number,
  ): Promise<WorldChunk> {
    const key = this.getChunkKey(dimension, chunkX, chunkZ);
    const rawData = await this.redis.hGetAll(key);
    const blocks = new Map<string, BlockData>();

    Object.entries(rawData).forEach(([localKey, jsonStr]) => {
      blocks.set(localKey, parseStoredBlock(localKey, jsonStr));
    });

    return { chunkX, chunkZ, dimension, blocks };
  }

  public async close(): Promise<void> {
    await this.redis.quit();
  }
}
