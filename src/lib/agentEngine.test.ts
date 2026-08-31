import { describe, expect, it } from "vitest";
import {
  ACTIVE_STAGE_UTILIZATION_PERCENT,
  GROSS_BEVERAGE_RECEIPTS_USD,
  MBGRT_RATE,
  VENUE_AUDIT_ROWS,
  calculateTaxYield,
} from "@/lib/civic";
import { ADMIN_TELEMETRY_DATA } from "@/lib/telemetry";
import {
  ATXLiveAgentEngine,
  DEFAULT_CAPACITY_PCT,
  DEFAULT_FOOT_TRAFFIC_COUNT,
  deriveRawTaxYield,
  type VenueNode,
} from "@/lib/agentEngine";

/** The default audit rows mapped to the engine's VenueNode shape. */
const DEFAULT_NODES: VenueNode[] = VENUE_AUDIT_ROWS.map(
  ({ id, name, currentDb, limitDb }) => ({ id, name, currentDb, limitDb }),
);

describe("ATXLiveAgentEngine constructor", () => {
  it("stores Supabase target fields per the paste without ever calling them", () => {
    const engine = new ATXLiveAgentEngine(
      "https://example.supabase.co",
      "anon-key",
    );
    expect(engine.supabaseUrl).toBe("https://example.supabase.co");
    expect(engine.supabaseAnonKey).toBe("anon-key");
  });

  it("defaults both constructor fields to empty strings", () => {
    const engine = new ATXLiveAgentEngine();
    expect(engine.supabaseUrl).toBe("");
    expect(engine.supabaseAnonKey).toBe("");
  });
});

describe("runComplianceAgent", () => {
  it("derives 60.0% compliance with 2 HIGH_PRIORITY alerts from the default audit rows", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runComplianceAgent(DEFAULT_NODES);
    expect(res.success).toBe(true);
    expect(res.data.complianceRate).toBe("60.0%");
    expect(res.data.violationsCount).toBe(2);
    expect(res.data.evaluatedNodes).toBe(5);
    expect(res.data.alerts).toEqual([
      {
        venueId: "v-1",
        venueName: "Empire Control Room",
        deltaDb: 3,
        severity: "HIGH_PRIORITY",
      },
      {
        venueId: "v-3",
        venueName: "Mohawk",
        deltaDb: 6,
        severity: "HIGH_PRIORITY",
      },
    ]);
  });

  it("defaults its venue input to civic's VENUE_AUDIT_ROWS", async () => {
    const engine = new ATXLiveAgentEngine();
    const defaulted = await engine.runComplianceAgent();
    const explicit = await engine.runComplianceAgent(DEFAULT_NODES);
    expect(defaulted.data).toEqual(explicit.data);
    expect(defaulted.data.evaluatedNodes).toBe(5);
  });

  it("returns the graceful 100% / 0-violations envelope for empty input", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runComplianceAgent([]);
    expect(res.success).toBe(true);
    expect(res.data.complianceRate).toBe("100%");
    expect(res.data.violationsCount).toBe(0);
    expect(res.data.evaluatedNodes).toBe(0);
    expect(res.data.alerts).toEqual([]);
  });

  it("returns the graceful envelope for null input", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runComplianceAgent(null);
    expect(res.success).toBe(true);
    expect(res.data.complianceRate).toBe("100%");
    expect(res.data.violationsCount).toBe(0);
    expect(res.data.evaluatedNodes).toBe(0);
  });

  it("carries the raw machine-format MBGRT yield 9547.50 from civic constants", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runComplianceAgent([]);
    expect(res.data.grossBeverageReceipts).toBe(GROSS_BEVERAGE_RECEIPTS_USD);
    expect(res.data.mbgrtTaxYield).toBe("9547.50");
  });

  it("resolves a failure envelope with an error message on malformed input", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runComplianceAgent({} as unknown as VenueNode[]);
    expect(res.success).toBe(false);
    expect(res.error).toContain("expected an array");
    expect(res.agentId).toBe("agent-compliance-v1");
  });
});

describe("engine yield alignment with the dashboard", () => {
  it("derives the same product (142500 × 0.067) as civic's calculateTaxYield", () => {
    // The engine's raw string and the dashboard's formatted figure must
    // come from the same receipts × rate product — never separate literals.
    expect(deriveRawTaxYield(GROSS_BEVERAGE_RECEIPTS_USD, MBGRT_RATE)).toBe(
      "9547.50",
    );
    expect(Number(deriveRawTaxYield(142500, 0.067))).toBeCloseTo(
      GROSS_BEVERAGE_RECEIPTS_USD * MBGRT_RATE,
      2,
    );
    expect(calculateTaxYield(GROSS_BEVERAGE_RECEIPTS_USD, MBGRT_RATE)).toBe(
      "$9,548",
    );
  });

  it("uses the civic receipts constant, not a duplicated 142500 literal", async () => {
    const engine = new ATXLiveAgentEngine();
    expect(GROSS_BEVERAGE_RECEIPTS_USD).toBe(142500);
    expect(MBGRT_RATE).toBe(0.067);
    const res = await engine.runComplianceAgent([]);
    expect(res.data.grossBeverageReceipts).toBe(142500);
    expect(res.data.mbgrtTaxYield).toBe((142500 * 0.067).toFixed(2));
  });
});

describe("runLineupScraperAgent", () => {
  it("returns the VERIFIED_FALLBACK dataset for an empty feed", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runLineupScraperAgent([]);
    expect(res.success).toBe(true);
    expect(res.data.status).toBe("VERIFIED_FALLBACK");
    expect(res.data.shows).toEqual([
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
    ]);
    expect(res.data.localSharePct).toBe("100.0%");
  });

  it("falls back for null and undefined feeds", async () => {
    const engine = new ATXLiveAgentEngine();
    const nullRes = await engine.runLineupScraperAgent(null);
    const undefinedRes = await engine.runLineupScraperAgent();
    expect(nullRes.data.status).toBe("VERIFIED_FALLBACK");
    expect(undefinedRes.data.status).toBe("VERIFIED_FALLBACK");
  });

  it("normalizes a live feed and derives the local share from isLocal flags", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runLineupScraperAgent([
      {
        artist: "Yeshua Throne",
        stage: "Warehouse Stage",
        setTime: "11:30 PM",
        isLocal: true,
      },
      {
        artist: "Touring Act",
        stage: "Main Stage",
        setTime: "9:00 PM",
        isLocal: false,
      },
      {
        // Unspecified isLocal counts as local, per the paste.
        artist: "Unspecified Act",
        stage: "Patio Stage",
        setTime: "10:00 PM",
      },
    ]);
    expect(res.success).toBe(true);
    expect(res.data.status).toBe("LIVE_FEED");
    expect(res.data.shows).toHaveLength(3);
    expect(res.data.shows[0].id).toBe("show-1");
    expect(res.data.shows[0].status).toBe("CONFIRMED");
    expect(res.data.shows[2].isLocal).toBe(true);
    // 2 of 3 local → 66.7%.
    expect(res.data.localSharePct).toBe("66.7%");
  });

  it("normalizes missing ids to show-N and missing status to CONFIRMED", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runLineupScraperAgent([
      { artist: "A", stage: "S", setTime: "8:00 PM" },
      { artist: "B", stage: "S", setTime: "9:00 PM", status: "PENDING" },
    ]);
    expect(res.data.shows[0].id).toBe("show-1");
    expect(res.data.shows[0].status).toBe("CONFIRMED");
    expect(res.data.shows[1].status).toBe("PENDING");
    expect(res.data.shows[1].id).toBe("show-2");
  });

  it("resolves a failure envelope on a malformed feed", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runLineupScraperAgent(
      "not-a-feed" as unknown as never,
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("expected a show feed array");
  });
});

describe("runYieldAgent", () => {
  it("recommends FLASH_PROMO_HIGH_TRAFFIC at 20% under 70% capacity with heavy traffic", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent(12000, 65);
    expect(res.success).toBe(true);
    expect(res.data.strategy).toBe("FLASH_PROMO_HIGH_TRAFFIC");
    expect(res.data.discountRecommended).toBe(20);
    expect(res.data.projectedYieldBoost).toBe("+18.5%");
  });

  it("locks capacity above 90% with no discount", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent(12000, 91);
    expect(res.data.strategy).toBe("HIGH_DEMAND_CAPACITY_LOCK");
    expect(res.data.discountRecommended).toBe(0);
    expect(res.data.projectedYieldBoost).toBe("OPTIMAL");
  });

  it("stays STANDARD_PEAK at exactly 70% capacity (boundary)", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent(12000, 70);
    expect(res.data.strategy).toBe("STANDARD_PEAK");
    expect(res.data.discountRecommended).toBe(0);
    expect(res.data.projectedYieldBoost).toBe("OPTIMAL");
  });

  it("stays STANDARD_PEAK at exactly 90% capacity (boundary)", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent(12000, 90);
    expect(res.data.strategy).toBe("STANDARD_PEAK");
  });

  it("stays STANDARD_PEAK when traffic is low even at low capacity", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent(8000, 60);
    expect(res.data.strategy).toBe("STANDARD_PEAK");
    expect(res.data.discountRecommended).toBe(0);
  });

  it("formats activeCapacity as a proper template literal", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent(14280, 84.2);
    expect(res.data.activeCapacity).toBe("84.2%");
  });

  it("defaults to the telemetry-aligned foot traffic and civic capacity", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runYieldAgent();
    expect(res.data.footTrafficCount).toBe(DEFAULT_FOOT_TRAFFIC_COUNT);
    expect(DEFAULT_FOOT_TRAFFIC_COUNT).toBe(
      Number(ADMIN_TELEMETRY_DATA.realtimeFootTraffic.replace(/,/g, "")),
    );
    expect(DEFAULT_CAPACITY_PCT).toBe(
      Number(ACTIVE_STAGE_UTILIZATION_PERCENT.replace("%", "")),
    );
    expect(res.data.activeCapacity).toBe("84.2%");
    // 84.2% capacity → STANDARD_PEAK, no discount.
    expect(res.data.strategy).toBe("STANDARD_PEAK");
    expect(res.data.discountRecommended).toBe(0);
    expect(res.data.projectedYieldBoost).toBe("OPTIMAL");
  });
});

describe("envelope shape", () => {
  it("stamps every success envelope with an agent-*-v1 id and ISO timestamp", async () => {
    const engine = new ATXLiveAgentEngine();
    const [compliance, lineup, yieldRes] = await Promise.all([
      engine.runComplianceAgent([]),
      engine.runLineupScraperAgent(),
      engine.runYieldAgent(),
    ]);
    for (const res of [compliance, lineup, yieldRes]) {
      expect(res.agentId).toMatch(/^agent-[a-z-]+-v1$/);
      expect(res.timestamp).toBe(new Date(res.timestamp).toISOString());
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
    }
    expect(compliance.agentId).toBe("agent-compliance-v1");
    expect(lineup.agentId).toBe("agent-lineup-scraper-v1");
    expect(yieldRes.agentId).toBe("agent-yield-v1");
  });

  it("carries an error message on forced failure", async () => {
    const engine = new ATXLiveAgentEngine();
    const res = await engine.runComplianceAgent(
      "not-an-array" as unknown as VenueNode[],
    );
    expect(res.success).toBe(false);
    expect(typeof res.error).toBe("string");
    expect(res.error!.length).toBeGreaterThan(0);
  });
});

describe("executeAll", () => {
  it("resolves all three envelopes in parallel with empty default venues", async () => {
    const engine = new ATXLiveAgentEngine();
    const result = await engine.executeAll();
    expect(result.compliance.success).toBe(true);
    expect(result.compliance.data.complianceRate).toBe("100%");
    expect(result.compliance.data.violationsCount).toBe(0);
    expect(result.lineup.data.status).toBe("VERIFIED_FALLBACK");
    expect(result.yield.data.strategy).toBe("STANDARD_PEAK");
    expect(result.yield.data.activeCapacity).toBe("84.2%");
  });

  it("passes venue nodes through to the compliance agent", async () => {
    const engine = new ATXLiveAgentEngine();
    const result = await engine.executeAll(DEFAULT_NODES);
    expect(result.compliance.data.evaluatedNodes).toBe(5);
    expect(result.compliance.data.violationsCount).toBe(2);
    expect(result.compliance.data.complianceRate).toBe("60.0%");
  });

  it("returns all three agent ids across the envelopes", async () => {
    const engine = new ATXLiveAgentEngine();
    const result = await engine.executeAll([]);
    expect(result.compliance.agentId).toBe("agent-compliance-v1");
    expect(result.lineup.agentId).toBe("agent-lineup-scraper-v1");
    expect(result.yield.agentId).toBe("agent-yield-v1");
  });
});
