import { NextResponse } from "next/server";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import {
  callUE5RemoteControl,
  triggerAudio2FaceLiveLink,
  type UE5RemoteControlRequest,
} from "@/lib/UnrealEngineStudioSDK";

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action.trim() : "";

  try {
    if (action === "remote") {
      const payload = body.payload as UE5RemoteControlRequest | undefined;
      if (!payload || typeof payload !== "object") {
        return NextResponse.json(
          { error: "Missing UE5 Remote Control payload" },
          { status: 400 },
        );
      }
      const result = await callUE5RemoteControl(payload);
      return NextResponse.json({ success: true, result });
    }

    if (action === "livelink") {
      const audioFilePath =
        typeof body.audioFilePath === "string" ? body.audioFilePath.trim() : "";
      const metaHumanTargetId =
        typeof body.metaHumanTargetId === "string"
          ? body.metaHumanTargetId.trim()
          : "";
      if (!audioFilePath || !metaHumanTargetId) {
        return NextResponse.json(
          { error: "Missing audioFilePath and metaHumanTargetId" },
          { status: 400 },
        );
      }
      const result = await triggerAudio2FaceLiveLink(
        audioFilePath,
        metaHumanTargetId,
      );
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json(
      { error: "Unknown UE5 action. Use remote or livelink." },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "UE5 request failed";
    return NextResponse.json(
      { error: "UE5 request failed", details: message },
      { status: 500 },
    );
  }
}
