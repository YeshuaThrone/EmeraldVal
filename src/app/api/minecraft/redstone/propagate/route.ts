import { NextRequest, NextResponse } from "next/server";
import { RedstoneSimulator, type RedstoneNode } from "@/config/engine/redstoneSimulator";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      startX?: unknown;
      startY?: unknown;
      startZ?: unknown;
      initialPower?: unknown;
      nodes?: unknown;
    };
    const startX = Number(body.startX);
    const startY = Number(body.startY);
    const startZ = Number(body.startZ);
    const initialPower = Number(body.initialPower ?? 15);
    const redstoneSim = new RedstoneSimulator();
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    for (const node of nodes) {
      redstoneSim.setNode(node as RedstoneNode);
    }
    redstoneSim.propagateSignal(startX, startY, startZ, initialPower);
    return NextResponse.json({
      success: true,
      outputPower: redstoneSim.getNodePower(startX, startY, startZ),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Redstone propagation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
