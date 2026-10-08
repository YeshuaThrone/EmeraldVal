import { describe, expect, it } from "vitest";
import {
  buildPillarCutArgs,
  isPillarCutMetadata,
  parseBlackDetectLog,
  pickPillarCutSeconds,
} from "./ffmpegStitcher";

describe("stitchShotsAtPillarCut", () => {
  it("parses blackdetect and cuts on the last pillar hold", () => {
    const events = parseBlackDetectLog(`
      [blackdetect @ 0x1] black_start:0.00 black_end:0.12 black_duration:0.12
      [blackdetect @ 0x1] black_start:3.84 black_end:4.10 black_duration:0.26
    `);
    expect(events).toHaveLength(2);
    expect(pickPillarCutSeconds(events)).toBe(3.84);

    const args = buildPillarCutArgs({
      shotAVideoPath: "/tmp/a.mp4",
      shotBVideoPath: "/tmp/b.mp4",
      outputPath: "/tmp/out.mp4",
      cutSeconds: 3.84,
    });
    expect(args.join(" ")).toContain("trim=0:3.840");
    expect(args.join(" ")).toContain("concat=n=2:v=1:a=0[v]");
  });

  it("only stitches when metadata asks for pillar_cut", () => {
    expect(
      isPillarCutMetadata({
        previous_shot_id: "act1-01",
        transition_type: "pillar_cut",
      }),
    ).toBe(true);
    expect(isPillarCutMetadata({ transition_type: "cut" })).toBe(false);
  });
});
