import { describe, expect, it } from "vitest";
import {
  buildXfadeFilterComplex,
  buildXfadeFfmpegArgs,
} from "./xfadeStitcher";

describe("stitchMultiStyleClips", () => {
  it("builds a staggered xfade chain for 5-second clips", () => {
    const { filterComplex, lastOutput } = buildXfadeFilterComplex(3, 0.5, 5);
    expect(filterComplex).toContain(
      "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5[v1]",
    );
    expect(filterComplex).toContain(
      "[v1][2:v]xfade=transition=fade:duration=0.5:offset=9[v2]",
    );
    expect(lastOutput).toBe("[v2]");

    const args = buildXfadeFfmpegArgs({
      inputPaths: ["/tmp/a.mp4", "/tmp/b.mp4"],
      outputPath: "/tmp/out.mp4",
    });
    expect(args[args.indexOf("-i") + 1]).toBe("/tmp/a.mp4");
    expect(args.join(" ")).toContain("libx264");
    expect(args.join(" ")).not.toContain("ffmpeg -y");
  });
});
