import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Civic Chrome token smoke tests (Foundry Pass M2, spec art_JaAYDgpB;
 * updated by Skylight S2, spec art_NqnJMLfh).
 *
 * These keep the contract honest at the source level: the dark token
 * family exists, `.civic-mode` is defined, the app root no longer forces
 * a global light background, and the night-first surfaces carry the dark
 * ground WITHOUT hand-coding the phase class — since S2 the phase class
 * is computed on <html> by the day-phase engine, and the Venue Studio
 * form floor stays light in both phases.
 */

const repoRoot = join(process.cwd());

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

const CIVIC_TOKENS = [
  "--color-atx-night",
  "--color-atx-slab",
  "--color-atx-gold",
  "--color-atx-electric-soft",
  "--color-atx-night-line",
] as const;

const CIVIC_SURFACES = [
  ["src/components/LiveMapApp.tsx", "Fan Map"],
  ["src/app/festival/page.tsx", "Festival Finder"],
  ["src/app/artist/page.tsx", "Artist Studio"],
  ["src/app/admin/page.tsx", "Admin"],
  ["src/app/welcome/page.tsx", "Welcome"],
] as const;

describe("civic chrome tokens", () => {
  const css = read("src/app/globals.css");

  it.each(CIVIC_TOKENS)("%s is declared in the theme layer", (token) => {
    expect(css).toContain(`${token}:`);
  });

  it("declares the .civic-mode activation layer", () => {
    expect(css).toMatch(/\.civic-mode\s*[{,]/);
  });

  it("re-grades borders, text, and surfaces onto the dark family", () => {
    expect(css).toContain(".civic-mode .border-atx-line");
    expect(css).toContain(".civic-mode .bg-white");
    expect(css).toContain("border-color: var(--color-atx-night-line)");
  });

  it("no font families beyond DM Sans / Outfit were introduced", () => {
    const fontFamilies = css.match(/--font-[\w-]+:/g) ?? [];
    for (const font of fontFamilies) {
      expect(["--font-sans:", "--font-display:"]).toContain(font);
    }
  });
});

describe("civic chrome activation", () => {
  it("app root no longer forces the light background globally", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).not.toContain("bg-atx-paper");
  });

  it.each(CIVIC_SURFACES)(
    "%s carries the night ground and no hand-coded phase class",
    (file) => {
      const source = read(file);
      // S2: the phase class lives on <html>, set by the pre-hydration
      // bootstrap and DayPhaseChrome — surfaces must not opt in by hand.
      expect(source).not.toContain("civic-mode");
      expect(source).toContain("bg-atx-night");
    },
  );

  it("the layout wires the pre-hydration phase script", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("DAY_PHASE_PRE_HYDRATION_SCRIPT");
    expect(layout).toContain("DayPhaseChrome");
  });

  it("Venue Studio stays on the light working surface", () => {
    const venuePage = read("src/app/venue/page.tsx");
    expect(venuePage).not.toContain("civic-mode");
    // S2: the venue route is exempt from the phase flip in both phases, and
    // the override control (which would pull the engine into its bundle) is
    // intentionally absent there.
    expect(venuePage).not.toContain("skylight-day");
    expect(venuePage).not.toContain("DayPhaseOverrideControl");
  });
});
