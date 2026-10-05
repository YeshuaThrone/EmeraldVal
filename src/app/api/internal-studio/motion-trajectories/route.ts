import { NextResponse } from "next/server";
import {
  insertMotionTrajectory,
  isUnavailableDb,
  listMotionTrajectories,
  parseMotionTrajectoryBody,
} from "@/internal-studio/api/motionTrajectoriesRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";

export async function GET(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const shotId = new URL(request.url).searchParams.get("shotId") ?? undefined;
  try {
    const trajectories = await listMotionTrajectories(shotId || undefined);
    return NextResponse.json({ success: true, trajectories });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to list motion trajectories" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  try {
    const parsed = parseMotionTrajectoryBody(await readJsonBody(request));
    const trajectory = await insertMotionTrajectory(parsed);
    return NextResponse.json({
      success: true,
      trajectory,
      matrix: parsed.matrix,
    });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to save motion trajectory";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
