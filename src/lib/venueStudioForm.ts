/**
 * Pure form logic for the v3.5.0 Venue Studio blueprint rebuild — the only
 * mutable bridge between the VenueStudioBlueprintProfile schema (the paste's
 * canonical SCREAMING_SNAKE enums) and the React form state in
 * VenueStudioView. No React, no side effects: every function is pure so the
 * schema-migration rules are pinned by tests.
 */
import {
  DefaultVenueBlueprint,
  type AgeRestrictionType,
  type ATXDistrict,
  type DominantGenre,
  type LicensingType,
  type SmokingPolicyType,
  type StageLayoutType,
  type VenueStudioBlueprintProfile,
} from "./venueStudioBlueprint";

/** All of Austin, per the v3.5.0 ATXDistrict canon — the form renders every value. */
export const BLUEPRINT_DISTRICTS: { value: ATXDistrict; label: string }[] = [
  { value: "DOWNTOWN", label: "Downtown" },
  { value: "EAST_AUSTIN", label: "East Austin" },
  { value: "RED_RIVER", label: "Red River Cultural District" },
  { value: "SOUTH_LAMAR", label: "South Lamar" },
  { value: "RAINEY", label: "Rainey Street" },
  { value: "DOMAIN", label: "The Domain" },
  { value: "SOUTH_CONGRESS", label: "South Congress" },
  { value: "GREATER_AUSTIN", label: "Greater Austin" },
];

export const STAGE_LAYOUT_OPTIONS: { value: StageLayoutType; label: string }[] = [
  { value: "INDOOR_MAIN_STAGE", label: "Indoor Main Stage" },
  { value: "OUTDOOR_PATIO", label: "Outdoor Patio" },
  { value: "DUAL_STAGE_SETUP", label: "Dual Stage Setup" },
];

export const SMOKING_POLICY_OPTIONS: { value: SmokingPolicyType; label: string }[] = [
  { value: "NON_SMOKING", label: "Non-Smoking" },
  { value: "DEDICATED_PATIO", label: "Dedicated Patio Only" },
  { value: "OUTDOOR_ALLOWED", label: "Outdoor Allowed" },
];

export const LICENSING_OPTIONS: { value: LicensingType; label: string }[] = [
  { value: "FULL_BAR", label: "Full Bar" },
  { value: "BEER_AND_WINE_ONLY", label: "Beer & Wine Only" },
  { value: "BYOB", label: "BYOB" },
  { value: "KITCHEN_AVAILABLE", label: "Kitchen Available" },
];

export const AGE_RESTRICTION_OPTIONS: { value: AgeRestrictionType; label: string }[] = [
  { value: "21_PLUS", label: "21+ Only" },
  { value: "18_PLUS", label: "18+" },
  { value: "ALL_AGES", label: "All Ages" },
];

export const DOMINANT_GENRE_OPTIONS: { value: DominantGenre; label: string }[] = [
  { value: "COUNTRY", label: "Country" },
  { value: "HIP_HOP", label: "Hip-Hop" },
  { value: "BLUES_ROCK", label: "Blues/Rock" },
  { value: "ACOUSTIC", label: "Acoustic" },
  { value: "ELECTRONIC", label: "Electronic" },
];

/** Editable mirror of VenueStudioBlueprintProfile; capacity is a string for the input. */
export interface VenueBlueprintFormState {
  venueName: string;
  district: ATXDistrict;
  capacity: string;
  stageLayout: StageLayoutType;
  operatingHours: string;
  liveSetWindows: string;
  patioAndOutdoorAccess: boolean;
  smokingPolicy: SmokingPolicyType;
  liquorLicensing: LicensingType;
  ageLimits: AgeRestrictionType;
  dominantGenres: DominantGenre[];
  decibelThresholdCapDb: string;
  liveTelemetryStreamOptIn: boolean;
  sensorId: string;
}

/** Seed instance from the paste, as editable form state. */
export function defaultBlueprintForm(): VenueBlueprintFormState {
  return {
    venueName: DefaultVenueBlueprint.venueName,
    district: DefaultVenueBlueprint.district,
    capacity: String(DefaultVenueBlueprint.capacity),
    stageLayout: DefaultVenueBlueprint.stageLayout,
    operatingHours: DefaultVenueBlueprint.operatingHours,
    liveSetWindows: DefaultVenueBlueprint.liveSetWindows,
    patioAndOutdoorAccess: DefaultVenueBlueprint.amenities.patioAndOutdoorAccess,
    smokingPolicy: DefaultVenueBlueprint.amenities.smokingPolicy,
    liquorLicensing: DefaultVenueBlueprint.amenities.liquorLicensing,
    ageLimits: DefaultVenueBlueprint.amenities.ageLimits,
    dominantGenres: [...DefaultVenueBlueprint.amenities.dominantGenres],
    decibelThresholdCapDb: String(DefaultVenueBlueprint.telemetryConfig.decibelThresholdCapDb),
    liveTelemetryStreamOptIn: DefaultVenueBlueprint.telemetryConfig.liveTelemetryStreamOptIn,
    sensorId: DefaultVenueBlueprint.telemetryConfig.sensorId ?? "",
  };
}

/** Toggle a genre in the multi-select (pure). */
export function toggleDominantGenre(genres: DominantGenre[], genre: DominantGenre): DominantGenre[] {
  return genres.includes(genre)
    ? genres.filter((g) => g !== genre)
    : [...genres, genre];
}

/**
 * Compile the form into a strict VenueStudioBlueprintProfile. Capacity
 * coercion mirrors the PR 34 engine: Number(value) || 0.
 */
export function buildBlueprintProfile(form: VenueBlueprintFormState): VenueStudioBlueprintProfile {
  return {
    venueName: form.venueName.trim(),
    district: form.district,
    capacity: Number(form.capacity) || 0,
    stageLayout: form.stageLayout,
    operatingHours: form.operatingHours.trim() || DefaultVenueBlueprint.operatingHours,
    liveSetWindows: form.liveSetWindows.trim() || DefaultVenueBlueprint.liveSetWindows,
    amenities: {
      patioAndOutdoorAccess: form.patioAndOutdoorAccess,
      smokingPolicy: form.smokingPolicy,
      liquorLicensing: form.liquorLicensing,
      ageLimits: form.ageLimits,
      dominantGenres: [...form.dominantGenres],
    },
    telemetryConfig: {
      decibelThresholdCapDb: Number(form.decibelThresholdCapDb) || 85,
      liveTelemetryStreamOptIn: form.liveTelemetryStreamOptIn,
      ...(form.sensorId.trim() === "" ? {} : { sensorId: form.sensorId.trim() }),
    },
    isConfigured: true,
    isLive: form.liveTelemetryStreamOptIn,
  };
}

export interface BlueprintValidation {
  isValid: boolean;
  missingFields: string[];
}

/** Strict schema validation — every required section must be satisfiable. */
export function validateBlueprintProfile(profile: VenueStudioBlueprintProfile): BlueprintValidation {
  const missingFields: string[] = [];
  if (profile.venueName === "") missingFields.push("venueName");
  if (profile.capacity <= 0) missingFields.push("capacity");
  if (profile.amenities.dominantGenres.length === 0) missingFields.push("amenities.dominantGenres");
  if (profile.telemetryConfig.decibelThresholdCapDb <= 0) {
    missingFields.push("telemetryConfig.decibelThresholdCapDb");
  }
  return { isValid: missingFields.length === 0, missingFields };
}
