export interface PathPoint {
  x: number; // Normalized 0.0 - 1.0
  y: number; // Normalized 0.0 - 1.0
  timeRatio: number; // Normalized 0.0 - 1.0 along sequence duration
}

export interface MotionTrajectoryPayload {
  shotId: string;
  durationSeconds: number;
  trajectoryPath: PathPoint[];
  zoomFactor: number; // Default 1.0, >1.0 zoom in, <1.0 zoom out
}

export interface FormattedMotionMatrix {
  shot_id: string;
  duration_ms: number;
  motion_coordinates: Array<{
    frame_index: number;
    norm_x: number;
    norm_y: number;
  }>;
  camera_vector_string: string;
}

/**
 * Maps screen coordinate trajectory into API camera motion arrays.
 */
export function compileMotionTrajectory(
  payload: MotionTrajectoryPayload,
  targetFps = 24,
): FormattedMotionMatrix {
  if (!payload.trajectoryPath || payload.trajectoryPath.length === 0) {
    throw new Error("Trajectory path must contain at least one point.");
  }

  const totalFrames = Math.max(1, Math.round(payload.durationSeconds * targetFps));
  const sortedPoints = [...payload.trajectoryPath].sort(
    (a, b) => a.timeRatio - b.timeRatio,
  );

  const interpolatedFrames: Array<{
    frame_index: number;
    norm_x: number;
    norm_y: number;
  }> = [];

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const currentRatio = frameIndex / Math.max(1, totalFrames - 1);

    let nextIdx = sortedPoints.findIndex((p) => p.timeRatio >= currentRatio);
    if (nextIdx === -1) nextIdx = sortedPoints.length - 1;
    const prevIdx = Math.max(0, nextIdx - 1);

    const prevPoint = sortedPoints[prevIdx]!;
    const nextPoint = sortedPoints[nextIdx]!;

    const segmentDuration = nextPoint.timeRatio - prevPoint.timeRatio;
    const factor =
      segmentDuration > 0
        ? (currentRatio - prevPoint.timeRatio) / segmentDuration
        : 0;

    const lerpX = prevPoint.x + (nextPoint.x - prevPoint.x) * factor;
    const lerpY = prevPoint.y + (nextPoint.y - prevPoint.y) * factor;

    interpolatedFrames.push({
      frame_index: frameIndex,
      norm_x: Number(lerpX.toFixed(4)),
      norm_y: Number(lerpY.toFixed(4)),
    });
  }

  const startPoint = interpolatedFrames[0]!;
  const endPoint = interpolatedFrames[interpolatedFrames.length - 1]!;
  const deltaX = endPoint.norm_x - startPoint.norm_x;
  const deltaY = endPoint.norm_y - startPoint.norm_y;

  const primaryDirection =
    Math.abs(deltaX) > Math.abs(deltaY)
      ? deltaX > 0
        ? "PAN_RIGHT"
        : "PAN_LEFT"
      : deltaY > 0
        ? "TILT_DOWN"
        : "TILT_UP";

  const cameraVectorString = `[TRAJECTORY_VECTOR: ${primaryDirection} DX=${deltaX.toFixed(
    2,
  )} DY=${deltaY.toFixed(2)} ZOOM=${payload.zoomFactor.toFixed(2)}]`;

  return {
    shot_id: payload.shotId,
    duration_ms: payload.durationSeconds * 1000,
    motion_coordinates: interpolatedFrames,
    camera_vector_string: cameraVectorString,
  };
}

export function parseMotionTrajectoryPayload(
  raw: unknown,
): MotionTrajectoryPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("motion trajectory payload is invalid");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.shotId !== "string" || !record.shotId.trim()) {
    throw new Error("shotId is required");
  }
  const durationSeconds =
    typeof record.durationSeconds === "number" &&
    Number.isFinite(record.durationSeconds)
      ? record.durationSeconds
      : 5;
  const zoomFactor =
    typeof record.zoomFactor === "number" && Number.isFinite(record.zoomFactor)
      ? record.zoomFactor
      : 1;
  if (!Array.isArray(record.trajectoryPath)) {
    throw new Error("trajectoryPath is required");
  }
  const trajectoryPath = record.trajectoryPath.map((point, index) => {
    if (!point || typeof point !== "object") {
      throw new Error(`trajectoryPath[${index}] is invalid`);
    }
    const entry = point as Record<string, unknown>;
    const x = Number(entry.x);
    const y = Number(entry.y);
    const timeRatio = Number(entry.timeRatio);
    if (![x, y, timeRatio].every(Number.isFinite)) {
      throw new Error(`trajectoryPath[${index}] must include x, y, timeRatio`);
    }
    return { x, y, timeRatio };
  });
  return {
    shotId: record.shotId.trim(),
    durationSeconds,
    zoomFactor,
    trajectoryPath,
  };
}
