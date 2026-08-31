import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ATXLiveVenueStudioEngine,
  TelemetryFeed,
  VenueMetadata
} from './venueStudioPipeline';

const configuredVenue: VenueMetadata = {
  venueId: 'v-001',
  name: 'Empire Control Room',
  municipalLicenseId: 'AUS-LIC-0042',
  address: '606 Red River St, Austin, TX',
  ordinanceCapDb: 85,
  isConfigured: true
};

const feed = (streamId: string, overrides: Partial<TelemetryFeed> = {}): TelemetryFeed => ({
  streamId,
  sensorType: 'IOT_DECIBEL_GUARD',
  currentValue: 84,
  unit: 'dB',
  timestamp: 1,
  ...overrides
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('constructor mode selection', () => {
  it('defaults to a null venue and ONBOARDING_REQUIRED mode', () => {
    const engine = new ATXLiveVenueStudioEngine();
    const state = engine.mountProductionStudio(feed('s1'));
    expect(state.mode).toBe('ONBOARDING_REQUIRED');
    expect(state.venue).toBeNull();
    expect(state.activeSensors).toEqual([]);
  });

  it('starts in PRODUCTION for a configured venue', () => {
    const engine = new ATXLiveVenueStudioEngine(configuredVenue);
    const state = engine.mountProductionStudio(feed('s1'));
    expect(state.mode).toBe('PRODUCTION');
    expect(state.venue).toEqual(configuredVenue);
  });

  it('starts in ONBOARDING_REQUIRED for a present but unconfigured venue', () => {
    const engine = new ATXLiveVenueStudioEngine({
      ...configuredVenue,
      isConfigured: false
    });
    const state = engine.mountProductionStudio(feed('s1'));
    expect(state.mode).toBe('ONBOARDING_REQUIRED');
  });
});

describe('getOnboardingPipeline', () => {
  it('returns the exact three-step pipeline verbatim and in order', () => {
    const engine = new ATXLiveVenueStudioEngine();
    expect(engine.getOnboardingPipeline()).toEqual([
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
    ]);
  });

  it('returns a fresh pipeline each call (mutations do not leak)', () => {
    const engine = new ATXLiveVenueStudioEngine();
    engine.getOnboardingPipeline().pop();
    expect(engine.getOnboardingPipeline()).toHaveLength(3);
  });
});

describe('mountProductionStudio', () => {
  it('refuses to mount when no venue is set — no sensors added', () => {
    const engine = new ATXLiveVenueStudioEngine();
    const state = engine.mountProductionStudio(feed('stream-1'));
    expect(state.mode).toBe('ONBOARDING_REQUIRED');
    expect(state.venue).toBeNull();
    expect(state.activeSensors).toEqual([]);
  });

  it('refuses to mount for an unconfigured venue and adds no sensors', () => {
    const engine = new ATXLiveVenueStudioEngine({ ...configuredVenue, isConfigured: false });
    const state = engine.mountProductionStudio(feed('s1'));
    expect(state.mode).toBe('ONBOARDING_REQUIRED');
    expect(state.activeSensors).toEqual([]);
    expect(state.venue?.name).toBe('Empire Control Room');
  });

  it('binds a new stream and flips to PRODUCTION for a configured venue', () => {
    const engine = new ATXLiveVenueStudioEngine(configuredVenue);
    const stream = feed('stream-a');
    const state = engine.mountProductionStudio(stream);
    expect(state.mode).toBe('PRODUCTION');
    expect(state.activeSensors).toEqual([stream]);
  });

  it('replaces an existing sensor with the same streamId instead of duplicating', () => {
    const engine = new ATXLiveVenueStudioEngine(configuredVenue);
    engine.mountProductionStudio(feed('stream-a', { timestamp: 1 }));
    const update = feed('stream-a', { currentValue: 92, timestamp: 2 });
    const after = engine.mountProductionStudio(update);
    expect(after.activeSensors).toHaveLength(1);
    expect(after.activeSensors[0]).toBe(update);
    expect(after.activeSensors[0].currentValue).toBe(92);
  });

  it('appends sensors with distinct streamIds in mount order', () => {
    const engine = new ATXLiveVenueStudioEngine(configuredVenue);
    engine.mountProductionStudio(feed('stream-a'));
    const state = engine.mountProductionStudio(
      feed('stream-b', { sensorType: 'HEATMAP_CAMERA', currentValue: 12, unit: 'count' })
    );
    expect(state.activeSensors).toHaveLength(2);
    expect(state.activeSensors.map(s => s.streamId)).toEqual(['stream-a', 'stream-b']);
  });

  it('keeps state isolated between engine instances', () => {
    const a = new ATXLiveVenueStudioEngine(configuredVenue);
    const b = new ATXLiveVenueStudioEngine(configuredVenue);
    a.mountProductionStudio(feed('s1'));
    // Discriminator: if state were shared, b's mount of s2 would append and
    // report two sensors; isolated state has only b's own mount.
    expect(b.mountProductionStudio(feed('s2')).activeSensors).toHaveLength(1);
    expect(a.mountProductionStudio(feed('s1')).activeSensors).toHaveLength(1);
  });
});

describe('purgeSimulationState', () => {
  it('is a safe no-op when window is undefined (node runtime)', () => {
    const engine = new ATXLiveVenueStudioEngine();
    expect(() => engine.purgeSimulationState()).not.toThrow();
  });

  it('removes exactly the atx_simulated_fader_state key when localStorage exists', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { removeItem } });
    new ATXLiveVenueStudioEngine().purgeSimulationState();
    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith('atx_simulated_fader_state');
  });

  it('does nothing when window.localStorage is absent', () => {
    vi.stubGlobal('window', {});
    const engine = new ATXLiveVenueStudioEngine();
    expect(() => engine.purgeSimulationState()).not.toThrow();
  });
});
