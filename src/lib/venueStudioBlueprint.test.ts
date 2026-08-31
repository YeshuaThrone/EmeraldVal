import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ATXVenueStudioLayoutPatcher,
  DefaultVenueBlueprint,
  PipelineExecutionController,
  VercelDeploymentGuard,
  type VenueStudioBlueprintProfile,
} from "./venueStudioBlueprint";

describe("DefaultVenueBlueprint", () => {
  it("matches the paste's Default Austin Blueprint Seed Instance verbatim", () => {
    expect(DefaultVenueBlueprint).toEqual({
      venueName: "Austin Live Control Room",
      district: "DOWNTOWN",
      capacity: 250,
      stageLayout: "INDOOR_MAIN_STAGE",
      operatingHours: "4:00 PM - 2:00 AM",
      liveSetWindows: "8:00 PM - 1:30 AM",
      amenities: {
        patioAndOutdoorAccess: true,
        smokingPolicy: "DEDICATED_PATIO",
        liquorLicensing: "FULL_BAR",
        ageLimits: "21_PLUS",
        dominantGenres: ["BLUES_ROCK", "COUNTRY", "ACOUSTIC"],
      },
      telemetryConfig: {
        decibelThresholdCapDb: 85,
        liveTelemetryStreamOptIn: true,
        sensorId: "sensor_atx_demo_01",
      },
      isConfigured: true,
      isLive: true,
    });
  });

  it("satisfies the VenueStudioBlueprintProfile schema (Core Identity, Amenities & Vibe Matrix, Telemetry Opt-In)", () => {
    // Compile-time shape guard exercised at runtime: every schema section
    // is present and typed as the paste declares.
    const profile: VenueStudioBlueprintProfile = DefaultVenueBlueprint;
    expect(profile.venueName).toBe("Austin Live Control Room");
    expect(profile.telemetryConfig.decibelThresholdCapDb).toBe(85);
    expect(profile.telemetryConfig.liveTelemetryStreamOptIn).toBe(true);
    expect(profile.isConfigured).toBe(true);
    expect(profile.isLive).toBe(true);
    expect(profile.amenities.dominantGenres).toEqual([
      "BLUES_ROCK",
      "COUNTRY",
      "ACOUSTIC",
    ]);
  });
});

describe("ATXVenueStudioLayoutPatcher.applyStudioLayoutFix", () => {
  it("returns the paste's layout-fix descriptor verbatim", () => {
    expect(ATXVenueStudioLayoutPatcher.applyStudioLayoutFix()).toEqual({
      targetComponent: "VenueStudioContainer",
      layoutFixes: {
        display: "flex",
        minHeight: "100vh",
        overflow: "auto",
        forceMount: true,
      },
    });
  });
});

describe("VercelDeploymentGuard.getBuildDirectives", () => {
  it("returns the mock-in-memory client SQLite strategy with hydration fallback enabled", () => {
    expect(VercelDeploymentGuard.getBuildDirectives()).toEqual({
      sqliteStrategy: "MOCK_IN_MEMORY_FOR_CLIENT",
      enableClientHydrationFallback: true,
    });
  });
});

describe("PipelineExecutionController.triggerDeploymentPipeline", () => {
  it("returns the paste's exact push directive with the verbatim commit message", () => {
    expect(PipelineExecutionController.triggerDeploymentPipeline()).toEqual({
      targetBranch: "main",
      commitMessage:
        "fix: execute venue studio blueprint engine, hydrate studio layout, isolate client sqlite",
      autoDeployVercel: true,
    });
  });
});

describe("SQLite isolation (paste directive 3)", () => {
  const collectTsx = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        collectTsx(full, out);
      } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        out.push(full);
      }
    }
    return out;
  };

  it("no 'use client' component imports better-sqlite3 or src/lib/server", () => {
    const files = [
      ...collectTsx("src/components"),
      ...collectTsx("src/app"),
    ];
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!src.includes('"use client"')) continue;
      if (/better-sqlite3|lib\/server/.test(src)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
