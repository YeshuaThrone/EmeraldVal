import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Civic Chrome token smoke tests (Foundry Pass M2, spec art_JaAYDgpB).
 *
 * These keep the contract honest at the source level: the dark token
 * family exists, `.civic-mode` is defined, the app root no longer forces
 * a global light background, and exactly the four civic surfaces opt in
 * while the Venue Studio form floor stays light.
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

  it.each(CIVIC_SURFACES)("%s renders under .civic-mode", (file) => {
    expect(read(file)).toContain("civic-mode");
  });

  it("Venue Studio stays on the light working surface", () => {
    const venuePage = read("src/app/venue/page.tsx");
    expect(venuePage).not.toContain("civic-mode");
  });
});
