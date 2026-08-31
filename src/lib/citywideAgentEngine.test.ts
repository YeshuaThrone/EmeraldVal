import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATXLiveCitywideAgentEngine,
  ATXCivicPageLayoutPatcher,
  ATXTelemetryPoint,
  ATXVenueProfile
} from './citywideAgentEngine';

const venue: ATXVenueProfile = {
  venueId: 'venue-78704',
  venueName: 'Empire Control Room',
  city: 'Austin',
  state: 'TX',
  zipCode: '78704',
  address: '606 Red River St',
  municipalCapDb: 85,
  isLive: true
};

const point = (
  type: ATXTelemetryPoint['type'],
  value: number,
  overrides: Partial<ATXTelemetryPoint> = {}
): ATXTelemetryPoint => ({
  sensorId: 'sensor-001',
  type,
  value,
  unit: type === 'DECIBEL_GUARD' ? 'dB' : 'capacity_percentage',
  timestamp: 1,
  ...overrides
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
});

describe('ATXLiveCitywideAgentEngine.ingestTelemetry', () => {
  it('routes only DECIBEL_GUARD to ordinance evaluation', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    expect(engine.ingestTelemetry(point('FOOT_TRAFFIC_HEATMAP', 72))).toBeNull();
    expect(
      engine.ingestTelemetry(point('STAGE_AUDIO_STATION', 60))
    ).toBeNull();
    expect(
      engine.ingestTelemetry(point('DECIBEL_GUARD', 84))?.status
    ).toBe('WARNING_THRESHOLD');
  });

  it('returns null for a dB reading below the warning band', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    expect(engine.ingestTelemetry(point('DECIBEL_GUARD', 79.9))).toBeNull();
  });

  it('caps telemetry history at 1000 points, dropping the oldest', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    for (let i = 0; i < 1000; i += 1) {
      engine.ingestTelemetry(
        point('FOOT_TRAFFIC_HEATMAP', i, { timestamp: i })
      );
    }
    // The 1001st ingest crosses the cap and exercises the shift branch:
    // the engine stays healthy and keeps evaluating ordinance bands.
    engine.ingestTelemetry(point('DECIBEL_GUARD', 84, { timestamp: 1000 }));
    expect(engine.getAustinControlRoomMetrics().lastDbReading).toBe(84);
  });
});

describe('evaluateCityOrdinance (via ingestTelemetry)', () => {
  it('fires CRITICAL at exactly the municipal cap with the exact message and action', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    const alert = engine.ingestTelemetry(
      point('DECIBEL_GUARD', 85, { timestamp: 1 })
    );
    expect(alert).toEqual({
      alertId: `alert_${Date.now()}`,
      venueId: 'venue-78704',
      status: 'CRITICAL_MUNICIPAL_CAP',
      message:
        'Austin City Ordinance Limit (85 dB) reached at Empire Control Room.',
      suggestedAction: 'TRIGGER_AUTOMATED_MASTER_DROP_3DB'
    });
  });

  it('fires WARNING_THRESHOLD from cap - 5 with the exact message and action', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    const alert = engine.ingestTelemetry(
      point('DECIBEL_GUARD', 82, { timestamp: 2 })
    );
    expect(alert).toEqual({
      alertId: `alert_${Date.now()}`,
      venueId: 'venue-78704',
      status: 'WARNING_THRESHOLD',
      message:
        'Approaching Austin sound ordinance cap (85 dB). Currently at 82 dB.',
      suggestedAction: 'NOTIFY_VENUE_OPERATOR_DASHBOARD'
    });
  });

  it('stays quiet below cap - 5 and keeps the boundary inclusive', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    expect(engine.ingestTelemetry(point('DECIBEL_GUARD', 79))).toBeNull();
    expect(engine.ingestTelemetry(point('DECIBEL_GUARD', 0))).toBeNull();
    expect(
      engine.ingestTelemetry(point('DECIBEL_GUARD', 85))?.status
    ).toBe('CRITICAL_MUNICIPAL_CAP');
    expect(
      engine.ingestTelemetry(point('DECIBEL_GUARD', 80))?.status
    ).toBe('WARNING_THRESHOLD');
  });
});

describe('getAustinControlRoomMetrics', () => {
  it('reports the verbatim location string and the last DECIBEL_GUARD reading', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    engine.ingestTelemetry(point('DECIBEL_GUARD', 81, { timestamp: 1 }));
    engine.ingestTelemetry(point('DECIBEL_GUARD', 83, { timestamp: 2 }));
    engine.ingestTelemetry(
      point('FOOT_TRAFFIC_HEATMAP', 95, { timestamp: 3 })
    );
    expect(engine.getAustinControlRoomMetrics()).toEqual({
      venueName: 'Empire Control Room',
      location: '606 Red River St, Austin, TX 78704',
      lastDbReading: 83,
      status: 'ACTIVE_SHOW_IN_PROGRESS'
    });
  });

  it('reports 0 dB and STANDBY when no telemetry has arrived', () => {
    const engine = new ATXLiveCitywideAgentEngine({
      ...venue,
      isLive: false
    });
    expect(engine.getAustinControlRoomMetrics()).toEqual({
      venueName: 'Empire Control Room',
      location: '606 Red River St, Austin, TX 78704',
      lastDbReading: 0,
      status: 'STANDBY'
    });
  });

  it('ignores non-decibel points when finding the last dB reading', () => {
    const engine = new ATXLiveCitywideAgentEngine(venue);
    engine.ingestTelemetry(point('DECIBEL_GUARD', 77, { timestamp: 1 }));
    engine.ingestTelemetry(
      point('FOOT_TRAFFIC_HEATMAP', 40, { timestamp: 2 })
    );
    expect(engine.getAustinControlRoomMetrics().lastDbReading).toBe(77);
  });
});

describe('ATXCivicPageLayoutPatcher.applyContainerSweep', () => {
  it('returns the exact sweep descriptor verbatim', () => {
    expect(ATXCivicPageLayoutPatcher.applyContainerSweep()).toEqual({
      targetComponent: 'MunicipalAnalyticsContainer',
      targetElements: [
        'DistrictSoundIndexCard',
        'DensityIndexCard',
        'PlaceholderHarness'
      ],
      cssPatches: {
        overflow: 'hidden',
        wordBreak: 'break-word',
        padding: '0.75rem',
        flexWrap: 'wrap'
      }
    });
  });

  it('returns a fresh descriptor each call', () => {
    const first = ATXCivicPageLayoutPatcher.applyContainerSweep();
    first.targetElements.pop();
    expect(
      ATXCivicPageLayoutPatcher.applyContainerSweep().targetElements
    ).toHaveLength(3);
  });
});
