/**
 * @module @atxlive/sdk/master
 *
 * The pasted ATXLiveMasterSDK — Single Unified SDK for ATX Live Venue
 * Operations & Telemetry — natively integrated with the v3.5.0 Venue
 * Studio Blueprint schema:
 *
 *  - VenueBlueprint / CurfewRule / TelemetryStatus types (paste-verbatim);
 *  - ATXLiveEngine: municipal curfew evaluation across midnight boundaries,
 *    live telemetry ping processing against the blueprint's dB cap, and a
 *    clean blueprint payload export for API / Vercel saving;
 *  - blueprintFromProfile: bridges the compiled v3.5.0
 *    VenueStudioBlueprintProfile (venueStudioBlueprint.ts) onto the master
 *    engine's VenueBlueprint shape, so the Venue Studio's live form state
 *    drives the engine;
 *  - DEFAULT_CURFEW_RULES: the Default Austin Curfew Seed. Standard caps
 *    reuse the repo's OUTDOOR_STAGES zoning limits where they exist
 *    (Downtown 85, East 85, South Congress 80 dB) and the app's 85 dB
 *    ordinance cap elsewhere; curfew caps drop 10 dB inside the paste's
 *    23:00–06:00 overnight window. Seed configuration for the simulation,
 *    not a transcription of real municipal code.
 *  - districtDensityIndexText: maps a blueprint district onto the
 *    District Sound & Density Index (municipal.ts, Card 4) for the studio
 *    header's "92% Index" chip.
 *
 * The engine class is pure — no React, no network — and unit-tested in
 * masterSdk.test.ts.
 */
import {
  type ATXDistrict,
  type VenueStudioBlueprintProfile,
} from "@/lib/venueStudioBlueprint";
import { DISTRICT_SOUND_DENSITY_INDEX } from "@/lib/municipal";
import {
  BLUEPRINT_DISTRICTS,
  STAGE_LAYOUT_OPTIONS,
} from "@/lib/venueStudioForm";

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

export interface VenueBlueprint {
  id: string;
  name: string;
  capacity: number;
  operatingHours: string;
  liveSetWindow: string;
  district: string;
  stageLayout: "Indoor Main Stage" | "Outdoor Patio" | "Dual Stage Setup";
  decibelCapDb: number;
  sensorId?: string;
  telemetryStreamActive: boolean;
}

export interface CurfewRule {
  district: string;
  startHour24: number; // e.g., 23 for 11:00 PM
  endHour24: number; // e.g., 6 for 6:00 AM
  standardCapDb: number;
  curfewCapDb: number;
}

export interface TelemetryStatus {
  compliant: boolean;
  deltaDb: number;
  statusMessage: string;
  sensorOnline: boolean;
}

// ==========================================
// 2. CORE TELEMETRY & VENUE ENGINE
// ==========================================

export class ATXLiveEngine {
  private blueprint: VenueBlueprint;

  constructor(initialBlueprint: VenueBlueprint) {
    this.blueprint = initialBlueprint;
  }

  // Check municipal ordinance curfew enforcement across midnight boundaries
  public evaluateCurfewStatus(
    currentTime: Date,
    rule: CurfewRule,
  ): { isCurfewActive: boolean; effectiveCapDb: number } {
    const hour = currentTime.getHours();
    // Handles overnight spans (e.g., 23:00 to 06:00)
    const isCurfewActive =
      rule.startHour24 > rule.endHour24
        ? hour >= rule.startHour24 || hour < rule.endHour24
        : hour >= rule.startHour24 && hour < rule.endHour24;

    const effectiveCapDb = isCurfewActive
      ? rule.curfewCapDb
      : rule.standardCapDb;

    return { isCurfewActive, effectiveCapDb };
  }

  // Process live sensor reading against threshold with safety checks
  public processTelemetryPing(currentDb: number): TelemetryStatus {
    const isOnline = Boolean(
      this.blueprint.sensorId && this.blueprint.telemetryStreamActive,
    );
    if (!isOnline || currentDb <= 0) {
      return {
        compliant: true,
        deltaDb: 0,
        statusMessage: "Sensor Offline / No Stream Signal",
        sensorOnline: false,
      };
    }

    const threshold = this.blueprint.decibelCapDb;
    const deltaDb = currentDb - threshold;
    const compliant = deltaDb <= 0;

    const statusMessage = compliant
      ? `Compliant (${Math.abs(deltaDb)} dB under cap)`
      : `VIOLATION DETECTED (${deltaDb} dB over cap)`;

    return {
      compliant,
      deltaDb,
      statusMessage,
      sensorOnline: true,
    };
  }

  // Export clean payload for API / Vercel saving
  public exportBlueprintPayload() {
    return {
      ...this.blueprint,
      updatedAt: new Date().toISOString(),
      blueprintValid: true,
      summary: `Blueprint valid — ${this.blueprint.name} · ${this.blueprint.district.toUpperCase()} · ${this.blueprint.capacity} cap · ${this.blueprint.decibelCapDb} dB cap`,
    };
  }
}

// ==========================================
// 3. V3.5.0 BLUEPRINT BRIDGE
// ==========================================

/**
 * Bridges the compiled v3.5.0 VenueStudioBlueprintProfile onto the master
 * engine's VenueBlueprint shape. Display labels reuse the Venue Blueprint
 * form's own option tables (venueStudioForm.ts), so the engine's strings
 * always match what the operator sees. `id` is a stable slug of the venue
 * name; the paste's VenueBlueprint has no v3.5.0 counterpart for it.
 */
export function blueprintFromProfile(
  profile: VenueStudioBlueprintProfile,
): VenueBlueprint {
  const districtLabel =
    BLUEPRINT_DISTRICTS.find((d) => d.value === profile.district)?.label ??
    profile.district;
  const stageLayoutLabel = STAGE_LAYOUT_OPTIONS.find(
    (o) => o.value === profile.stageLayout,
  )?.label;

  return {
    id: venueBlueprintId(profile.venueName),
    name: profile.venueName,
    capacity: profile.capacity,
    operatingHours: profile.operatingHours,
    liveSetWindow: profile.liveSetWindows,
    district: districtLabel,
    stageLayout:
      (stageLayoutLabel as VenueBlueprint["stageLayout"]) ?? "Indoor Main Stage",
    decibelCapDb: profile.telemetryConfig.decibelThresholdCapDb,
    sensorId: profile.telemetryConfig.sensorId,
    telemetryStreamActive: profile.telemetryConfig.liveTelemetryStreamOptIn,
  };
}

/** Stable master-blueprint id: slug of the venue name. */
export function venueBlueprintId(venueName: string): string {
  return venueName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ==========================================
// 4. DEFAULT AUSTIN CURFEW SEED & DISTRICT INDEX
// ==========================================

/**
 * Default Austin Curfew Seed — standard caps grounded in the repo's
 * OUTDOOR_STAGES zoning rows (Downtown 85, East 85, South Congress 80)
 * with the app's 85 dB ordinance cap as the default; curfew caps drop
 * 10 dB inside the paste's 23:00–06:00 overnight window.
 */
export const DEFAULT_CURFEW_RULES: Record<ATXDistrict, CurfewRule> = {
  DOWNTOWN: { district: "Downtown", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
  EAST_AUSTIN: { district: "East Austin", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
  RED_RIVER: { district: "Red River Cultural District", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
  SOUTH_LAMAR: { district: "South Lamar", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
  RAINEY: { district: "Rainey Street", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
  DOMAIN: { district: "The Domain", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
  SOUTH_CONGRESS: { district: "South Congress", startHour24: 23, endHour24: 6, standardCapDb: 80, curfewCapDb: 70 },
  GREATER_AUSTIN: { district: "Greater Austin", startHour24: 23, endHour24: 6, standardCapDb: 85, curfewCapDb: 75 },
};

/**
 * The District Sound & Density Index is contract data over its own four
 * display names; blueprint districts without a row read "Index N/A"
 * rather than borrowing another corridor's figure.
 */
const DENSITY_INDEX_DISTRICT: Partial<Record<ATXDistrict, string>> = {
  DOWNTOWN: "Downtown",
  EAST_AUSTIN: "East Austin",
  SOUTH_CONGRESS: "South Congress",
};

/** "92% Index"-style density text for the studio header. */
export function districtDensityIndexText(district: ATXDistrict): string {
  const displayLabel = DENSITY_INDEX_DISTRICT[district];
  const entry = displayLabel
    ? DISTRICT_SOUND_DENSITY_INDEX.find(
        (row) => row.district === displayLabel,
      )
    : undefined;
  return entry ? `${entry.indexPercent}% Index` : "Index N/A";
}
