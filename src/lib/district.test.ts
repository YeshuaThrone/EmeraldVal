import { describe, expect, it } from "vitest";
import { districtForPoint } from "@/lib/district";

describe("districtForPoint", () => {
  it("maps the Domain to North", () => {
    expect(districtForPoint(30.4005, -97.7215)).toBe("North");
  });

  it("maps deep South Congress (SoCo) to South", () => {
    expect(districtForPoint(30.2385, -97.7695)).toBe("South");
  });

  it("maps East 6th (across I-35) to East", () => {
    expect(districtForPoint(30.2624, -97.7188)).toBe("East");
  });

  it("maps Clarksville to West", () => {
    expect(districtForPoint(30.2825, -97.7595)).toBe("West");
  });

  it("maps 6th & Congress to Downtown", () => {
    expect(districtForPoint(30.2669, -97.7428)).toBe("Downtown");
  });

  it("returns undefined for coordinates outside AUSTIN_BOUNDS", () => {
    // Documented fallback: a point outside the city bounds gets no district
    // rather than being guessed into "Downtown".
    expect(districtForPoint(40.7128, -74.006)).toBeUndefined();
  });
});
