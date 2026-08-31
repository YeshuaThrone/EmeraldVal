/**
 * @module @atxlive/sdk/venue-studio-complete-pipeline
 * @version 3.5.0
 *
 * The user's pasted ATX LIVE SDK v3.5.0 — Venue Studio Blueprint Engine,
 * Layout Fix, SQLite Isolation, and Production Push Directive — verbatim
 * (schema, seed instance, layout patcher, Vercel deployment guard, and
 * pipeline execution controller; directive: UI-parity with the Artist
 * Studio configuration workflow).
 *
 * Directive mapping notes:
 * - Layout Render Fix: src/app/venue/page.tsx already mounts cleanly
 *   (min-h-dvh backdrop, scrollable card with overflow-y-auto) — the
 *   patcher's descriptor ships here verbatim; no markup change needed.
 * - SQLite Isolation: no 'use client' component imports better-sqlite3 or
 *   src/lib/server (pinned by a test in venueStudioBlueprint.test.ts).
 */

// ==========================================
// 1. VENUE STUDIO BLUEPRINT ENGINE SCHEMA
// ==========================================

export type ATXDistrict =
  | 'DOWNTOWN'
  | 'EAST_AUSTIN'
  | 'RED_RIVER'
  | 'SOUTH_LAMAR'
  | 'RAINEY'
  | 'DOMAIN'
  | 'SOUTH_CONGRESS'
  | 'GREATER_AUSTIN';

export type StageLayoutType =
  | 'INDOOR_MAIN_STAGE'
  | 'OUTDOOR_PATIO'
  | 'DUAL_STAGE_SETUP';

export type SmokingPolicyType =
  | 'NON_SMOKING'
  | 'DEDICATED_PATIO'
  | 'OUTDOOR_ALLOWED';

export type LicensingType =
  | 'FULL_BAR'
  | 'BEER_AND_WINE_ONLY'
  | 'BYOB'
  | 'KITCHEN_AVAILABLE';

export type AgeRestrictionType = '21_PLUS' | '18_PLUS' | 'ALL_AGES';

export type DominantGenre =
  | 'COUNTRY'
  | 'HIP_HOP'
  | 'BLUES_ROCK'
  | 'ACOUSTIC'
  | 'ELECTRONIC';

export interface VenueStudioBlueprintProfile {
  // 1. Core Identity (Mirrors Artist Studio Setup)
  venueName: string;
  district: ATXDistrict;
  capacity: number;
  stageLayout: StageLayoutType;
  operatingHours: string;
  liveSetWindows: string;
  // 2. Amenities & Vibe Matrix (Tourist & Fan Matching)
  amenities: {
    patioAndOutdoorAccess: boolean;
    smokingPolicy: SmokingPolicyType;
    liquorLicensing: LicensingType;
    ageLimits: AgeRestrictionType;
    dominantGenres: DominantGenre[];
  };
  // 3. Sound Telemetry & Compliance Opt-In
  telemetryConfig: {
    decibelThresholdCapDb: number; // e.g., 85 dB outdoor cap
    liveTelemetryStreamOptIn: boolean;
    sensorId?: string;
  };
  isConfigured: boolean;
  isLive: boolean;
}

// Default Austin Blueprint Seed Instance
export const DefaultVenueBlueprint: VenueStudioBlueprintProfile = {
  venueName: 'Austin Live Control Room',
  district: 'DOWNTOWN',
  capacity: 250,
  stageLayout: 'INDOOR_MAIN_STAGE',
  operatingHours: '4:00 PM - 2:00 AM',
  liveSetWindows: '8:00 PM - 1:30 AM',
  amenities: {
    patioAndOutdoorAccess: true,
    smokingPolicy: 'DEDICATED_PATIO',
    liquorLicensing: 'FULL_BAR',
    ageLimits: '21_PLUS',
    dominantGenres: ['BLUES_ROCK', 'COUNTRY', 'ACOUSTIC']
  },
  telemetryConfig: {
    decibelThresholdCapDb: 85,
    liveTelemetryStreamOptIn: true,
    sensorId: 'sensor_atx_demo_01'
  },
  isConfigured: true,
  isLive: true
};

// ==========================================
// 2. VENUE STUDIO LAYOUT & RENDER FIX
// ==========================================

export interface VenueStudioLayoutPatch {
  targetComponent: 'VenueStudioContainer' | 'VenueStudioControlRoom' | 'TelemetryDashboard';
  layoutFixes: {
    display: 'flex';
    minHeight: '100vh';
    overflow: 'auto';
    forceMount: true;
  };
}

export const ATXVenueStudioLayoutPatcher = {
  applyStudioLayoutFix: (): VenueStudioLayoutPatch => {
    return {
      targetComponent: 'VenueStudioContainer',
      layoutFixes: {
        display: 'flex',
        minHeight: '100vh',
        overflow: 'auto',
        forceMount: true
      }
    };
  }
};

// ==========================================
// 3. VERCEL DEPLOYMENT & SQLITE ISOLATION
// ==========================================

export interface VercelBuildConfiguration {
  sqliteStrategy: 'MOCK_IN_MEMORY_FOR_CLIENT' | 'EXTERNAL_POSTGRES';
  enableClientHydrationFallback: boolean;
}

export const VercelDeploymentGuard = {
  getBuildDirectives: (): VercelBuildConfiguration => {
    return {
      sqliteStrategy: 'MOCK_IN_MEMORY_FOR_CLIENT',
      enableClientHydrationFallback: true
    };
  }
};

// ==========================================
// 4. GIT EXECUTION & AUTO-PUSH DIRECTIVE
// ==========================================

export interface GitPushPipelineDirective {
  targetBranch: 'main';
  commitMessage: string;
  autoDeployVercel: true;
}

export const PipelineExecutionController = {
  triggerDeploymentPipeline: (): GitPushPipelineDirective => {
    return {
      targetBranch: 'main',
      commitMessage:
        'fix: execute venue studio blueprint engine, hydrate studio layout, isolate client sqlite',
      autoDeployVercel: true
    };
  }
};
