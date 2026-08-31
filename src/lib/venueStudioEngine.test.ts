import { describe, it, expect } from 'vitest';
import {
  ATXLiveVenueStudioEngine,
  AmenitiesAndVibeMatrix,
  VenueStudioRegistrationInput
} from './venueStudioEngine';

/** A fully valid venue blueprint used as the base for positive-path tests. */
const validBlueprint: VenueStudioRegistrationInput = {
  venueName: '  Empire Control Room  ',
  district: 'Red River Cultural District',
  capacity: 150,
  stageLayout: { indoorMainStage: true, outdoorPatio: true, dualStageSetup: false },
  operatingHours: {
    openTime: '17:00',
    closeTime: '02:00',
    liveSetWindowStart: '20:00',
    liveSetWindowEnd: '01:30'
  },
  amenities: {
    hasPatioAndOutdoorAccess: true,
    smokingPolicy: 'Dedicated Patio Only',
    liquorLicensing: 'Full Bar',
    ageLimits: '21+ Only',
    soundProfileGenres: ['Country', 'Blues/Rock']
  },
  telemetry: { decibelThresholdTargetDb: 85, liveTelemetryStreamConnected: true }
};

describe('ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint', () => {
  describe('zero-error execution', () => {
    it('does not throw and reports missing identity fields for {} input', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({});
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['venueName', 'district', 'capacity']);
      expect(result.message).toBe('Validation failed. Missing required fields: venueName, district, capacity');
    });

    it('does not throw for null input', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint(null as unknown as Partial<VenueStudioRegistrationInput>);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['venueName', 'district', 'capacity']);
    });

    it('fully defaults the sanitized payload for {} input', () => {
      const { sanitizedPayload } = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({});
      expect(sanitizedPayload).toMatchObject({
        venue_name: '',
        district: 'Downtown',
        capacity: 0,
        stage_layout: {
          indoor_main_stage: false,
          outdoor_patio: false,
          dual_stage_setup: false
        },
        operating_hours: {
          open_time: '17:00',
          close_time: '02:00',
          live_set_window_start: '20:00',
          live_set_window_end: '01:30'
        },
        amenities: {
          patio_outdoor_access: false,
          smoking_policy: 'Non-Smoking',
          liquor_licensing: 'Full Bar',
          age_limits: '21+ Only',
          sound_profile_genres: ['Acoustic']
        },
        telemetry: {
          decibel_threshold_target_db: 85,
          live_telemetry_stream_connected: false
        },
        is_active: true
      });
      expect(() => new Date(sanitizedPayload.updated_at).toISOString()).not.toThrow();
      expect(new Date(sanitizedPayload.updated_at).toISOString()).toBe(sanitizedPayload.updated_at);
    });
  });

  describe('valid blueprint', () => {
    it('returns the exact success message and trims the venue name', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint(validBlueprint);
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.message).toBe(
        'UPDATE SUCCESS: Venue Studio payload validated and sanitized with zero errors.'
      );
      expect(result.sanitizedPayload.venue_name).toBe('Empire Control Room');
    });

    it('maps the full payload to the snake_case wire convention verbatim', () => {
      const { sanitizedPayload } = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint(validBlueprint);
      expect(sanitizedPayload).toEqual({
        venue_name: 'Empire Control Room',
        district: 'Red River Cultural District',
        capacity: 150,
        stage_layout: {
          indoor_main_stage: true,
          outdoor_patio: true,
          dual_stage_setup: false
        },
        operating_hours: {
          open_time: '17:00',
          close_time: '02:00',
          live_set_window_start: '20:00',
          live_set_window_end: '01:30'
        },
        amenities: {
          patio_outdoor_access: true,
          smoking_policy: 'Dedicated Patio Only',
          liquor_licensing: 'Full Bar',
          age_limits: '21+ Only',
          sound_profile_genres: ['Country', 'Blues/Rock']
        },
        telemetry: {
          decibel_threshold_target_db: 85,
          live_telemetry_stream_connected: true
        },
        is_active: true,
        updated_at: sanitizedPayload.updated_at
      });
    });

    it('coerces a string capacity to a number', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        ...validBlueprint,
        capacity: '150' as unknown as number
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPayload.capacity).toBe(150);
    });
  });

  describe('partial nested objects', () => {
    it('flags dotted amenity paths in exact order after identity fields', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        venueName: 'Empire Control Room',
        district: 'Red River Cultural District',
        capacity: 150,
        amenities: {} as unknown as AmenitiesAndVibeMatrix
      });
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual([
        'amenities.liquorLicensing',
        'amenities.ageLimits'
      ]);
    });

    it('applies amenity defaults with no missing fields when amenities is absent', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        venueName: 'Empire Control Room',
        district: 'Red River Cultural District',
        capacity: 150
      });
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.sanitizedPayload.amenities).toEqual({
        patio_outdoor_access: false,
        smoking_policy: 'Non-Smoking',
        liquor_licensing: 'Full Bar',
        age_limits: '21+ Only',
        sound_profile_genres: ['Acoustic']
      });
    });
  });

  describe('capacity edges', () => {
    it('flags capacity 0 as missing', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        ...validBlueprint,
        capacity: 0
      });
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['capacity']);
    });

    it('flags negative capacity as missing', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        ...validBlueprint,
        capacity: -5
      });
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['capacity']);
    });

    it('accepts and coerces the string capacity "150"', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        ...validBlueprint,
        capacity: '150' as unknown as number
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPayload.capacity).toBe(150);
      expect(result.missingFields).toEqual([]);
    });
  });

  describe('genre fallback', () => {
    it('falls back to ["Acoustic"] when soundProfileGenres is empty', () => {
      const result = ATXLiveVenueStudioEngine.validateAndSanitizeVenueBlueprint({
        ...validBlueprint,
        amenities: { ...validBlueprint.amenities, soundProfileGenres: [] }
      });
      expect(result.sanitizedPayload.amenities.sound_profile_genres).toEqual(['Acoustic']);
    });
  });
});

describe('ATXLiveVenueStudioEngine.evaluateVibeMatch', () => {
  const venue: VenueStudioRegistrationInput = {
    ...validBlueprint,
    venueName: 'Empire Control Room'
  };

  it('returns 1.0, recommended, with ordered reasons when all filters are met', () => {
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(venue, {
      requirePatio: true,
      requiresFullBar: true,
      targetGenre: 'Country'
    });
    expect(result.matchScore).toBe(1.0);
    expect(result.isRecommended).toBe(true);
    expect(result.matchReasons).toEqual([
      'Outdoor Patio Available',
      'Full Bar Verified',
      'Matches Genre: Country'
    ]);
  });

  it('returns 0.1, not recommended, with no reasons when all filters are unmet', () => {
    const unmetVenue: VenueStudioRegistrationInput = {
      ...venue,
      amenities: {
        hasPatioAndOutdoorAccess: false,
        smokingPolicy: 'Non-Smoking',
        liquorLicensing: 'BYOB',
        ageLimits: '21+ Only',
        soundProfileGenres: ['Electronic']
      }
    };
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(unmetVenue, {
      requirePatio: true,
      requiresFullBar: true,
      targetGenre: 'Country'
    });
    expect(result.matchScore).toBe(0.1);
    expect(result.isRecommended).toBe(false);
    expect(result.matchReasons).toEqual([]);
  });

  it('lands exactly on the 0.7 threshold for a genre-only miss and recommends', () => {
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(venue, {
      targetGenre: 'Hip-Hop'
    });
    expect(result.matchScore).toBe(0.7);
    expect(result.isRecommended).toBe(true);
    expect(result.matchReasons).toEqual([]);
  });

  it('returns 0.65 and does not recommend for a patio-only miss', () => {
    const noPatioVenue: VenueStudioRegistrationInput = {
      ...venue,
      amenities: { ...venue.amenities, hasPatioAndOutdoorAccess: false }
    };
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(noPatioVenue, {
      requirePatio: true
    });
    expect(result.matchScore).toBe(0.65);
    expect(result.isRecommended).toBe(false);
    expect(result.matchReasons).toEqual([]);
  });

  it('returns 1.0 and recommended when no filters are supplied', () => {
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(venue, {});
    expect(result.matchScore).toBe(1.0);
    expect(result.isRecommended).toBe(true);
    expect(result.matchReasons).toEqual([]);
  });

  it('returns the invalid-venue result for null venue data', () => {
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(null as unknown as VenueStudioRegistrationInput, {
      requirePatio: true
    });
    expect(result.matchScore).toBe(0);
    expect(result.isRecommended).toBe(false);
    expect(result.matchReasons).toEqual(['Invalid venue data']);
  });

  it('ignores ageFilter entirely — the paste quirk is preserved', () => {
    const withAgeFilter = ATXLiveVenueStudioEngine.evaluateVibeMatch(venue, {
      requirePatio: true,
      requiresFullBar: true,
      targetGenre: 'Country',
      ageFilter: '21+ Only'
    });
    const withoutAgeFilter = ATXLiveVenueStudioEngine.evaluateVibeMatch(venue, {
      requirePatio: true,
      requiresFullBar: true,
      targetGenre: 'Country'
    });
    expect(withAgeFilter.matchScore).toBe(withoutAgeFilter.matchScore);
    expect(withAgeFilter.isRecommended).toBe(withoutAgeFilter.isRecommended);
    expect(withAgeFilter.matchReasons).toEqual(withoutAgeFilter.matchReasons);
  });

  it('uses the exact match-reason strings', () => {
    const result = ATXLiveVenueStudioEngine.evaluateVibeMatch(venue, {
      requirePatio: true,
      requiresFullBar: true,
      targetGenre: 'Country'
    });
    expect(result.matchReasons).toContain('Outdoor Patio Available');
    expect(result.matchReasons).toContain('Full Bar Verified');
    expect(result.matchReasons).toContain('Matches Genre: Country');
  });
});
