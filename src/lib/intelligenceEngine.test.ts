import { describe, expect, it } from "vitest";
import {
  ATXLiveIntelligenceEngine,
  type DecibelReading,
  type ShowItem,
  type WeatherSurgeInput,
} from "@/lib/intelligenceEngine";

const BASE_READING: DecibelReading = {
  venueId: "v-1",
  readingsOverTime: [80, 81, 82],
  currentDb: 84,
  limitDb: 85,
};

const BASE_SURGE: WeatherSurgeInput = {
  isRaining: true,
  outdoorTempF: 72,
  corridorTrafficCount: 7000,
  capacityPct: 60,
};

describe("evaluateDecibelAcceleration", () => {
  it("computes positive acceleration from rising readings and predicts the 5-minute level", () => {
    // delta = 84 - 80 = 4 over 3 readings → rate = 4/3 dB per interval.
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [80, 81, 84],
      currentDb: 84,
      limitDb: 85,
    });
    expect(res.predictedDbIn5Min).toBe(91); // round(84 + (4/3) * 5)
    expect(res.isPreViolationWarning).toBe(true);
    expect(res.recommendedVolumeDropDb).toBe(8); // max(1, 91 - 85 + 2)
  });

  it("formats the CRITICAL ALERT message with the paste's exact wording", () => {
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [80, 81, 84],
      currentDb: 84,
      limitDb: 85,
    });
    expect(res.message).toBe(
      "CRITICAL ALERT: Volume accelerating at +1.3dB/min. Predicted breach of 85dB cap in ~4 minutes. Lower master volume by -8dB immediately.",
    );
  });

  it("recommends a drop on a minimal breach and never below 1 dB", () => {
    // Minimal breach: delta = 86 - 84 = 2 over 3 readings → rate ≈ 0.67;
    // predicted = round(86 + 3.33) = 89 → max(1, 89 - 85 + 2) = 6.
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [84, 85, 86],
      currentDb: 86,
      limitDb: 85,
    });
    expect(res.predictedDbIn5Min).toBe(89); // round(86 + (2/3) * 5)
    expect(res.isPreViolationWarning).toBe(true);
    expect(res.recommendedVolumeDropDb).toBe(6); // max(1, 89 - 85 + 2)
    expect(res.recommendedVolumeDropDb).toBeGreaterThanOrEqual(1);
  });

  it("never recommends a drop below 1 dB across breach magnitudes", () => {
    for (const currentDb of [86, 90, 100, 120]) {
      const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
        ...BASE_READING,
        readingsOverTime: [currentDb, currentDb],
        currentDb,
        limitDb: 85,
      });
      expect(res.isPreViolationWarning).toBe(true);
      expect(res.recommendedVolumeDropDb).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns the stable message when readings are flat", () => {
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [82, 82, 82],
      currentDb: 82,
      limitDb: 85,
    });
    expect(res.predictedDbIn5Min).toBe(82);
    expect(res.isPreViolationWarning).toBe(false);
    expect(res.recommendedVolumeDropDb).toBe(0);
    expect(res.message).toBe("Sound levels stable within municipal limits.");
  });

  it("treats fewer than two readings as zero acceleration", () => {
    const empty = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [],
      currentDb: 84,
      limitDb: 85,
    });
    expect(empty.predictedDbIn5Min).toBe(84);
    expect(empty.isPreViolationWarning).toBe(false);
    expect(empty.message).toBe("Sound levels stable within municipal limits.");

    const single = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [84],
      currentDb: 84,
      limitDb: 85,
    });
    expect(single.predictedDbIn5Min).toBe(84);
    expect(single.isPreViolationWarning).toBe(false);
  });

  it("predicts a breach from rising readings alone", () => {
    // delta = 90 - 80 = 10 over 2 readings → rate = 5 dB per interval.
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [80, 90],
      currentDb: 90,
      limitDb: 85,
    });
    expect(res.predictedDbIn5Min).toBe(115); // round(90 + 5 * 5)
    expect(res.isPreViolationWarning).toBe(true);
    expect(res.recommendedVolumeDropDb).toBe(32); // 115 - 85 + 2
  });

  it("keeps the paste's input defaults when fields are omitted", () => {
    // Destructuring defaults: readings [], currentDb 80, limitDb 85.
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      venueId: "v-1",
    } as DecibelReading);
    expect(res.predictedDbIn5Min).toBe(80);
    expect(res.isPreViolationWarning).toBe(false);
    expect(res.recommendedVolumeDropDb).toBe(0);
    expect(res.message).toBe("Sound levels stable within municipal limits.");
  });

  it("treats a prediction exactly at the limit as stable (strict > comparison)", () => {
    const res = ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
      ...BASE_READING,
      readingsOverTime: [85, 85],
      currentDb: 85,
      limitDb: 85,
    });
    expect(res.predictedDbIn5Min).toBe(85);
    expect(res.isPreViolationWarning).toBe(false);
    expect(res.message).toBe("Sound levels stable within municipal limits.");
  });
});

describe("verifyShowSignal", () => {
  const show: ShowItem = { artist: "Rattlesnake Milk", scheduledTime: "10:30 PM" };

  it("returns CONFIRMED at 1.0 with the unchanged time when no signals exist", () => {
    expect(ATXLiveIntelligenceEngine.verifyShowSignal(show)).toEqual({
      verifiedStatus: "CONFIRMED",
      confidenceScore: 1.0,
      adjustedTime: "10:30 PM",
    });
    expect(ATXLiveIntelligenceEngine.verifyShowSignal(show, [])).toEqual({
      verifiedStatus: "CONFIRMED",
      confidenceScore: 1.0,
      adjustedTime: "10:30 PM",
    });
  });

  it("returns CANCELLED at 0.95 with 'N/A' on the British spelling", () => {
    const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
      { text: "Show cancelled tonight", timestamp: "2026-08-31T01:00:00Z" },
    ]);
    expect(res).toEqual({
      verifiedStatus: "CANCELLED",
      confidenceScore: 0.95,
      adjustedTime: "N/A",
    });
  });

  it("matches the American 'canceled' spelling too", () => {
    const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
      { text: "canceled due to weather", timestamp: "2026-08-31T01:00:00Z" },
    ]);
    expect(res.verifiedStatus).toBe("CANCELLED");
    expect(res.confidenceScore).toBe(0.95);
    expect(res.adjustedTime).toBe("N/A");
  });

  it("matches cancellation keywords case-insensitively", () => {
    const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
      { text: "CANCELLED — venue posting", timestamp: "2026-08-31T01:00:00Z" },
    ]);
    expect(res.verifiedStatus).toBe("CANCELLED");
    expect(res.confidenceScore).toBe(0.95);
  });

  it("returns DELAYED at 0.88 with '15 mins late' for running late signals", () => {
    const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
      { text: "band is running late", timestamp: "2026-08-31T01:00:00Z" },
    ]);
    expect(res).toEqual({
      verifiedStatus: "DELAYED",
      confidenceScore: 0.88,
      adjustedTime: "15 mins late",
    });
  });

  it("returns DELAYED for 'pushed back' and 'delayed' variants", () => {
    for (const text of ["set pushed back", "soundcheck delayed"]) {
      const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
        { text, timestamp: "2026-08-31T01:00:00Z" },
      ]);
      expect(res.verifiedStatus).toBe("DELAYED");
      expect(res.confidenceScore).toBe(0.88);
      expect(res.adjustedTime).toBe("15 mins late");
    }
  });

  it("returns CONFIRMED at 0.99 with the unchanged time for unrelated signals", () => {
    const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
      { text: "crowd is hyped tonight", timestamp: "2026-08-31T01:00:00Z" },
    ]);
    expect(res).toEqual({
      verifiedStatus: "CONFIRMED",
      confidenceScore: 0.99,
      adjustedTime: "10:30 PM",
    });
  });

  it("joins multiple signals before keyword matching", () => {
    const res = ATXLiveIntelligenceEngine.verifyShowSignal(show, [
      { text: "doors open", timestamp: "2026-08-31T01:00:00Z" },
      { text: "hearing the set is delayed", timestamp: "2026-08-31T01:05:00Z" },
    ]);
    expect(res.verifiedStatus).toBe("DELAYED");
    expect(res.confidenceScore).toBe(0.88);
  });
});

describe("calculateWeatherSurgeYield", () => {
  it("triggers the 25% indoor promo on rain + high traffic + low capacity", () => {
    const res = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield(BASE_SURGE);
    expect(res).toEqual({
      triggerIndoorPromo: true,
      recommendedDiscountPct: 25,
      surgeActionMessage:
        "RAIN DISPLACEMENT DETECTED: Issued instant 25% indoor cover promo to capture street traffic.",
    });
  });

  it("stays standard at the exact boundary: traffic 6000 and capacity 75", () => {
    // Strict thresholds: traffic must exceed 6000, capacity must be below 75.
    const atTrafficBoundary = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield({
      ...BASE_SURGE,
      corridorTrafficCount: 6000,
      capacityPct: 60,
    });
    expect(atTrafficBoundary.triggerIndoorPromo).toBe(false);

    const atCapacityBoundary = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield({
      ...BASE_SURGE,
      corridorTrafficCount: 7000,
      capacityPct: 75,
    });
    expect(atCapacityBoundary.triggerIndoorPromo).toBe(false);
  });

  it("triggers just past the boundary: traffic 6001 and capacity 74.9", () => {
    const res = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield({
      ...BASE_SURGE,
      corridorTrafficCount: 6001,
      capacityPct: 74.9,
    });
    expect(res.triggerIndoorPromo).toBe(true);
    expect(res.recommendedDiscountPct).toBe(25);
  });

  it("stays standard when it is not raining regardless of traffic", () => {
    const res = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield({
      ...BASE_SURGE,
      isRaining: false,
    });
    expect(res).toEqual({
      triggerIndoorPromo: false,
      recommendedDiscountPct: 0,
      surgeActionMessage: "Standard yield strategy active.",
    });
  });

  it("ignores outdoorTempF in the trigger decision", () => {
    const hot = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield({
      ...BASE_SURGE,
      outdoorTempF: 105,
    });
    expect(hot.triggerIndoorPromo).toBe(true);

    const cold = ATXLiveIntelligenceEngine.calculateWeatherSurgeYield({
      ...BASE_SURGE,
      outdoorTempF: 40,
    });
    expect(cold.triggerIndoorPromo).toBe(true);
  });
});
