import { describe, expect, it } from "vitest";
import { remainingAdvance, sweepRecoupment } from "./sweep";

describe("sweepRecoupment", () => {
  it("sweeps 100% of incoming toward the remaining advance", () => {
    const swept = sweepRecoupment({
      incoming_cents: 1000,
      recoupment_target_cents: 2500,
      recoupment_current_cents: 400,
    });
    expect(swept.recouped_cents).toBe(1000);
    expect(swept.excess_cents).toBe(0);
    expect(swept.recoupment_current_cents).toBe(1400);
    expect(swept.completed).toBe(false);
  });

  it("releases excess after the advance is filled", () => {
    const swept = sweepRecoupment({
      incoming_cents: 500,
      recoupment_target_cents: 1000,
      recoupment_current_cents: 800,
      recoupment_bps: 10_000,
    });
    expect(swept.recouped_cents).toBe(200);
    expect(swept.excess_cents).toBe(300);
    expect(swept.completed).toBe(true);
  });

  it("honors a partial recoupment_bps", () => {
    const swept = sweepRecoupment({
      incoming_cents: 1000,
      recoupment_target_cents: 5000,
      recoupment_current_cents: 0,
      recoupment_bps: 5000,
    });
    expect(swept.recouped_cents).toBe(500);
    expect(swept.excess_cents).toBe(500);
  });

  it("no-ops when incoming, remaining, or bps are empty", () => {
    expect(remainingAdvance(100, 150)).toBe(0);
    expect(
      sweepRecoupment({
        incoming_cents: 0,
        recoupment_target_cents: 100,
        recoupment_current_cents: 0,
      }).recouped_cents,
    ).toBe(0);
    expect(
      sweepRecoupment({
        incoming_cents: 100,
        recoupment_target_cents: 100,
        recoupment_current_cents: 100,
      }).excess_cents,
    ).toBe(100);
    expect(
      sweepRecoupment({
        incoming_cents: 100,
        recoupment_target_cents: 100,
        recoupment_current_cents: 0,
        recoupment_bps: 0,
      }).recouped_cents,
    ).toBe(0);
  });
});
