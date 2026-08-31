import { describe, expect, it } from "vitest";
import {
  AGE_RESTRICTION_OPTIONS,
  BLUEPRINT_DISTRICTS,
  buildBlueprintProfile,
  defaultBlueprintForm,
  DOMINANT_GENRE_OPTIONS,
  LICENSING_OPTIONS,
  SMOKING_POLICY_OPTIONS,
  STAGE_LAYOUT_OPTIONS,
  toggleDominantGenre,
  validateBlueprintProfile,
} from "./venueStudioForm";
import { DefaultVenueBlueprint } from "./venueStudioBlueprint";

describe("blueprint form option catalogs", () => {
  it("renders all of Austin — every v3.5.0 ATXDistrict value", () => {
    expect(BLUEPRINT_DISTRICTS.map((d) => d.value)).toEqual([
      "DOWNTOWN",
      "EAST_AUSTIN",
      "RED_RIVER",
      "SOUTH_LAMAR",
      "RAINEY",
      "DOMAIN",
      "SOUTH_CONGRESS",
      "GREATER_AUSTIN",
    ]);
  });

  it("exposes every enum canon member across the option lists", () => {
    expect(STAGE_LAYOUT_OPTIONS.map((o) => o.value)).toEqual([
      "INDOOR_MAIN_STAGE",
      "OUTDOOR_PATIO",
      "DUAL_STAGE_SETUP",
    ]);
    expect(SMOKING_POLICY_OPTIONS.map((o) => o.value)).toEqual([
      "NON_SMOKING",
      "DEDICATED_PATIO",
      "OUTDOOR_ALLOWED",
    ]);
    expect(LICENSING_OPTIONS.map((o) => o.value)).toEqual([
      "FULL_BAR",
      "BEER_AND_WINE_ONLY",
      "BYOB",
      "KITCHEN_AVAILABLE",
    ]);
    expect(AGE_RESTRICTION_OPTIONS.map((o) => o.value)).toEqual([
      "21_PLUS",
      "18_PLUS",
      "ALL_AGES",
    ]);
    expect(DOMINANT_GENRE_OPTIONS.map((o) => o.value)).toEqual([
      "COUNTRY",
      "HIP_HOP",
      "BLUES_ROCK",
      "ACOUSTIC",
      "ELECTRONIC",
    ]);
  });
});

describe("defaultBlueprintForm", () => {
  it("seeds from the paste's Default Austin Blueprint Seed Instance", () => {
    expect(defaultBlueprintForm()).toEqual({
      venueName: "Austin Live Control Room",
      district: "DOWNTOWN",
      capacity: "250",
      stageLayout: "INDOOR_MAIN_STAGE",
      operatingHours: "4:00 PM - 2:00 AM",
      liveSetWindows: "8:00 PM - 1:30 AM",
      patioAndOutdoorAccess: true,
      smokingPolicy: "DEDICATED_PATIO",
      liquorLicensing: "FULL_BAR",
      ageLimits: "21_PLUS",
      dominantGenres: ["BLUES_ROCK", "COUNTRY", "ACOUSTIC"],
      decibelThresholdCapDb: "85",
      liveTelemetryStreamOptIn: true,
      sensorId: "sensor_atx_demo_01",
    });
  });
});

describe("toggleDominantGenre", () => {
  it("adds and removes genres purely", () => {
    expect(toggleDominantGenre(["COUNTRY"], "HIP_HOP")).toEqual(["COUNTRY", "HIP_HOP"]);
    expect(toggleDominantGenre(["COUNTRY", "HIP_HOP"], "COUNTRY")).toEqual(["HIP_HOP"]);
  });
});

describe("buildBlueprintProfile", () => {
  it("compiles the seed form into the DefaultVenueBlueprint profile", () => {
    expect(buildBlueprintProfile(defaultBlueprintForm())).toEqual(DefaultVenueBlueprint);
  });

  it("trims venueName, coerces string capacity, and drops empty sensorId", () => {
    const form = defaultBlueprintForm();
    const profile = buildBlueprintProfile({
      ...form,
      venueName: "  Mohawk  ",
      capacity: "400",
      sensorId: "  ",
    });
    expect(profile.venueName).toBe("Mohawk");
    expect(profile.capacity).toBe(400);
    expect(profile.telemetryConfig.sensorId).toBeUndefined();
  });
});

describe("validateBlueprintProfile", () => {
  it("accepts the seeded profile with zero missing fields", () => {
    const validation = validateBlueprintProfile(buildBlueprintProfile(defaultBlueprintForm()));
    expect(validation).toEqual({ isValid: true, missingFields: [] });
  });

  it("flags venueName, capacity, genres, and dB cap with dotted paths", () => {
    const form = defaultBlueprintForm();
    const profile = buildBlueprintProfile({
      ...form,
      venueName: "   ",
      capacity: "0",
      decibelThresholdCapDb: "-5",
    });
    profile.amenities.dominantGenres = [];
    expect(validateBlueprintProfile(profile)).toEqual({
      isValid: false,
      missingFields: [
        "venueName",
        "capacity",
        "amenities.dominantGenres",
        "telemetryConfig.decibelThresholdCapDb",
      ],
    });
  });
});
