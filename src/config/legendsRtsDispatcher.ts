export type UnitType =
  | "PLANK_GOLEM"
  | "COBBLESTONE_GOLEM"
  | "SKELETON_ALLY"
  | "CREEPER_ALLY"
  | "FIRST_OF_STONE";

export type RtsUnitTask = "IDLE" | "RALLIED" | "CHARGING" | "ATTACKING_STRUCTURE";

export type BannerCommand = "RALLY_ALL" | "CHARGE_TARGET";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RTSUnit {
  unitId: string;
  type: UnitType;
  position: Vec3;
  targetBuildingId?: string;
  currentTask: RtsUnitTask;
}

export interface LegendsResources {
  wood: number;
  stone: number;
  lapis: number;
  prismarine: number;
}

export const LAPIS_SPAWN_COST = 10;

export class LegendsRtsDispatcher {
  private activeUnits: RTSUnit[] = [];
  private resources: LegendsResources = {
    wood: 500,
    stone: 500,
    lapis: 100,
    prismarine: 50,
  };
  private nextUnit = 0;

  public spawnUnit(type: UnitType, spawnPos: Vec3): RTSUnit | null {
    if (this.resources.lapis < LAPIS_SPAWN_COST) {
      return null;
    }

    this.resources.lapis -= LAPIS_SPAWN_COST;
    this.nextUnit += 1;
    const newUnit: RTSUnit = {
      unitId: `unit_${this.nextUnit}`,
      type,
      position: { ...spawnPos },
      currentTask: "IDLE",
    };

    this.activeUnits.push(newUnit);
    return newUnit;
  }

  public issueBannerCommand(
    command: BannerCommand,
    targetPos: Vec3,
    targetBuildingId?: string,
  ) {
    this.activeUnits.forEach((unit) => {
      unit.position = { ...targetPos };
      if (command === "CHARGE_TARGET") {
        unit.currentTask = "ATTACKING_STRUCTURE";
        unit.targetBuildingId = targetBuildingId;
      } else {
        unit.currentTask = "RALLIED";
        unit.targetBuildingId = undefined;
      }
    });
  }

  public getUnitCount(): number {
    return this.activeUnits.length;
  }

  public listUnits(): RTSUnit[] {
    return this.activeUnits.map((unit) => ({
      ...unit,
      position: { ...unit.position },
    }));
  }

  public getResources(): LegendsResources {
    return { ...this.resources };
  }
}

export function compileLegendsUnitPrompt(unit: RTSUnit): string {
  const target = unit.targetBuildingId
    ? ` Target structure: ${unit.targetBuildingId}.`
    : "";
  return `[MINECRAFT_LEGENDS] ${unit.type.replaceAll("_", " ")} unit ${unit.unitId} at (${unit.position.x}, ${unit.position.y}, ${unit.position.z}) task ${unit.currentTask}.${target} Voxel cartoon army, cell-shaded Minecraft Legends style.`;
}
