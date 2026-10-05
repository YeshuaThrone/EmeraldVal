import { NextRequest, NextResponse } from "next/server";
import {
  LegendsRtsDispatcher,
  type UnitType,
  type Vec3,
} from "@/config/engine/legendsRtsDispatcher";

const UNIT_TYPES = new Set<UnitType>([
  "PLANK_GOLEM",
  "COBBLESTONE_GOLEM",
  "SKELETON_ALLY",
  "CREEPER_ALLY",
  "FIRST_OF_STONE",
]);

const rtsDispatcher = new LegendsRtsDispatcher();

function parseVec3(value: unknown): Vec3 | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (![record.x, record.y, record.z].every((part) => typeof part === "number")) {
    return null;
  }
  return { x: record.x as number, y: record.y as number, z: record.z as number };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      unitType?: unknown;
      spawnPosition?: unknown;
    };
    const unitType = body.unitType;
    const spawnPosition = parseVec3(body.spawnPosition);
    if (typeof unitType !== "string" || !UNIT_TYPES.has(unitType as UnitType) || !spawnPosition) {
      return NextResponse.json(
        { error: "Spawn failed. Insufficient lapis or invalid position." },
        { status: 400 },
      );
    }

    const unit = rtsDispatcher.spawnUnit(unitType as UnitType, spawnPosition);
    if (!unit) {
      return NextResponse.json(
        { error: "Spawn failed. Insufficient lapis or invalid position." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        unit,
        activeArmyCount: rtsDispatcher.getUnitCount(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unit spawn failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
