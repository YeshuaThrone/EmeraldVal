import { describe, expect, it } from "vitest";
import {
  canTransitionHold,
  canTransitionJournal,
  canTransitionSplit,
} from "./machine";

describe("GL state machine", () => {
  it("treats posted journals as terminal", () => {
    expect(canTransitionJournal("posted", "posted")).toBe(true);
  });

  it("allows posted split runs to reverse once", () => {
    expect(canTransitionSplit("posted", "reversed")).toBe(true);
    expect(canTransitionSplit("posted", "posted")).toBe(false);
    expect(canTransitionSplit("reversed", "posted")).toBe(false);
    expect(canTransitionSplit("reversed", "reversed")).toBe(false);
  });

  it("allows one-way payout hold settlement and reversal", () => {
    expect(canTransitionHold("in_flight", "settled")).toBe(true);
    expect(canTransitionHold("in_flight", "reversed")).toBe(true);
    expect(canTransitionHold("in_flight", "in_flight")).toBe(false);
    expect(canTransitionHold("settled", "reversed")).toBe(true);
    expect(canTransitionHold("settled", "settled")).toBe(false);
    expect(canTransitionHold("reversed", "settled")).toBe(false);
    expect(canTransitionHold("reversed", "in_flight")).toBe(false);
  });
});
