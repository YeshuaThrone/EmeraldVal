import { describe, expect, it } from "vitest";
import {
  ANIMATION_STYLE_CATEGORIES,
  ANIMATION_STYLE_PRESETS,
  COMPLETE_30_ANIMATION_STYLES,
  applyAnimationStyle,
  isAnimationStyleType,
  listStylesByCategory,
  resolveAnimationStyle,
} from "./animationStyles";

describe("COMPLETE_30_ANIMATION_STYLES", () => {
  it("ships thirty presets across the six drawer categories", () => {
    const presets = Object.values(COMPLETE_30_ANIMATION_STYLES);
    expect(presets).toHaveLength(30);
    expect(Object.keys(ANIMATION_STYLE_PRESETS)).toHaveLength(30);
    expect(ANIMATION_STYLE_CATEGORIES).toEqual([
      "Early & Silent",
      "Golden Age",
      "Mid-Century & Limited",
      "Bronze, Dark & Anime",
      "Silver Age & Early Digital",
      "Modern Digital & Hybrid",
    ]);

    const categories = new Set(presets.map((preset) => preset.category));
    expect(categories).toEqual(new Set(ANIMATION_STYLE_CATEGORIES));

    for (const [id, preset] of Object.entries(COMPLETE_30_ANIMATION_STYLES)) {
      expect(preset.id).toBe(id);
      expect(isAnimationStyleType(id)).toBe(true);
    }

    expect(COMPLETE_30_ANIMATION_STYLES.silver_age_90s.category).toBe(
      "Silver Age & Early Digital",
    );
    expect(COMPLETE_30_ANIMATION_STYLES.early_3d_cgi.category).toBe(
      "Silver Age & Early Digital",
    );
    expect(COMPLETE_30_ANIMATION_STYLES.paint_on_glass.category).toBe(
      "Silver Age & Early Digital",
    );
    expect(COMPLETE_30_ANIMATION_STYLES.flash_vector.category).toBe(
      "Modern Digital & Hybrid",
    );
    expect(COMPLETE_30_ANIMATION_STYLES.indie_mixed_media.category).toBe(
      "Modern Digital & Hybrid",
    );
    expect(isAnimationStyleType("warner_smear")).toBe(true);
    expect(isAnimationStyleType("soviet_cutout")).toBe(true);
    expect(isAnimationStyleType("ghibli_theatrical")).toBe(true);
    expect(isAnimationStyleType("mtv_liquid")).toBe(true);
    expect(isAnimationStyleType("game_engine_cgi")).toBe(true);
    expect(isAnimationStyleType("indie_experimental")).toBe(false);
    expect(listStylesByCategory("Golden Age").some((p) => p.id === "warner_smear")).toBe(
      true,
    );
    expect(resolveAnimationStyle("limited_cel_anime").era).toBe("1970s-1980s");
    expect(resolveAnimationStyle("limited_anime").id).toBe("golden_age_cel");
  });

  it("prefixes scene action with the selected style directive", () => {
    const styled = applyAnimationStyle(
      "Character turns toward camera while dancing",
      "golden_age_cel",
    );
    expect(styled.styleApplied).toBe("1940s Technicolor Full-Cel");
    expect(styled.prompt).toContain("[STYLE:");
    expect(styled.prompt).toContain(
      "Character turns toward camera while dancing",
    );
    expect(styled.negativePrompt.length).toBeGreaterThan(8);
  });
});
