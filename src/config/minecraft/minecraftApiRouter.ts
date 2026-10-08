import { CraftingSolverEngine } from "../engine/craftingSolver";
import { RedstoneSimulator } from "../engine/redstoneSimulator";
import { DungeonsLootEngine } from "../engine/dungeonsLootEngine";
import {
  LegendsRtsDispatcher,
  type UnitType,
  type Vec3,
} from "../engine/legendsRtsDispatcher";
import { Router, type Request, type Response } from "express";

const UNIT_TYPES = new Set<UnitType>([
  "PLANK_GOLEM",
  "COBBLESTONE_GOLEM",
  "SKELETON_ALLY",
  "CREEPER_ALLY",
  "FIRST_OF_STONE",
]);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseVec3(value: unknown): Vec3 | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (![record.x, record.y, record.z].every((part) => typeof part === "number")) {
    return null;
  }
  return { x: record.x as number, y: record.y as number, z: record.z as number };
}

const router = Router();

const craftingSolver = new CraftingSolverEngine();
const redstoneSim = new RedstoneSimulator();
const dungeonsLoot = new DungeonsLootEngine();
const rtsDispatcher = new LegendsRtsDispatcher();

router.post("/crafting/solve", (req: Request, res: Response) => {
  try {
    const itemId =
      typeof req.body?.itemId === "string" ? req.body.itemId.trim() : "";
    const count = Number(req.body?.count ?? 1);
    if (!itemId) {
      return res.status(400).json({ error: "Missing required parameter: itemId" });
    }

    const recipeTree = craftingSolver.solveCraftingTree(itemId, count);
    return res.status(200).json({ success: true, data: recipeTree });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ error: errorMessage(error, "Crafting resolution failed") });
  }
});

router.post("/redstone/propagate", (req: Request, res: Response) => {
  try {
    const startX = Number(req.body?.startX);
    const startY = Number(req.body?.startY);
    const startZ = Number(req.body?.startZ);
    const initialPower = Number(req.body?.initialPower ?? 15);
    const nodes = Array.isArray(req.body?.nodes) ? req.body.nodes : [];

    for (const node of nodes) {
      redstoneSim.setNode(node);
    }
    redstoneSim.propagateSignal(startX, startY, startZ, initialPower);

    return res.status(200).json({
      success: true,
      outputPower: redstoneSim.getNodePower(startX, startY, startZ),
    });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ error: errorMessage(error, "Redstone propagation failed") });
  }
});

router.get("/dungeons/loot", (req: Request, res: Response) => {
  try {
    const difficulty = Number(req.query.difficulty) || 10;
    const isAncientHunt = req.query.ancientHunt === "true";
    const itemDrop = dungeonsLoot.rollDrop(difficulty, isAncientHunt);
    return res.status(200).json({ success: true, drop: itemDrop });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ error: errorMessage(error, "Loot generation failed") });
  }
});

router.post("/legends/spawn", (req: Request, res: Response) => {
  try {
    const unitType = req.body?.unitType;
    const spawnPosition = parseVec3(req.body?.spawnPosition);
    if (typeof unitType !== "string" || !UNIT_TYPES.has(unitType as UnitType)) {
      return res.status(400).json({
        error: "Spawn failed. Insufficient lapis or invalid position.",
      });
    }
    if (!spawnPosition) {
      return res.status(400).json({
        error: "Spawn failed. Insufficient lapis or invalid position.",
      });
    }

    const unit = rtsDispatcher.spawnUnit(unitType as UnitType, spawnPosition);
    if (!unit) {
      return res.status(400).json({
        error: "Spawn failed. Insufficient lapis or invalid position.",
      });
    }

    return res.status(201).json({
      success: true,
      unit,
      activeArmyCount: rtsDispatcher.getUnitCount(),
    });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ error: errorMessage(error, "Unit spawn failed") });
  }
});

export default router;
