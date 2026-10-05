import { describe, expect, it } from "vitest";
import {
  LAPIS_SPAWN_COST,
  LegendsRtsDispatcher,
  compileLegendsUnitPrompt,
} from "./legendsRtsDispatcher";

describe("LegendsRtsDispatcher", () => {
  it("spawns a plank golem, spends lapis, and rallies the banner", () => {
    const rts = new LegendsRtsDispatcher();
    const golem = rts.spawnUnit("PLANK_GOLEM", { x: 1, y: 64, z: 2 });
    expect(golem?.unitId).toBe("unit_1");
    expect(golem?.currentTask).toBe("IDLE");
    expect(rts.getResources().lapis).toBe(100 - LAPIS_SPAWN_COST);
    expect(rts.getUnitCount()).toBe(1);

    rts.issueBannerCommand("RALLY_ALL", { x: 10, y: 64, z: 10 });
    expect(rts.listUnits()[0]?.currentTask).toBe("RALLIED");
    expect(rts.listUnits()[0]?.position).toEqual({ x: 10, y: 64, z: 10 });
    expect(compileLegendsUnitPrompt(rts.listUnits()[0]!)).toContain(
      "[MINECRAFT_LEGENDS]",
    );
  });

  it("charges a portal and refuses spawn without lapis", () => {
    const rts = new LegendsRtsDispatcher();
    rts.spawnUnit("FIRST_OF_STONE", { x: 0, y: 70, z: 0 });
    rts.issueBannerCommand(
      "CHARGE_TARGET",
      { x: 40, y: 70, z: 8 },
      "nether_portal_east",
    );
    expect(rts.listUnits()[0]?.currentTask).toBe("ATTACKING_STRUCTURE");
    expect(rts.listUnits()[0]?.targetBuildingId).toBe("nether_portal_east");

    while (rts.spawnUnit("CREEPER_ALLY", { x: 0, y: 64, z: 0 })) {
      /* drain lapis */
    }
    expect(rts.spawnUnit("SKELETON_ALLY", { x: 0, y: 64, z: 0 })).toBeNull();
  });
});
