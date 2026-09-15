import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseViewerSession } from "./viewerSession";

const src = readFileSync(
  path.join(import.meta.dirname, "WorfiAppShell.tsx"),
  "utf8",
);
const signInSrc = readFileSync(
  path.join(import.meta.dirname, "ViewerSignIn.tsx"),
  "utf8",
);

describe("WorfiAppShell", () => {
  it("ships the four-channel WORFI demo lineup defaulting to CH 04 news", () => {
    expect(src).toContain("WORFI");
    expect(src).not.toContain("WERFIE");
    expect(src).toContain('station: "WORFI MAIN"');
    expect(src).toContain('station: "CLASSIC CARTOONS"');
    expect(src).toContain('station: "ATX LOCAL NEWS"');
    expect(src).toContain('station: "NASA TV LIVE"');
    expect(src).toContain('chNumber: "04"');
    expect(src).toContain(
      'WORFI_DEMO_LINEUP.find((p) => p.chNumber === "04")',
    );
    expect(src).toContain("Night of the Living Dead (1968)");
    expect(src).toContain("night-of-the-living-dead_1968");
    expect(src).toContain("tears-of-steel.ism/.m3u8");
    expect(src).toContain('import("hls.js")');
  });

  it("gates video behind POWER and rotates the ATX news ticker", () => {
    expect(src).toContain("PRESS TO UNLOCK BROADCAST AUDIO & VIDEO");
    expect(src).toContain("POWER");
    expect(src).toContain("ATX NEWS TICKER");
    expect(src).toContain("AtxNewsService.getLiveAustinHeadlines()");
    expect(src).toContain("6000");
  });

  it("is viewership-only: sign-in then player, no creator or sponsor signup", () => {
    expect(src).toContain("ViewerSignIn");
    expect(src).toContain("WorfiGuidePlayerView");
    expect(src).not.toContain("SPONSOR_ONBOARDING");
    expect(src).not.toContain("WorfiSponsorPortal");
    expect(src).not.toContain("AdminLineupManager");
    expect(src).not.toContain("WorfiAdIntelligenceDashboard");
    expect(src).not.toContain("setActiveTab");
    expect(signInSrc).toContain("Viewer sign-in");
    expect(signInSrc).toContain("Watch the lineup");
    expect(signInSrc).toContain("Creators cannot sign up here");
    expect(signInSrc).not.toContain("Deliver Master Asset");
  });
});

describe("viewerSession", () => {
  it("accepts a display name and rejects empty payloads", () => {
    expect(parseViewerSession(JSON.stringify({ displayName: " Maya " }))).toEqual(
      { displayName: "Maya" },
    );
    expect(parseViewerSession(JSON.stringify({ displayName: "   " }))).toBeNull();
    expect(parseViewerSession("not-json")).toBeNull();
  });
});
