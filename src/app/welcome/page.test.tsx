import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CITY_PINS } from "@/lib/seedData";

/**
 * Route-render + CTA-navigation contract for the flagship landing
 * (Foundry Pass M4, spec art_JaAYDgpB). The page is a static server
 * component fed only by the deterministic seed, so the navigation
 * contract is its CTA href and the data strip can only show seed numbers.
 *
 * `next/link` is mocked as a plain anchor because this suite runs in the
 * vitest node environment — no Next router runtime, no jsdom.
 */
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => createElement("a", { href }, children),
}));

import WelcomePage, { getWelcomeStats } from "./page";

describe("welcome landing stats", () => {
  it("derives every number purely from the city seed", () => {
    const stats = getWelcomeStats();

    expect(stats.venuesTracked).toBe(CITY_PINS.length);
    expect(stats.venuesTracked).toBeGreaterThanOrEqual(100);
    expect(stats.liveRightNow).toBe(
      CITY_PINS.filter((pin) => pin.source === "live").length,
    );
    expect(stats.liveRightNow).toBeGreaterThan(0);
    expect(stats.districtsCovered).toBe(
      new Set(CITY_PINS.map((pin) => pin.district).filter(Boolean)).size,
    );
    expect(stats.districtsCovered).toBeGreaterThan(0);
  });

  it("is deterministic across calls", () => {
    expect(getWelcomeStats()).toEqual(
      getWelcomeStats(CITY_PINS.slice().reverse()),
    );
  });
});

describe("welcome route render", () => {
  const html = renderToStaticMarkup(createElement(WelcomePage));

  it("renders the display headline", () => {
    expect(html).toContain("Austin Doesn");
    expect(html).toContain("Neither Do We.");
    expect(html).toContain("<h1");
  });

  it("renders the positioning line", () => {
    expect(html).toContain("Live Map");
    expect(html).toMatch(/Civic Analytics · Festival Finder · Artist (&amp;|&) Venue Studios/);
  });

  it("renders the seed-fed data strip values", () => {
    const stats = getWelcomeStats();
    expect(html).toContain("Venues tracked");
    expect(html).toContain("Live right now");
    expect(html).toContain("Districts covered");
    expect(html).toContain(`>${stats.venuesTracked}</dd>`);
    expect(html).toContain(`>${stats.liveRightNow}</dd>`);
    expect(html).toContain(`>${stats.districtsCovered}</dd>`);
  });

  it("CTA navigates to the fan map at /", () => {
    expect(html).toMatch(/<a href="\/"([^>]*)>Enter the Live Map<\/a>/);
  });

  it("renders the ViewToggle for cross-surface navigation", () => {
    expect(html).toContain('aria-label="View switcher"');
  });
});
