import { describe, expect, it } from "vitest";
import { RedstoneSimulator } from "../engine/redstoneSimulator";
import { DungeonsLootEngine } from "../engine/dungeonsLootEngine";
import { CraftingSolverEngine } from "../engine/craftingSolver";
import { LegendsRtsDispatcher } from "../engine/legendsRtsDispatcher";
import minecraftRouter from "./minecraftApiRouter";

describe("Minecraft engine APIs", () => {
  it("exports an Express router with the four Minecraft routes", () => {
    const stack = (
      minecraftRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
      }
    ).stack;
    const paths = stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => Boolean(path));
    expect(paths).toEqual([
      "/crafting/solve",
      "/redstone/propagate",
      "/dungeons/loot",
      "/legends/spawn",
    ]);
  });

  it("solves a stick crafting tree", () => {
    const tree = new CraftingSolverEngine().solveCraftingTree("minecraft:stick", 4);
    expect(tree.rawMaterialsNeeded["minecraft:oak_log"]).toBe(1);
  });

  it("propagates redstone dust power along a line", () => {
    const sim = new RedstoneSimulator();
    sim.setNode({ x: 0, y: 64, z: 0, type: "dust" });
    sim.setNode({ x: 1, y: 64, z: 0, type: "dust" });
    sim.propagateSignal(0, 64, 0, 15);
    expect(sim.getNodePower(0, 64, 0)).toBe(15);
    expect(sim.getNodePower(1, 64, 0)).toBe(14);
  });

  it("rolls ancient hunt loot at the requested power", () => {
    const loot = new DungeonsLootEngine(() => 0.99);
    const drop = loot.rollDrop(25, true);
    expect(drop.rarity).toBe("LEGENDARY");
    expect(drop.power).toBe(25);
    expect(drop.ancientHunt).toBe(true);
  });

  it("spawns a plank golem for 10 lapis", () => {
    const rts = new LegendsRtsDispatcher();
    const unit = rts.spawnUnit("PLANK_GOLEM", { x: 1, y: 64, z: 2 });
    expect(unit?.type).toBe("PLANK_GOLEM");
    expect(rts.getUnitCount()).toBe(1);
    expect(rts.getResources().lapis).toBe(90);
  });
});
