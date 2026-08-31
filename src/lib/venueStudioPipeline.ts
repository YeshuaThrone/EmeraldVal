/**
 * ATX LIVE VENUE STUDIO SDK (v2.1.1) — Venue Studio Onboarding & Telemetry
 * Pipeline Controller. User's pasted module, kept byte-faithful: exact
 * onboarding pipeline, production mount semantics (upsert by streamId,
 * onboarding gate when the venue is unconfigured), and the
 * `atx_simulated_fader_state` localStorage purge. The class name matches the
 * pasted SDK; it is a separate concern from the static registration engine in
 * `venueStudioEngine.ts` (UPDATE v1.1) and the two coexist under distinct paths.
 *
 * Execution directives carried from the paste (not implemented here — they
 * govern a UI/wiring round): reject local fader simulation, mount this
 * controller into the app router, force the onboarding pipeline while
 * `venue.isConfigured === false`, and bind `mountProductionStudio` to the
 * WebSocket telemetry stream.
 */
export type SensorType = 'IOT_DECIBEL_GUARD' | 'HEATMAP_CAMERA' | 'AUDIO_STATION';
export type StudioMode = 'PRODUCTION' | 'ONBOARDING_REQUIRED';
export interface TelemetryFeed {
  streamId: string;
  sensorType: SensorType;
  currentValue: number;
  unit: 'dB' | 'count' | 'percentage';
  timestamp: number;
}
export interface VenueMetadata {
  venueId: string;
  name: string;
  municipalLicenseId: string;
  address: string;
  ordinanceCapDb: number;
  isConfigured: boolean;
}
export interface OnboardingStep {
  stepId: number;
  title: string;
  fields: string[];
  actionToken: string;
}
export interface StudioState {
  mode: StudioMode;
  venue: VenueMetadata | null;
  activeSensors: TelemetryFeed[];
}
export class ATXLiveVenueStudioEngine {
  private state: StudioState;
  constructor(initialVenue: VenueMetadata | null = null) {
    this.state = {
      mode: initialVenue?.isConfigured ? 'PRODUCTION' : 'ONBOARDING_REQUIRED',
      venue: initialVenue,
      activeSensors: []
    };
  }
  /**
   * PURGE HARDCODED SIMULATION STUBS
   * Replaces local state slider / fallback simulation with dynamic routing
   */
  public purgeSimulationState(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('atx_simulated_fader_state');
    }
  }
  /**
   * ONBOARDING FLOW SCHEDULER
   * Renders when venue configuration is incomplete
   */
  public getOnboardingPipeline(): OnboardingStep[] {
    return [
      {
        stepId: 1,
        title: 'Venue Verification',
        fields: ['venue_name', 'municipal_license_id', 'address'],
        actionToken: 'LINK_OPERATOR_IDENTITY'
      },
      {
        stepId: 2,
        title: 'Sensor Hardware Binding',
        fields: ['sensor_type', 'mac_address', 'stream_url'],
        actionToken: 'VERIFY_LIVE_STREAM_HANDSHAKE'
      },
      {
        stepId: 3,
        title: 'Municipal Ordinance Rules',
        fields: ['ordinance_cap_db', 'automated_drop_threshold'],
        actionToken: 'SET_AUTOMATED_PREDICTIVE_DROPS'
      }
    ];
  }
  /**
   * PRODUCTION DASHBOARD MOUNT
   * Binds UI components to live telemetry socket stream
   */
  public mountProductionStudio(stream: TelemetryFeed): StudioState {
    if (!this.state.venue || !this.state.venue.isConfigured) {
      this.state.mode = 'ONBOARDING_REQUIRED';
      return this.state;
    }
    this.state.mode = 'PRODUCTION';
    const index = this.state.activeSensors.findIndex(s => s.streamId === stream.streamId);

    if (index >= 0) {
      this.state.activeSensors[index] = stream;
    } else {
      this.state.activeSensors.push(stream);
    }

    return this.state;
  }
}
