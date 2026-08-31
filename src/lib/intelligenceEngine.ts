/**
 * ATX LIVE INTELLIGENCE DIRECTIVES SDK
 * Module: Predictive & Adaptive Agent Intelligence Layer
 *
 * ATXLiveIntelligenceEngine — predictive & adaptive intelligence layer for
 * the ATXLive municipal suite. Three static evaluators complement PR 31's
 * ATXLiveAgentEngine:
 *
 *  - evaluateDecibelAcceleration: predictive violation guard — dB
 *    acceleration from a readings history, a 5-minute breach prediction,
 *    and the operator's recommended volume drop.
 *  - verifyShowSignal: social & geo show verifier — cross-references a
 *    scheduled show against live venue social signals to produce a
 *    CONFIRMED / DELAYED / CANCELLED status with a confidence score.
 *  - calculateWeatherSurgeYield: surge & weather elasticity — rain
 *    displacement logic that drives foot traffic indoors with an instant
 *    cover promo.
 *
 * The engine is a pure in-app module: every evaluator is static, returns
 * a plain typed result, and never performs I/O. Message wording is kept
 * verbatim from the original paste. The paste's untyped handler and
 * missing types are fixed in TypeScript; the destructured input defaults
 * (readings [], currentDb 80, limitDb 85) are preserved.
 */

/** A venue's decibel telemetry snapshot consumed by the breach predictor. */
export interface DecibelReading {
  /** Stable venue identifier (mirrors the audit row id, e.g. "v-1"). */
  venueId: string;
  /** Array of dB readings taken every 1 min. */
  readingsOverTime: number[];
  /** Current measured decibel level. */
  currentDb: number;
  /** Ordinance decibel cap for the venue. */
  limitDb: number;
}

/** Weather and street-traffic signals consumed by the surge engine. */
export interface WeatherSurgeInput {
  /** Whether it is currently raining at the venue corridor. */
  isRaining: boolean;
  /** Current outdoor temperature in Fahrenheit. */
  outdoorTempF: number;
  /** Foot traffic count in the venue's corridor. */
  corridorTrafficCount: number;
  /** Current venue capacity utilization percentage. */
  capacityPct: number;
}

/** Result of the predictive violation guard. */
export interface DecibelAccelerationResult {
  /** Predicted decibel level 5 minutes out (rounded). */
  predictedDbIn5Min: number;
  /** True when the prediction crosses the ordinance cap. */
  isPreViolationWarning: boolean;
  /** Recommended master-volume drop in dB (0 when stable, floor of 1). */
  recommendedVolumeDropDb: number;
  /** Operator-facing message — stable or CRITICAL ALERT wording. */
  message: string;
}

/** A scheduled show item as consumed by the social verifier. */
export interface ShowItem {
  /** Artist / headliner name. */
  artist: string;
  /** Originally scheduled set time. */
  scheduledTime: string;
}

/** A single live social signal from the venue feed. */
export interface SocialFeedSignal {
  /** Raw signal text (status keywords are matched case-insensitively). */
  text: string;
  /** Signal timestamp. */
  timestamp: string;
}

/** Verification outcome for a scheduled show. */
export interface ShowVerification {
  verifiedStatus: "CONFIRMED" | "DELAYED" | "CANCELLED";
  confidenceScore: number;
  adjustedTime: string;
}

/** Surge elasticity decision for the venue. */
export interface WeatherSurgeYield {
  /** Whether an instant indoor cover promo should be issued. */
  triggerIndoorPromo: boolean;
  /** Recommended discount percentage for the promo. */
  recommendedDiscountPct: number;
  /** Operator-facing surge action message. */
  surgeActionMessage: string;
}

export class ATXLiveIntelligenceEngine {
  /**
   * 1. PREDICTIVE VIOLATION GUARD
   * Calculates decibel acceleration (+dB/min) to predict ordinance
   * breaches 5 minutes early.
   */
  public static evaluateDecibelAcceleration(data: DecibelReading): DecibelAccelerationResult {
    const { readingsOverTime = [], currentDb = 80, limitDb = 85 } = data;

    // Calculate acceleration rate over recent readings safely.
    let accelerationRate = 0;
    if (readingsOverTime && readingsOverTime.length >= 2) {
      const delta =
        readingsOverTime[readingsOverTime.length - 1] - readingsOverTime[0];
      accelerationRate = delta / readingsOverTime.length; // dB change per interval
    }

    const predictedDbIn5Min = Math.round(currentDb + accelerationRate * 5);
    const isPreViolationWarning = predictedDbIn5Min > limitDb;
    const recommendedVolumeDropDb = isPreViolationWarning
      ? Math.max(1, predictedDbIn5Min - limitDb + 2)
      : 0;

    let message = "Sound levels stable within municipal limits.";
    if (isPreViolationWarning) {
      message = `CRITICAL ALERT: Volume accelerating at +${accelerationRate.toFixed(1)}dB/min. Predicted breach of ${limitDb}dB cap in ~4 minutes. Lower master volume by -${recommendedVolumeDropDb}dB immediately.`;
    }

    return {
      predictedDbIn5Min,
      isPreViolationWarning,
      recommendedVolumeDropDb,
      message,
    };
  }

  /**
   * 2. SOCIAL & GEO SHOW VERIFIER
   * Cross-references scraped show items against live venue social signals.
   */
  public static verifyShowSignal(
    showItem: ShowItem,
    socialFeedSignals: SocialFeedSignal[] = [],
  ): ShowVerification {
    if (!socialFeedSignals || socialFeedSignals.length === 0) {
      return {
        verifiedStatus: "CONFIRMED",
        confidenceScore: 1.0,
        adjustedTime: showItem.scheduledTime,
      };
    }

    const lowerText = socialFeedSignals
      .map((s) => s.text.toLowerCase())
      .join(" ");

    if (lowerText.includes("cancelled") || lowerText.includes("canceled")) {
      return {
        verifiedStatus: "CANCELLED",
        confidenceScore: 0.95,
        adjustedTime: "N/A",
      };
    }

    if (
      lowerText.includes("running late") ||
      lowerText.includes("pushed back") ||
      lowerText.includes("delayed")
    ) {
      return {
        verifiedStatus: "DELAYED",
        confidenceScore: 0.88,
        adjustedTime: "15 mins late",
      };
    }

    return {
      verifiedStatus: "CONFIRMED",
      confidenceScore: 0.99,
      adjustedTime: showItem.scheduledTime,
    };
  }

  /**
   * 3. SURGE & WEATHER ELASTICITY ENGINE
   * Adjusts yield pricing and indoor promos based on rain and street
   * traffic shifts.
   */
  public static calculateWeatherSurgeYield(input: WeatherSurgeInput): WeatherSurgeYield {
    const { isRaining, corridorTrafficCount, capacityPct } = input;

    // Rain displacement logic: if raining and corridor has high traffic,
    // drive foot traffic indoors fast.
    if (isRaining && corridorTrafficCount > 6000 && capacityPct < 75) {
      return {
        triggerIndoorPromo: true,
        recommendedDiscountPct: 25,
        surgeActionMessage:
          "RAIN DISPLACEMENT DETECTED: Issued instant 25% indoor cover promo to capture street traffic.",
      };
    }

    return {
      triggerIndoorPromo: false,
      recommendedDiscountPct: 0,
      surgeActionMessage: "Standard yield strategy active.",
    };
  }
}
