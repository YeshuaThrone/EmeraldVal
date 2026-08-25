import { NextRequest, NextResponse } from "next/server";
import type { SdkCaptureEvent } from "@/lib/atx-live-sdk";
import {
  ingestAttendance,
  ingestHeat,
  ingestLuminate,
  ingestSession,
} from "@/lib/municipal-store";

export async function POST(request: NextRequest) {
  try {
    const event = (await request.json()) as SdkCaptureEvent;
    if (!event || typeof event !== "object" || !("kind" in event)) {
      return NextResponse.json({ error: "Invalid capture event." }, { status: 400 });
    }

    if (event.kind === "session") {
      ingestSession({ origin: event.origin, networkClass: event.networkClass });
    } else if (event.kind === "heat") {
      ingestHeat(event.ping);
    } else if (event.kind === "attendance") {
      ingestAttendance(event.event);
    } else if (event.kind === "luminate") {
      ingestLuminate(event.sale);
    } else {
      return NextResponse.json({ error: "Unsupported capture event." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Capture event rejected." }, { status: 400 });
  }
}
