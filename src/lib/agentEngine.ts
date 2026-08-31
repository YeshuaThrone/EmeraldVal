/**
 * ATXLiveAgentEngine — parallel micro-agent orchestration for the ATXLive
 * municipal suite. Three agents run behind a single Promise.all loop:
 *
 *  - runComplianceAgent: per-venue decibel ordinance evaluation with a
 *    graceful empty-input envelope, plus the raw MBGRT machine yield.
 *  - runLineupScraperAgent: show-feed normalization with a verified
 *    fallback dataset when the live feed is empty.
 *  - runYieldAgent: dynamic ticketing strategy selection from foot
 *    traffic and stage capacity signals.
 *
 * The engine is a pure in-app module: every agent returns a typed
 * AgentResponse envelope and never performs I/O. Supabase is a declared
 * future target — the constructor accepts and stores supabaseUrl /
 * supabaseAnonKey per the original paste, but no method ever calls
 * Supabase (no new dependency, no credentials required). Revisit when
 * credentials exist and an explicit integration decision is made.
 *
 * Math alignment: venue defaults come from civic's VENUE_AUDIT_ROWS and
 * the yield derives from civic's GROSS_BEVERAGE_RECEIPTS_USD × MBGRT_RATE
 * — the same product the dashboard formats as $9,548. The engine keeps
 * the paste's raw machine format ("9547.50"); the dashboard keeps its
 * formatted figure. Both derive from one source and can never disagree.
 */

import {
  GROSS_BEVERAGE_RECEIPTS_USD,
  MBGRT_RATE,
  VENUE_AUDIT_ROWS,
} from "./civic";
import { deriveDecimalPercent } from "./telemetry";

/** One venue node as consumed by the compliance agent. */
export interface VenueNode {
  /** Stable venue identifier (mirrors the audit row id, e.g. "v-1"). */
  id: string;
  /** Venue display name. */
  name: string;
  /** Current measured decibel level. */
  currentDb: number;
  /** Ordinance decibel cap for the venue. */
  limitDb: number;
}

/** A single ordinance violation raised by the compliance agent. */
export interface ComplianceAlert {
  /** Venue node identifier the alert belongs to. */
  venueId: string;
  /** Venue display name. */
  venueName: string;
  /** Decibels over the ordinance cap (currentDb − limitDb). */
  deltaDb: number;
  /** Alert severity — every violation is HIGH_PRIORITY in this contract. */
  severity: "HIGH_PRIORITY";
}

/**
 * Compliance telemetry payload. mbgrtTaxYield is the raw machine format
 * per the paste — (receipts × rate).toFixed(2), e.g. "9547.50" — while
 * the dashboard keeps its formatted "$9,548" rendering of the same
 * product.
 */
export interface TelemetryPayload {
  /** Evaluated compliance rate, one decimal place (e.g. "60.0%"). */
  complianceRate: string;
  /** Count of venues over their ordinance cap. */
  violationsCount: number;
  /** Count of venue nodes actually evaluated. */
  evaluatedNodes: number;
  /** Gross beverage receipts backing the yield (civic constant). */
  grossBeverageReceipts: number;
  /** Raw machine-format MBGRT yield, e.g. "9547.50". */
  mbgrtTaxYield: string;
  /** HIGH_PRIORITY alerts, one per violating venue. */
  alerts: ComplianceAlert[];
}

/** One normalized show in the lineup payload. */
export interface LineupShow {
  /** Show identifier (normalized to show-1, show-2, … when absent). */
  id: string;
  /** Artist display name. */
  artist: string;
  /** Stage name. */
  stage: string;
  /** Set time label, e.g. "11:30 PM". */
  setTime: string;
  /** Show status, e.g. "CONFIRMED". */
  status: string;
  /** Whether the act is local — unspecified counts as local. */
  isLocal: boolean;
}

/** Lineup agent payload: normalized feed plus derived local share. */
export interface LineupPayload {
  /** LIVE_FEED when a raw feed was provided, VERIFIED_FALLBACK otherwise. */
  status: "LIVE_FEED" | "VERIFIED_FALLBACK";
  /** Normalized shows, in feed order. */
  shows: LineupShow[];
  /** Share of shows flagged local, one decimal place (e.g. "100.0%"). */
  localSharePct: string;
}

/** Dynamic ticketing strategy chosen by the yield agent. */
export type YieldStrategy =
  | "FLASH_PROMO_HIGH_TRAFFIC"
  | "HIGH_DEMAND_CAPACITY_LOCK"
  | "STANDARD_PEAK";

/** Yield agent payload for the dynamic ticketing loop. */
export interface YieldPayload {
  /** Pricing strategy selected for the current conditions. */
  strategy: YieldStrategy;
  /** Recommended discount percent (20 for the flash promo, else 0). */
  discountRecommended: number;
  /** "+18.5%" when a discount is recommended, "OPTIMAL" otherwise. */
  projectedYieldBoost: string;
  /** Capacity as a percent label, e.g. "84.2%". */
  activeCapacity: string;
  /** Foot traffic count the strategy was derived from. */
  footTrafficCount: number;
}

/** Typed agent envelope: every agent resolves to one of these. */
export interface AgentResponse<T> {
  /** Stable agent identifier, e.g. "agent-compliance-v1". */
  agentId: string;
  /** ISO-8601 timestamp of when the agent ran. */
  timestamp: string;
  /** False only when the agent's input could not be processed. */
  success: boolean;
  /** The agent's payload on success. */
  data: T;
  /** Error message when success is false. */
  error?: string;
}

/**
 * Raw feed entry accepted by the lineup scraper. Only the display fields
 * are required; id, status, and isLocal normalize with defaults (id →
 * show-N, status → CONFIRMED, isLocal → true).
 */
export interface RawShowFeedEntry {
  id?: string;
  artist: string;
  stage: string;
  setTime: string;
  status?: string;
  isLocal?: boolean;
}

/**
 * The paste's VERIFIED_FALLBACK dataset — verified showings used only
 * when the live feed is empty. The UI keeps the live GET /api/shows
 * feed and never switches to this fallback; it lives in the engine only.
 */
const VERIFIED_FALLBACK_SHOWS: LineupShow[] = [
  {
    id: "show-1",
    artist: "Yeshua Throne",
    stage: "Warehouse Stage",
    setTime: "11:30 PM",
    status: "CONFIRMED",
    isLocal: true,
  },
  {
    id: "show-2",
    artist: "Rattlesnake Milk",
    stage: "Patio Stage",
    setTime: "10:30 PM",
    status: "CONFIRMED",
    isLocal: true,
  },
];

/** Default venue nodes — civic's audit rows mapped to the node shape. */
const DEFAULT_VENUE_NODES: VenueNode[] = VENUE_AUDIT_ROWS.map(
  ({ id, name, currentDb, limitDb }) => ({ id, name, currentDb, limitDb }),
);

/** Default foot traffic — matches telemetry's realtimeFootTraffic "14,280". */
export const DEFAULT_FOOT_TRAFFIC_COUNT = 14280;

/** Default stage capacity percent — matches civic's 84.2% utilization. */
export const DEFAULT_CAPACITY_PCT = 84.2;

/**
 * Pure raw MBGRT yield: receipts × rate in the paste's machine format
 * (toFixed(2)), e.g. 142500 × 0.067 → "9547.50". The dashboard's
 * calculateTaxYield formats the same product as "$9,548".
 */
export function deriveRawTaxYield(receipts: number, rate: number): string {
  return (receipts * rate).toFixed(2);
}

/** Normalize a raw feed entry, defaulting id/status/isLocal per the paste. */
function normalizeShow(entry: RawShowFeedEntry, index: number): LineupShow {
  return {
    id: entry.id ?? `show-${index + 1}`,
    artist: entry.artist,
    stage: entry.stage,
    setTime: entry.setTime,
    status: entry.status ?? "CONFIRMED",
    isLocal: entry.isLocal ?? true,
  };
}

export class ATXLiveAgentEngine {
  /**
   * Declared future target (per the paste's "Targets: Supabase Tables").
   * Stored but never used — no Supabase call exists anywhere in this
   * engine. Integration waits for credentials and an explicit decision.
   */
  readonly supabaseUrl: string;

  /** Declared future target — see {@link supabaseUrl}. Never called. */
  readonly supabaseAnonKey: string;

  constructor(supabaseUrl = "", supabaseAnonKey = "") {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
  }

  /**
   * Compliance agent — evaluates the venue nodes it is given. Empty or
   * null input returns the graceful 100% / 0-violations envelope; with no
   * argument the agent evaluates civic's VENUE_AUDIT_ROWS. A malformed
   * (non-array) input resolves to a failure envelope rather than throwing,
   * so executeAll never rejects.
   */
  async runComplianceAgent(
    venueData: VenueNode[] | null = DEFAULT_VENUE_NODES,
  ): Promise<AgentResponse<TelemetryPayload>> {
    const agentId = "agent-compliance-v1";
    try {
      if (venueData == null) {
        venueData = [];
      }
      if (!Array.isArray(venueData)) {
        throw new TypeError(
          "runComplianceAgent expected an array of venue nodes",
        );
      }

      const violations = venueData.filter(
        (venue) => venue.currentDb > venue.limitDb,
      );
      const alerts: ComplianceAlert[] = violations.map((venue) => ({
        venueId: venue.id,
        venueName: venue.name,
        deltaDb: venue.currentDb - venue.limitDb,
        severity: "HIGH_PRIORITY",
      }));
      const complianceRate =
        venueData.length === 0
          ? "100%"
          : `${(
              ((venueData.length - violations.length) / venueData.length) *
              100
            ).toFixed(1)}%`;

      return {
        agentId,
        timestamp: new Date().toISOString(),
        success: true,
        data: {
          complianceRate,
          violationsCount: violations.length,
          evaluatedNodes: venueData.length,
          grossBeverageReceipts: GROSS_BEVERAGE_RECEIPTS_USD,
          mbgrtTaxYield: deriveRawTaxYield(
            GROSS_BEVERAGE_RECEIPTS_USD,
            MBGRT_RATE,
          ),
          alerts,
        },
      };
    } catch (error) {
      return {
        agentId,
        timestamp: new Date().toISOString(),
        success: false,
        data: {
          complianceRate: "100%",
          violationsCount: 0,
          evaluatedNodes: 0,
          grossBeverageReceipts: GROSS_BEVERAGE_RECEIPTS_USD,
          mbgrtTaxYield: deriveRawTaxYield(
            GROSS_BEVERAGE_RECEIPTS_USD,
            MBGRT_RATE,
          ),
          alerts: [],
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Lineup scraper agent — normalizes a raw show feed. An empty, null,
   * or undefined feed resolves to the engine's VERIFIED_FALLBACK dataset;
   * a malformed (non-array) feed resolves to a failure envelope.
   */
  async runLineupScraperAgent(
    rawFeed?: RawShowFeedEntry[] | null,
  ): Promise<AgentResponse<LineupPayload>> {
    const agentId = "agent-lineup-scraper-v1";
    try {
      if (rawFeed == null || rawFeed.length === 0) {
        return {
          agentId,
          timestamp: new Date().toISOString(),
          success: true,
          data: {
            status: "VERIFIED_FALLBACK",
            shows: VERIFIED_FALLBACK_SHOWS,
            localSharePct: deriveDecimalPercent(
              VERIFIED_FALLBACK_SHOWS.filter((show) => show.isLocal).length,
              VERIFIED_FALLBACK_SHOWS.length,
            ),
          },
        };
      }
      if (!Array.isArray(rawFeed)) {
        throw new TypeError("runLineupScraperAgent expected a show feed array");
      }

      const shows = rawFeed.map(normalizeShow);
      return {
        agentId,
        timestamp: new Date().toISOString(),
        success: true,
        data: {
          status: "LIVE_FEED",
          shows,
          localSharePct: deriveDecimalPercent(
            shows.filter((show) => show.isLocal).length,
            shows.length,
          ),
        },
      };
    } catch (error) {
      return {
        agentId,
        timestamp: new Date().toISOString(),
        success: false,
        data: {
          status: "VERIFIED_FALLBACK",
          shows: VERIFIED_FALLBACK_SHOWS,
          localSharePct: deriveDecimalPercent(
            VERIFIED_FALLBACK_SHOWS.filter((show) => show.isLocal).length,
            VERIFIED_FALLBACK_SHOWS.length,
          ),
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Yield agent — dynamic ticketing strategy from traffic and capacity.
   * FLASH_PROMO_HIGH_TRAFFIC (20% discount) when capacity is under 70%
   * while traffic exceeds 10,000; HIGH_DEMAND_CAPACITY_LOCK when capacity
   * exceeds 90%; otherwise STANDARD_PEAK.
   */
  async runYieldAgent(
    footTrafficCount: number = DEFAULT_FOOT_TRAFFIC_COUNT,
    capacityPct: number = DEFAULT_CAPACITY_PCT,
  ): Promise<AgentResponse<YieldPayload>> {
    const agentId = "agent-yield-v1";
    try {
      let strategy: YieldStrategy;
      let discountRecommended: number;
      if (capacityPct < 70 && footTrafficCount > 10000) {
        strategy = "FLASH_PROMO_HIGH_TRAFFIC";
        discountRecommended = 20;
      } else if (capacityPct > 90) {
        strategy = "HIGH_DEMAND_CAPACITY_LOCK";
        discountRecommended = 0;
      } else {
        strategy = "STANDARD_PEAK";
        discountRecommended = 0;
      }

      return {
        agentId,
        timestamp: new Date().toISOString(),
        success: true,
        data: {
          strategy,
          discountRecommended,
          projectedYieldBoost: discountRecommended > 0 ? "+18.5%" : "OPTIMAL",
          activeCapacity: `${capacityPct}%`,
          footTrafficCount,
        },
      };
    } catch (error) {
      return {
        agentId,
        timestamp: new Date().toISOString(),
        success: false,
        data: {
          strategy: "STANDARD_PEAK",
          discountRecommended: 0,
          projectedYieldBoost: "OPTIMAL",
          activeCapacity: `${capacityPct}%`,
          footTrafficCount,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run all three agents in parallel and return their envelopes. The
   * default venue input is empty so the compliance agent exercises its
   * graceful empty-input envelope unless callers pass nodes.
   */
  async executeAll(venuesInput: VenueNode[] = []): Promise<{
    compliance: AgentResponse<TelemetryPayload>;
    lineup: AgentResponse<LineupPayload>;
    yield: AgentResponse<YieldPayload>;
  }> {
    const [compliance, lineup, yieldRes] = await Promise.all([
      this.runComplianceAgent(venuesInput),
      this.runLineupScraperAgent(),
      this.runYieldAgent(),
    ]);
    return { compliance, lineup, yield: yieldRes };
  }
}
