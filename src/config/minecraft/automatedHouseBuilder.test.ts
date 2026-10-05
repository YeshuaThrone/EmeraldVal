import { describe, expect, it } from "vitest";
import {
  createStockedHouseBuilderAgent,
  executeAutomated3DHouseBuilder,
} from "./automatedHouseBuilder";

describe("executeAutomated3DHouseBuilder", () => {
  it("lays cobblestone, raises plank walls with a door gap, and caps stairs", () => {
    const agent = createStockedHouseBuilderAgent();
    const result = executeAutomated3DHouseBuilder(agent, {
      width: 5,
      length: 5,
      height: 4,
    });

    const placed = agent.getPlacedBlocks();
    const cobble = placed.filter((block) => block.itemId === "minecraft:cobblestone");
    const planks = placed.filter((block) => block.itemId === "minecraft:oak_planks");
    const stairs = placed.filter(
      (block) => block.itemId === "minecraft:stone_brick_stairs",
    );

    expect(result.placedCount).toBe(placed.length);
    expect(cobble.length).toBe(25);
    expect(planks.length).toBeGreaterThan(0);
    expect(planks.length).toBeLessThan(5 * 4 * 4);
    expect(stairs.length).toBe(3);
    expect(agent.getLogs().some((line) => line.includes("Script Complete"))).toBe(
      true,
    );
    expect(result.position.y).toBeGreaterThan(64);
  });

  it("rejects non-positive dimensions", () => {
    const agent = createStockedHouseBuilderAgent();
    expect(() =>
      executeAutomated3DHouseBuilder(agent, { width: 0, length: 5, height: 4 }),
    ).toThrow(/positive integers/);
  });
});
