import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { AdvancedRedstoneSimulator } from "@/config/engine/advancedRedstoneSimulator";
import { CraftingSolverEngine } from "@/config/engine/craftingSolver";
import { MultiAgentPathfinder } from "@/config/engine/multiAgentPathfinder";
import { OctreeNode } from "@/config/engine/octreePartition";
import { TerrainGenerator } from "@/config/engine/terrainGenerator";
import { VarIntProtocol } from "@/config/engine/varIntProtocol";
import { prometheusExporter } from "@/config/metrics/metricsRouter";
import { SpatialRedstoneBroadcaster } from "@/config/minecraft/spatialRedstoneBroadcaster";
import { ChunkStorageManager, type ChunkRedisClient } from "@/config/minecraft/chunkStorageManager";

class MemoryRedis implements ChunkRedisClient {
  store = new Map<string, Record<string, string>>();
  async connect() {}
  async hSet(key: string, value: Record<string, string>) {
    this.store.set(key, { ...(this.store.get(key) ?? {}), ...value });
  }
  async hGetAll(key: string) {
    return { ...(this.store.get(key) ?? {}) };
  }
  async quit() {}
}

class MockSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sent: Buffer[] = [];
  send(data: Buffer) {
    this.sent.push(data);
  }
}

class MockWss extends EventEmitter {
  close() {}
}

describe("Minecraft engine system full suite", () => {
  beforeEach(() => {
    MultiAgentPathfinder.clearReservations();
  });

  it("generates terrain, persists a chunk, and frames a nearby block change", async () => {
    const terrain = new TerrainGenerator().generateChunk(0, 0, 1337);
    const surface = terrain.find(
      (block) =>
        block.blockId === "minecraft:grass_block" || block.blockId === "minecraft:sand",
    );
    expect(surface).toBeTruthy();

    const redis = new MemoryRedis();
    const storage = new ChunkStorageManager("redis://localhost:6379", {
      redis,
      autoConnect: false,
    });
    const localX = ((surface!.x % 16) + 16) % 16;
    const localZ = ((surface!.z % 16) + 16) % 16;
    await storage.saveChunk({
      chunkX: 0,
      chunkZ: 0,
      dimension: "overworld",
      blocks: new Map([
        [
          `${localX},${surface!.y},${localZ}`,
          {
            x: localX,
            y: surface!.y,
            z: localZ,
            blockId: surface!.blockId,
          },
        ],
      ]),
    });
    const loaded = await storage.loadChunk("overworld", 0, 0);
    expect(loaded.blocks.get(`${localX},${surface!.y},${localZ}`)?.blockId).toBe(
      surface!.blockId,
    );
    await storage.close();

    const octree = new OctreeNode({
      min: { x: -1000, y: -64, z: -1000 },
      max: { x: 1000, y: 320, z: 1000 },
    });
    octree.insert({ id: "viewer", position: { x: surface!.x, y: surface!.y, z: surface!.z } });
    octree.insert({ id: "afar", position: { x: 900, y: 64, z: 900 } });
    const nearby = octree.queryRange({
      min: { x: surface!.x - 64, y: surface!.y - 64, z: surface!.z - 64 },
      max: { x: surface!.x + 64, y: surface!.y + 64, z: surface!.z + 64 },
    });
    expect(nearby.map((entity) => entity.id)).toContain("viewer");
    expect(nearby.map((entity) => entity.id)).not.toContain("afar");

    const packet = VarIntProtocol.createPacket(
      0x0f,
      Buffer.from(
        JSON.stringify({
          x: surface!.x,
          y: surface!.y,
          z: surface!.z,
          blockId: "minecraft:redstone_block",
        }),
      ),
    );
    const length = VarIntProtocol.readVarInt(packet);
    const packetId = VarIntProtocol.readVarInt(packet, length.bytesRead);
    expect(packetId.value).toBe(0x0f);

    const wss = new MockWss();
    const broadcaster = new SpatialRedstoneBroadcaster(0, { wss: wss as never });
    const viewer = new MockSocket();
    const afar = new MockSocket();
    broadcaster.upsertClient({
      id: "viewer",
      position: { x: surface!.x, y: surface!.y, z: surface!.z },
      renderDistance: 64,
      ws: viewer as never,
    });
    broadcaster.upsertClient({
      id: "afar",
      position: { x: 900, y: 64, z: 900 },
      renderDistance: 64,
      ws: afar as never,
    });
    broadcaster.broadcastBlockEvent(
      surface!.x,
      surface!.y,
      surface!.z,
      "minecraft:redstone_block",
    );
    expect(viewer.sent).toHaveLength(1);
    expect(afar.sent).toHaveLength(0);
    broadcaster.stop();

    prometheusExporter.incrementCounter("minecraft_chunk_saves_total", 1);
    const metrics = prometheusExporter.getPrometheusMetrics();
    expect(metrics).toContain("minecraft_engine_up 1");
    expect(metrics).toContain("minecraft_chunk_saves_total");
  });

  it("keeps redstone, pathfinding, and crafting engines coherent", () => {
    const redstone = new AdvancedRedstoneSimulator();
    redstone.setNode({
      x: 10,
      y: 64,
      z: 10,
      type: "COMPARATOR",
      power: 0,
      isSubtractMode: true,
    });
    expect(redstone.evaluateNode(10, 64, 10, 15, 4)).toBe(11);
    redstone.setNode({
      x: 20,
      y: 64,
      z: 20,
      type: "REPEATER",
      power: 0,
      delayTicks: 1,
    });
    expect(redstone.evaluateNode(20, 64, 20, 2, 0)).toBe(15);

    const blocked = { x: 5, y: 64, z: 5 };
    expect(MultiAgentPathfinder.reservePosition("agent-1", blocked)).toBe(true);
    const path = MultiAgentPathfinder.findPath(
      { x: 0, y: 64, z: 5 },
      { x: 10, y: 64, z: 5 },
    );
    expect(
      path.some(
        (step) => step.x === blocked.x && step.y === blocked.y && step.z === blocked.z,
      ),
    ).toBe(false);
    expect(path.at(-1)).toEqual({ x: 10, y: 64, z: 5 });
    MultiAgentPathfinder.releasePosition(blocked);

    const tree = new CraftingSolverEngine().solveCraftingTree(
      "minecraft:netherite_chestplate",
      1,
    );
    expect(tree.rawMaterialsNeeded["minecraft:ancient_debris"]).toBe(4);
    expect(tree.executionSteps.at(-1)?.craftingTableType).toBe("SMITHING_TABLE");
  });
});
