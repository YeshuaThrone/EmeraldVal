import { NextRequest, NextResponse } from "next/server";
import { DungeonsLootEngine } from "@/config/engine/dungeonsLootEngine";

const dungeonsLoot = new DungeonsLootEngine();

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const difficulty = Number(params.get("difficulty")) || 10;
    const isAncientHunt = params.get("ancientHunt") === "true";
    const itemDrop = dungeonsLoot.rollDrop(difficulty, isAncientHunt);
    return NextResponse.json({ success: true, drop: itemDrop });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Loot generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
