import { NextRequest, NextResponse } from "next/server";
import { CraftingSolverEngine } from "@/config/engine/craftingSolver";

const craftingSolver = new CraftingSolverEngine();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { itemId?: unknown; count?: unknown };
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId) {
      return NextResponse.json(
        { error: "Missing required parameter: itemId" },
        { status: 400 },
      );
    }
    const recipeTree = craftingSolver.solveCraftingTree(
      itemId,
      Number(body.count ?? 1),
    );
    return NextResponse.json({ success: true, data: recipeTree });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Crafting resolution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
