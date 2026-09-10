import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { applyWithholding, readCreatorCompliance, resolveTinStatus } from "./engine";

describe("resolveTinStatus", () => {
  it("defaults both flags to false", () => {
    expect(resolveTinStatus(undefined, {})).toEqual({
      tin_verified: false,
      w9_on_file: false,
    });
  });

  it("prefers incoming flags over stored", () => {
    expect(
      resolveTinStatus(
        { tin_verified: false, w9_on_file: false },
        { tin_verified: true, w9_on_file: true },
      ),
    ).toEqual({ tin_verified: true, w9_on_file: true });
  });
});

describe("applyWithholding", () => {
  it("escrows 24% and flags 1099 after crossing $600", () => {
    const store = new SqliteStore(":memory:");
    const first = applyWithholding(store, {
      creator_id: "c1",
      gross_cents: 50_000,
      tax_year: 2026,
    });
    expect(first.value.withheld_cents).toBe(12_000);
    expect(first.value.requires_1099).toBe(false);

    const second = applyWithholding(store, {
      creator_id: "c1",
      gross_cents: 20_000,
      tax_year: 2026,
    });
    expect(second.value.ytd_gross_cents).toBe(70_000);
    expect(second.value.requires_1099).toBe(true);
    expect(second.value.crossed_1099_threshold).toBe(true);
    expect(store.listTaxEscrowByCreator("c1", 2026)).toHaveLength(2);
  });

  it("does not withhold after TIN/W-9 is recorded", () => {
    const store = new SqliteStore(":memory:");
    const result = applyWithholding(store, {
      creator_id: "c1",
      gross_cents: 10_000,
      tax_year: 2026,
      tin_verified: true,
      w9_on_file: true,
    });
    expect(result.value.withheld_cents).toBe(0);
    expect(result.value.net_cents).toBe(10_000);
  });
});

describe("readCreatorCompliance", () => {
  it("returns empty YTD for an unknown creator", () => {
    const store = new SqliteStore(":memory:");
    const snapshot = readCreatorCompliance(store, "missing", 2026);
    expect(snapshot.ytd_gross_cents).toBe(0);
    expect(snapshot.requires_1099).toBe(false);
    expect(snapshot.escrow).toEqual([]);
  });
});
