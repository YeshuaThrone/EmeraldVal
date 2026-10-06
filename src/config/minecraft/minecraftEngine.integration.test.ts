import { beforeEach, describe, expect, test } from "vitest";
import { ChunkStorageManager, WorldChunk } from "../storage/chunkStorage";
import { MultiAgentPathfinder, Vector3D } from "../engine/multiAgentPathfinder";
import {
  AdvancedRedstoneSimulator,
  AdvancedRedstoneNode,
} from "../engine/advancedRedstoneSimulator";

describe("Minecraft Engine Full Stack Integration", () => {
  let redstoneEngine: AdvancedRedstoneSimulator;

  beforeEach(() => {
    redstoneEngine = new AdvancedRedstoneSimulator();
    MultiAgentPathfinder.clearReservations();
  });

  test("Multi-Agent Pathfinder respects collision locks", () => {
    const agent1Pos: Vector3D = { x: 5, y: 64, z: 5 };
    const agent2Start: Vector3D = { x: 0, y: 64, z: 5 };
    const target: Vector3D = { x: 10, y: 64, z: 5 };

    // Reserve position for Agent 1 directly in path of Agent 2
    const reserved = MultiAgentPathfinder.reservePosition("agent-1", agent1Pos);
    expect(reserved).toBe(true);

    // Calculate path for Agent 2 towards target
    const path = MultiAgentPathfinder.findPath(agent2Start, target);

    // Verify path stops or re-routes before collision coordinate (5, 64, 5)
    const hitsCollision = path.some(
      (step) => step.x === agent1Pos.x && step.y === agent1Pos.y && step.z === agent1Pos.z,
    );
    expect(hitsCollision).toBe(false);
    expect(path.at(-1)).toEqual(target);

    // Release reservation
    MultiAgentPathfinder.releasePosition(agent1Pos);
  });

  test("Advanced Redstone Simulator correctly computes Comparator subtraction mode", () => {
    const comparatorPos: AdvancedRedstoneNode = {
      x: 10,
      y: 64,
      z: 10,
      type: "COMPARATOR",
      power: 0,
      isSubtractMode: true,
    };

    redstoneEngine.setNode(comparatorPos);

    // Scenario 1: Rear signal (15), Side signal (4) => Output = 11
    let output = redstoneEngine.evaluateNode(10, 64, 10, 15, 4);
    expect(output).toBe(11);

    // Scenario 2: Side signal (15) > Rear signal (10) => Output = 0
    output = redstoneEngine.evaluateNode(10, 64, 10, 10, 15);
    expect(output).toBe(0);
  });

  test("Advanced Redstone Simulator Repeater boosts signal to maximum power", () => {
    const repeaterPos: AdvancedRedstoneNode = {
      x: 20,
      y: 64,
      z: 20,
      type: "REPEATER",
      power: 0,
      delayTicks: 1,
    };

    redstoneEngine.setNode(repeaterPos);

    // Attenuated input signal (power level 2) gets boosted back up to 15 by Repeater
    const output = redstoneEngine.evaluateNode(20, 64, 20, 2, 0);
    expect(output).toBe(15);
  });

  test("Chunk storage round-trips a locked waypoint block", async () => {
    const storage = new ChunkStorageManager("redis://localhost:6379", {
      redis: {
        async connect() {},
        async hSet() {},
        async hGetAll() {
          return {
            "5,64,5": JSON.stringify({
              x: 5,
              y: 64,
              z: 5,
              blockId: "minecraft:obsidian",
            }),
          };
        },
        async quit() {},
      },
      autoConnect: false,
    });
    const chunk: WorldChunk = await storage.loadChunk("overworld", 0, 0);
    expect(chunk.blocks.get("5,64,5")?.blockId).toBe("minecraft:obsidian");
    await storage.close();
  });
});
