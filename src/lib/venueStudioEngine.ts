/**
 * ATX LIVE VENUE STUDIO SDK (UPDATE v1.1)
 * Layer: Venue Registration, Attribute Directives & Telemetry Blueprint
 * Directive: UI-parity sync with ArtistStudioView (payload symmetry)
 * Schema: zero-error validation — missing nested objects fall back to
 * safe defaults instead of throwing.
 *
 * User's pasted module, byte-faithful in logic, message strings, defaults,
 * and penalty weights. TypeScript hardening only (no behavior changes):
 * the paste's unparameterized `Partial` is restored to
 * `Partial<VenueStudioRegistrationInput>`, and the genre check drops
 * `as any` in favor of a typed string[] includes.
 */

export interface StageLayoutOptions {
  indoorMainStage: boolean;
  outdoorPatio: boolean;
  dualStageSetup: boolean;
}

export interface OperatingHours {
  openTime: string; // e.g. "17:00"
  closeTime: string; // e.g. "02:00"
  liveSetWindowStart: string; // e.g. "20:00"
  liveSetWindowEnd: string; // e.g. "01:30"
}

export interface AmenitiesAndVibeMatrix {
  hasPatioAndOutdoorAccess: boolean; // Crucial for weather surge directives
  smokingPolicy: 'Non-Smoking' | 'Dedicated Patio Only' | 'Outdoor Allowed';
  liquorLicensing: 'Full Bar' | 'Beer & Wine Only' | 'BYOB' | 'Kitchen Available';
  ageLimits: '21+ Only' | '18+' | 'All Ages';
  soundProfileGenres: Array<'Country' | 'Hip-Hop' | 'Blues/Rock' | 'Acoustic' | 'Electronic'>;
}

export interface SoundTelemetryOptIn {
  decibelThresholdTargetDb: number; // e.g., 85 dB outdoor cap
  liveTelemetryStreamConnected: boolean; // Connect sound meters to automated alert engine
}

export interface VenueStudioRegistrationInput {
  // 1. Core Identity (Mirrors ArtistStudioView layout)
  venueName: string;
  district: 'Downtown' | 'East Austin' | 'Red River Cultural District' | 'South Lamar' | 'Rainey Street' | 'West Campus' | 'North Austin';
  capacity: number;
  stageLayout: StageLayoutOptions;
  operatingHours: OperatingHours;
  // 2. Amenities & Vibe Matrix
  amenities: AmenitiesAndVibeMatrix;
  // 3. Sound Telemetry & Compliance Opt-In
  telemetry: SoundTelemetryOptIn;
}

export interface VenueValidationResult {
  isValid: boolean;
  // Paste declares `Record<string, any>` verbatim — kept byte-faithful; the
  // scoped disable is the only way to keep it and pass the repo's lint gate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sanitizedPayload: Record<string, any>;
  missingFields: string[];
  message: string;
}

export class ATXLiveVenueStudioEngine {
  // 1. VENUE STUDIO PAYLOAD SANITIZER & STRUCTURAL VALIDATOR (UPDATE)
  // Guaranteed zero-error execution. Handles missing nested objects cleanly with safe defaults.
  public static validateAndSanitizeVenueBlueprint(input: Partial<VenueStudioRegistrationInput>): VenueValidationResult {
    const missingFields: string[] = [];
    // Safe extraction with default empty structures to prevent null pointer exceptions
    const rawInput = input || {};
    const stageLayout = rawInput.stageLayout || { indoorMainStage: false, outdoorPatio: false, dualStageSetup: false };
    const operatingHours = rawInput.operatingHours || { openTime: '', closeTime: '', liveSetWindowStart: '', liveSetWindowEnd: '' };
    const amenities = rawInput.amenities || { hasPatioAndOutdoorAccess: false, smokingPolicy: 'Non-Smoking', liquorLicensing: 'Full Bar', ageLimits: '21+ Only', soundProfileGenres: [] };
    const telemetry = rawInput.telemetry || { decibelThresholdTargetDb: 85, liveTelemetryStreamConnected: false };
    // Core Identity checks
    if (!rawInput.venueName || rawInput.venueName.trim() === '') { missingFields.push('venueName'); }
    if (!rawInput.district) { missingFields.push('district'); }
    if (!rawInput.capacity || Number(rawInput.capacity) <= 0) { missingFields.push('capacity'); }
    // Amenities checks
    if (!amenities.liquorLicensing) { missingFields.push('amenities.liquorLicensing'); }
    if (!amenities.ageLimits) { missingFields.push('amenities.ageLimits'); }
    const isValid = missingFields.length === 0;
    const sanitizedPayload = {
      // Core Identity (Symmetrical to ArtistStudioView payload)
      venue_name: rawInput.venueName ? rawInput.venueName.trim() : '',
      district: rawInput.district || 'Downtown',
      capacity: Number(rawInput.capacity) || 0,
      stage_layout: {
        indoor_main_stage: Boolean(stageLayout.indoorMainStage),
        outdoor_patio: Boolean(stageLayout.outdoorPatio),
        dual_stage_setup: Boolean(stageLayout.dualStageSetup)
      },
      operating_hours: {
        open_time: operatingHours.openTime || '17:00',
        close_time: operatingHours.closeTime || '02:00',
        live_set_window_start: operatingHours.liveSetWindowStart || '20:00',
        live_set_window_end: operatingHours.liveSetWindowEnd || '01:30'
      },
      // Amenities & Vibe Matrix
      amenities: {
        patio_outdoor_access: Boolean(amenities.hasPatioAndOutdoorAccess),
        smoking_policy: amenities.smokingPolicy || 'Non-Smoking',
        liquor_licensing: amenities.liquorLicensing || 'Full Bar',
        age_limits: amenities.ageLimits || '21+ Only',
        sound_profile_genres: Array.isArray(amenities.soundProfileGenres) && amenities.soundProfileGenres.length > 0
          ? amenities.soundProfileGenres
          : ['Acoustic']
      },
      // Sound Telemetry & Compliance Opt-In
      telemetry: {
        decibel_threshold_target_db: Number(telemetry.decibelThresholdTargetDb) || 85,
        live_telemetry_stream_connected: Boolean(telemetry.liveTelemetryStreamConnected)
      },
      is_active: true,
      updated_at: new Date().toISOString()
    };
    return {
      isValid,
      sanitizedPayload,
      missingFields,
      message: isValid
        ? "UPDATE SUCCESS: Venue Studio payload validated and sanitized with zero errors."
        : `Validation failed. Missing required fields: ${missingFields.join(', ')}`
    };
  }

  // 2. TOURIST & FAN VIBE MATCH ENGINE — evaluates venue metadata against fan map search filters.
  public static evaluateVibeMatch(
    venue: VenueStudioRegistrationInput,
    filter: { requirePatio?: boolean; targetGenre?: string; requiresFullBar?: boolean; ageFilter?: string; }
  ): { matchScore: number; isRecommended: boolean; matchReasons: string[] } {
    let score = 1.0;
    const matchReasons: string[] = [];
    if (!venue || !venue.amenities) {
      return { matchScore: 0, isRecommended: false, matchReasons: ["Invalid venue data"] };
    }
    if (filter.requirePatio) {
      if (venue.amenities.hasPatioAndOutdoorAccess) { matchReasons.push("Outdoor Patio Available"); } else { score -= 0.35; }
    }
    if (filter.requiresFullBar) {
      if (venue.amenities.liquorLicensing === 'Full Bar') { matchReasons.push("Full Bar Verified"); } else { score -= 0.25; }
    }
    if (filter.targetGenre) {
      // Typed genre check (paste used `as any`): widen the union array to
      // string[] so the includes call typechecks with identical behavior.
      const genreList: string[] = venue.amenities.soundProfileGenres;
      if (Array.isArray(genreList) && genreList.includes(filter.targetGenre)) {
        matchReasons.push(`Matches Genre: ${filter.targetGenre}`);
      } else { score -= 0.3; }
    }
    const isRecommended = score >= 0.7;
    return { matchScore: Math.max(0, Number(score.toFixed(2))), isRecommended, matchReasons };
  }
}
