import { describe, expect, it } from "vitest";
import {
  ATXLiveEngine,
  DEFAULT_CURFEW_RULES,
  blueprintFromProfile,
  districtDensityIndexText,
  venueBlueprintId,
  type CurfewRule,
  type VenueBlueprint,
} from "@/lib/masterSdk";
import { DefaultVenueBlueprint } from "@/lib/venueStudioBlueprint";
import { DISTRICT_SOUND_DENSITY_INDEX } from "@/lib/municipal";

const OVERNIGHT_RULE: CurfewRule = {
  district: "Downtown",
  startHour24: 23,
  endHour24: 6,
  standardCapDb: 85,
  curfewCapDb: 75,
};

const SAME_DAY_RULE: CurfewRule = {
  district: "Downtown",
  startHour24: 20,
  endHour24: 23,
  standardCapDb: 85,
  curfewCapDb: 75,
};

function atHour(hour: number): Date {
  const d = new Date(2026, 7, 31);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const ONLINE_BLUEPRINT: VenueBlueprint = {
  id: "v-test",
  name: "Test Hall",
  capacity: 120,
  operatingHours: "4:00 PM - 2:00 AM",
  liveSetWindow: "8:00 PM - 1:30 AM",
  district: "Downtown",
  stageLayout: "Indoor Main Stage",
  decibelCapDb: 85,
  sensorId: "sensor_test_01",
  telemetryStreamActive: true,
};

describe("ATXLiveEngine.evaluateCurfewStatus", () => {
  const engine = new ATXLiveEngine(ONLINE_BLUEPRINT);

  it("is active across the overnight span (23:00 to 06:00)", () => {
    for (const hour of [23, 0, 2, 5]) {
      const status = engine.evaluateCurfewStatus(atHour(hour), OVERNIGHT_RULE);
      expect(status.isCurfewActive).toBe(true);
      expect(status.effectiveCapDb).toBe(75);
    }
  });

  it("is inactive at and after the end hour, and before the start hour", () => {
    for (const hour of [6, 12, 22]) {
      const status = engine.evaluateCurfewStatus(atHour(hour), OVERNIGHT_RULE);
      expect(status.isCurfewActive).toBe(false);
      expect(status.effectiveCapDb).toBe(85);
    }
  });

  it("handles same-day spans with an inclusive start and exclusive end", () => {
    expect(engine.evaluateCurfewStatus(atHour(20), SAME_DAY_RULE).isCurfewActive).toBe(true);
    expect(engine.evaluateCurfewStatus(atHour(22), SAME_DAY_RULE).isCurfewActive).toBe(true);
    expect(engine.evaluateCurfewStatus(atHour(23), SAME_DAY_RULE).isCurfewActive).toBe(false);
    expect(engine.evaluateCurfewStatus(atHour(19), SAME_DAY_RULE).isCurfewActive).toBe(false);
  });
});

describe("ATXLiveEngine.processTelemetryPing", () => {
  const engine = new ATXLiveEngine(ONLINE_BLUEPRINT);

  it("reports compliance under the blueprint cap", () => {
    const status = engine.processTelemetryPing(83);
    expect(status).toEqual({
      compliant: true,
      deltaDb: -2,
      statusMessage: "Compliant (2 dB under cap)",
      sensorOnline: true,
    });
  });

  it("reports a violation over the blueprint cap", () => {
    const status = engine.processTelemetryPing(88);
    expect(status.compliant).toBe(false);
    expect(status.deltaDb).toBe(3);
    expect(status.statusMessage).toBe("VIOLATION DETECTED (3 dB over cap)");
    expect(status.sensorOnline).toBe(true);
  });

  it("reads the cap from the blueprint, not a fixed constant", () => {
    const strict = new ATXLiveEngine({ ...ONLINE_BLUEPRINT, decibelCapDb: 72 });
    const status = strict.processTelemetryPing(74);
    expect(status.compliant).toBe(false);
    expect(status.deltaDb).toBe(2);
    expect(status.statusMessage).toBe("VIOLATION DETECTED (2 dB over cap)");
  });

  it("treats a missing sensor id as offline", () => {
    const offline = new ATXLiveEngine({ ...ONLINE_BLUEPRINT, sensorId: undefined });
    const status = offline.processTelemetryPing(80);
    expect(status.sensorOnline).toBe(false);
    expect(status.statusMessage).toBe("Sensor Offline / No Stream Signal");
  });

  it("treats a disabled telemetry stream as offline", () => {
    const offline = new ATXLiveEngine({ ...ONLINE_BLUEPRINT, telemetryStreamActive: false });
    expect(offline.processTelemetryPing(90).sensorOnline).toBe(false);
  });

  it("treats a zero reading as no stream signal", () => {
    const status = engine.processTelemetryPing(0);
    expect(status.sensorOnline).toBe(false);
    expect(status.statusMessage).toBe("Sensor Offline / No Stream Signal");
  });
});

describe("ATXLiveEngine.exportBlueprintPayload", () => {
  it("exports a valid payload with the master summary line", () => {
    const engine = new ATXLiveEngine(blueprintFromProfile(DefaultVenueBlueprint));
    const payload = engine.exportBlueprintPayload();

    expect(payload.blueprintValid).toBe(true);
    expect(payload.summary).toBe(
      "Blueprint valid — Austin Live Control Room · DOWNTOWN · 250 cap · 85 dB cap",
    );
    expect(Number.isNaN(new Date(payload.updatedAt).getTime())).toBe(false);
    expect(payload.decibelCapDb).toBe(85);
  });
});

describe("blueprintFromProfile", () => {
  it("maps the default seed profile onto the master blueprint shape", () => {
    const blueprint = blueprintFromProfile(DefaultVenueBlueprint);

    expect(blueprint.id).toBe(venueBlueprintId("Austin Live Control Room"));
    expect(blueprint.name).toBe("Austin Live Control Room");
    expect(blueprint.capacity).toBe(250);
    expect(blueprint.operatingHours).toBe("4:00 PM - 2:00 AM");
    expect(blueprint.liveSetWindow).toBe("8:00 PM - 1:30 AM");
    expect(blueprint.district).toBe("Downtown");
    expect(blueprint.stageLayout).toBe("Indoor Main Stage");
    expect(blueprint.decibelCapDb).toBe(85);
    expect(blueprint.sensorId).toBe("sensor_atx_demo_01");
    expect(blueprint.telemetryStreamActive).toBe(true);
  });

  it("bridges non-default district and stage-layout values", () => {
    const profile = {
      ...DefaultVenueBlueprint,
      district: "RED_RIVER" as const,
      stageLayout: "DUAL_STAGE_SETUP" as const,
    };
    const blueprint = blueprintFromProfile(profile);

    expect(blueprint.district).toBe("Red River Cultural District");
    expect(blueprint.stageLayout).toBe("Dual Stage Setup");
  });
});

describe("venueBlueprintId", () => {
  it("slugs venue names deterministically", () => {
    expect(venueBlueprintId("Austin Live Control Room")).toBe("austin-live-control-room");
    expect(venueBlueprintId("Empire Control Room")).toBe("empire-control-room");
    expect(venueBlueprintId("  --  ")).toBe("");
  });
});

describe("DEFAULT_CURFEW_RULES", () => {
  it("covers every blueprint district with a 10 dB curfew reduction", () => {
    const districts = [
      "DOWNTOWN",
      "EAST_AUSTIN",
      "RED_RIVER",
      "SOUTH_LAMAR",
      "RAINEY",
      "DOMAIN",
      "SOUTH_CONGRESS",
      "GREATER_AUSTIN",
    ] as const;
    for (const district of districts) {
      const rule = DEFAULT_CURFEW_RULES[district];
      expect(rule).toBeDefined();
      expect(rule.district.length).toBeGreaterThan(0);
      expect(rule.curfewCapDb).toBe(rule.standardCapDb - 10);
    }
  });

  it("grounds Downtown and South Congress in the outdoor-stage zoning caps", () => {
    expect(DEFAULT_CURFEW_RULES.DOWNTOWN.standardCapDb).toBe(85);
    expect(DEFAULT_CURFEW_RULES.EAST_AUSTIN.standardCapDb).toBe(85);
    expect(DEFAULT_CURFEW_RULES.SOUTH_CONGRESS.standardCapDb).toBe(80);
    expect(DEFAULT_CURFEW_RULES.DOWNTOWN.startHour24).toBe(23);
    expect(DEFAULT_CURFEW_RULES.DOWNTOWN.endHour24).toBe(6);
  });
});

describe("districtDensityIndexText", () => {
  it("maps indexed districts onto the District Sound & Density Index", () => {
    for (const [district, label] of [
      ["DOWNTOWN", "Downtown"],
      ["EAST_AUSTIN", "East Austin"],
      ["SOUTH_CONGRESS", "South Congress"],
    ] as const) {
      const expected = DISTRICT_SOUND_DENSITY_INDEX.find(
        (row) => row.district === label,
      );
      expect(expected).toBeDefined();
      expect(districtDensityIndexText(district)).toBe(
        `${expected?.indexPercent}% Index`,
      );
    }
  });

  it("reads 'Index N/A' for districts without an index row", () => {
    expect(districtDensityIndexText("DOMAIN")).toBe("Index N/A");
    expect(districtDensityIndexText("RED_RIVER")).toBe("Index N/A");
  });
});
