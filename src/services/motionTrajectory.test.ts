import { describe, expect, it } from "vitest";
import { compileMotionTrajectory } from "./motionTrajectory";

describe("compileMotionTrajectory", () => {
  it("interpolates frames and names a pan-right vector", () => {
    const matrix = compileMotionTrajectory(
      {
        shotId: "act1-02",
        durationSeconds: 1,
        zoomFactor: 1.25,
        trajectoryPath: [
          { x: 0.2, y: 0.5, timeRatio: 0 },
          { x: 0.8, y: 0.5, timeRatio: 1 },
        ],
      },
      8,
    );

    expect(matrix.shot_id).toBe("act1-02");
    expect(matrix.duration_ms).toBe(1000);
    expect(matrix.motion_coordinates).toHaveLength(8);
    expect(matrix.motion_coordinates[0]?.norm_x).toBe(0.2);
    expect(matrix.motion_coordinates.at(-1)?.norm_x).toBe(0.8);
    expect(matrix.camera_vector_string).toContain("PAN_RIGHT");
    expect(matrix.camera_vector_string).toContain("ZOOM=1.25");
  });

  it("rejects an empty path", () => {
    expect(() =>
      compileMotionTrajectory({
        shotId: "act1-02",
        durationSeconds: 5,
        zoomFactor: 1,
        trajectoryPath: [],
      }),
    ).toThrow(/at least one point/i);
  });
});
