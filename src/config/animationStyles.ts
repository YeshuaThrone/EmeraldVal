export type AnimationStyleType =
  | "rubber_hose_bw"
  | "silhouette_traditional"
  | "cutout_paper"
  | "rubber_hose_color"
  | "golden_age_cel"
  | "fleischer_rotoscope"
  | "stop_motion_clay"
  | "stop_motion_puppet"
  | "upa_minimal"
  | "hb_limited_tv"
  | "scratch_on_film"
  | "action_rotoscope"
  | "limited_cel_anime"
  | "xerox_line_art"
  | "silver_age_90s"
  | "early_3d_cgi"
  | "paint_on_glass"
  | "flash_vector"
  | "digital_rigged_2d"
  | "feature_3d_cgi"
  | "calarts_bean_smile"
  | "spiderverse_hybrid"
  | "indie_mixed_media"
  | "chibi_anime"
  | "pixel_art"
  | "warner_smear"
  | "soviet_cutout"
  | "ghibli_theatrical"
  | "mtv_liquid"
  | "game_engine_cgi";

export type AnimationStyleCategory =
  | "Early & Silent"
  | "Golden Age"
  | "Mid-Century & Limited"
  | "Bronze, Dark & Anime"
  | "Silver Age & Early Digital"
  | "Modern Digital & Hybrid";

export type StyleCategory = AnimationStyleCategory;

export const ANIMATION_STYLE_CATEGORIES: AnimationStyleCategory[] = [
  "Early & Silent",
  "Golden Age",
  "Mid-Century & Limited",
  "Bronze, Dark & Anime",
  "Silver Age & Early Digital",
  "Modern Digital & Hybrid",
];

export interface StylePreset {
  id: AnimationStyleType;
  name: string;
  era: string;
  category: StyleCategory;
  styleWeight: number;
  promptDirective: string;
  negativePrompt: string;
}

export const COMPLETE_30_ANIMATION_STYLES: Record<
  AnimationStyleType,
  StylePreset
> = {
  rubber_hose_bw: {
    id: "rubber_hose_bw",
    name: "1920s B&W Rubber Hose",
    era: "1920s-1930s",
    category: "Early & Silent",
    styleWeight: 0.95,
    promptDirective:
      "[STYLE: 1920s Black and White Rubber Hose Animation, inkblot black bodies, pie-cut eyes, fluid noodle limbs without elbows or knees, bouncy rhythmic motion, grainy film scratch texture, high contrast monochrome]",
    negativePrompt:
      "color, 3D depth, rigid limbs, modern shading, realistic anatomy",
  },
  silhouette_traditional: {
    id: "silhouette_traditional",
    name: "1920s Backlit Silhouette (Lotte Reiniger)",
    era: "1920s",
    category: "Early & Silent",
    styleWeight: 0.95,
    promptDirective:
      "[STYLE: Traditional backlit black cardstock silhouette animation, intricate paper-cut outlines, multiplane glass depth layers, ornate shadow puppet aesthetics, high contrast theatrical lighting]",
    negativePrompt:
      "color fills, surface textures, 3D volume, digital vector smoothness",
  },
  cutout_paper: {
    id: "cutout_paper",
    name: "Flat Paper Cutout Puppet",
    era: "1910s-Present",
    category: "Early & Silent",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: Flat cutout paper puppet animation, visible cardstock textures, pinned mechanical joints, 2D planar depth, physical stop-motion feel, textured paper edges]",
    negativePrompt:
      "smooth gradient shading, fluid 3D mesh deformation, soft digital brushes",
  },
  rubber_hose_color: {
    id: "rubber_hose_color",
    name: "Mid-30s Technicolor Rubber Hose",
    era: "1930s",
    category: "Golden Age",
    styleWeight: 0.92,
    promptDirective:
      "[STYLE: Mid-1930s early 2-strip Technicolor rubber hose animation, soft pastel watercolor backgrounds, pie-cut eyes, elastic limbs, early Disney Silly Symphonies aesthetic]",
    negativePrompt:
      "sharp vector lines, 3D CGI, modern saturated RGB colors, digital glow",
  },
  golden_age_cel: {
    id: "golden_age_cel",
    name: "1940s Technicolor Full-Cel",
    era: "1940s-1950s",
    category: "Golden Age",
    styleWeight: 0.88,
    promptDirective:
      "[STYLE: Lush 1940s Technicolor hand-painted animation cel, expressive volumetric characters, rich watercolor painted backgrounds, smooth 24fps organic animation timing]",
    negativePrompt:
      "flat vector lines, digital gradient glow, low frame rate, CGI renders",
  },
  fleischer_rotoscope: {
    id: "fleischer_rotoscope",
    name: "1930s Fleischer Stereoptical Rotoscope",
    era: "1930s",
    category: "Golden Age",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: 1930s Fleischer rotoscoped motion, realistic fluid body physics overlaid on 3D turntable background models, dark moody ink lines, vintage film grain]",
    negativePrompt:
      "flat pastel colors, digital flash vectors, modern bean-mouth shapes",
  },
  stop_motion_clay: {
    id: "stop_motion_clay",
    name: "Plasticine Claymation",
    era: "1950s-Present",
    category: "Golden Age",
    styleWeight: 0.92,
    promptDirective:
      "[STYLE: Physical tactile stop-motion claymation, visible thumb prints, plasticine surface texture, subtle frame chatter, physical studio miniature lighting]",
    negativePrompt:
      "clean 2D vector, smooth digital interpolation, flat drawing strokes",
  },
  stop_motion_puppet: {
    id: "stop_motion_puppet",
    name: "Armature Wood & Silicone Puppet",
    era: "1960s-Present",
    category: "Golden Age",
    styleWeight: 0.93,
    promptDirective:
      "[STYLE: Physical stop-motion puppet animation, miniature fabric clothing, needle-felted textures, silicone face plates, ball-and-socket joint movement, shallow depth of field]",
    negativePrompt:
      "2D drawing, vector graphics, smooth CGI skin, motion blur smoothness",
  },
  warner_smear: {
    id: "warner_smear",
    name: "1940s Warner Bros Smear",
    era: "1940s-1950s",
    category: "Golden Age",
    styleWeight: 0.93,
    promptDirective:
      "[STYLE: 1940s Warner Bros theatrical smear animation, Tex Avery/Chuck Jones timing, wild squash-and-stretch, drybrush speed smears, held takes, anarchic gag staging, rich cel paint]",
    negativePrompt:
      "limited TV cycles, CalArts bean mouths, photoreal CGI, Flash tweens",
  },
  upa_minimal: {
    id: "upa_minimal",
    name: "1950s UPA Mid-Century Minimalist",
    era: "1950s-1960s",
    category: "Mid-Century & Limited",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: 1950s UPA Mid-Century Modern animation, bold geometric shapes, flat unshaded color planes, thick dry-brush ink outlines, abstract theatrical backgrounds, stylized angular design]",
    negativePrompt:
      "realistic anatomy, detailed lighting shadows, 3D volumetric rendering",
  },
  hb_limited_tv: {
    id: "hb_limited_tv",
    name: "1960s Hanna-Barbera Limited TV",
    era: "1960s",
    category: "Mid-Century & Limited",
    styleWeight: 0.87,
    promptDirective:
      "[STYLE: 1960s Saturday morning limited TV animation, visible collar lines separating neck and body, repeated cycle backgrounds, static torso poses with moving mouth/eyes only]",
    negativePrompt:
      "fluid 24fps motion, detailed realistic shading, 3D perspective camera panning",
  },
  scratch_on_film: {
    id: "scratch_on_film",
    name: "Direct Scratch-on-Film / Cameraless",
    era: "1930s-1960s",
    category: "Mid-Century & Limited",
    styleWeight: 0.94,
    promptDirective:
      "[STYLE: Cameraless scratch-on-film animation, etched emulsion, flickering abstract glyphs, raw optical soundtrack jitter, experimental avant-garde cinema texture]",
    negativePrompt:
      "clean character model sheets, stable 24fps cels, photoreal CGI, vector fills",
  },
  soviet_cutout: {
    id: "soviet_cutout",
    name: "Soviet Multiplane Cutout",
    era: "1930s-1980s",
    category: "Mid-Century & Limited",
    styleWeight: 0.93,
    promptDirective:
      "[STYLE: Soviet multiplane cutout animation, translucent painted paper layers, lyrical fog lighting, Norshteyn-era fairy-tale staging, grainy 35mm, slow poetic camera drifts]",
    negativePrompt:
      "American Saturday-morning limited TV, Flash vectors, glossy CGI, bean-mouth comedy",
  },
  action_rotoscope: {
    id: "action_rotoscope",
    name: "1970s Action Rotoscope",
    era: "1970s-1980s",
    category: "Bronze, Dark & Anime",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: 1970s action rotoscope animation, traced live-action combat, heavy ink outlines, psychedelic painted overlays, Bakshi/Ralph-era adult fantasy staging]",
    negativePrompt: "cute bean mouths, UPA flat posters, rubber-hose loops, Flash tweens",
  },
  limited_cel_anime: {
    id: "limited_cel_anime",
    name: "70s-80s Limited Cel Anime",
    era: "1970s-1980s",
    category: "Bronze, Dark & Anime",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: Classic 1980s cel anime aesthetic, sharp hand-painted line work, dramatic impact frames, speed lines, rich painted background art, high contrast shadow blocks]",
    negativePrompt:
      "smooth 60fps interpolation, western bean-mouth shapes, 3D render",
  },
  xerox_line_art: {
    id: "xerox_line_art",
    name: "1970s Xerox Cel Line",
    era: "1970s-1980s",
    category: "Bronze, Dark & Anime",
    styleWeight: 0.88,
    promptDirective:
      "[STYLE: 1970s Xerox photocopy animation line, rough graphite construction visible through ink, sketchy contour boil, Disney dark-age xerography look, textured paper cels]",
    negativePrompt:
      "perfect vector outlines, airbrushed CGI, flat Flash color, rotoscope realism",
  },
  ghibli_theatrical: {
    id: "ghibli_theatrical",
    name: "Ghibli Theatrical Feature Cel",
    era: "1980s-2000s",
    category: "Bronze, Dark & Anime",
    styleWeight: 0.94,
    promptDirective:
      "[STYLE: Studio Ghibli theatrical feature animation, lush watercolor skies, wind in grass and hair, densely painted nature, gentle full-animation acting, hand-painted background art, Miyazaki-era cinematic blocking]",
    negativePrompt:
      "chibi SD proportions, western CalArts bean mouths, CGI specular, Flash interpolation",
  },
  silver_age_90s: {
    id: "silver_age_90s",
    name: "1990s Saturday Morning / Feature TV",
    era: "1990s",
    category: "Silver Age & Early Digital",
    styleWeight: 0.89,
    promptDirective:
      "[STYLE: 1990s silver-age TV animation, bold adventure-cartoon design, discrete-color cel palettes, dynamic action layouts, early digital ink-and-paint cleanliness]",
    negativePrompt: "1920s rubber hose, clay chatter, spider-verse hatching, pixel art",
  },
  early_3d_cgi: {
    id: "early_3d_cgi",
    name: "1990s Early CGI",
    era: "1990s",
    category: "Silver Age & Early Digital",
    styleWeight: 0.86,
    promptDirective:
      "[STYLE: 1990s early CGI animation, plastic Lambert shaders, visible polygon density, simple global lighting, Toy-Story-era computer graphics, slightly rigid motion]",
    negativePrompt:
      "modern path-traced skin, 2D cels, stop-motion fingerprints, vector Flash",
  },
  paint_on_glass: {
    id: "paint_on_glass",
    name: "Paint-on-Glass / Oil Under Camera",
    era: "1980s-Present",
    category: "Silver Age & Early Digital",
    styleWeight: 0.93,
    promptDirective:
      "[STYLE: Paint-on-glass animation, wet oil strokes transformed frame by frame, luminous impressionist color, smeared transitions, under-camera brush texture]",
    negativePrompt: "hard vector edges, CGI specular, Flash interpolation, pixel clusters",
  },
  mtv_liquid: {
    id: "mtv_liquid",
    name: "1990s MTV Liquid Television",
    era: "1990s",
    category: "Silver Age & Early Digital",
    styleWeight: 0.91,
    promptDirective:
      "[STYLE: 1990s MTV Liquid Television experimental animation, morphing collage, xerox photocopies, indie-comic line, Aeon Flux angular figures, analog video noise, underground anthology energy]",
    negativePrompt:
      "corporate feature CGI, Hanna-Barbera limited cycles, pastel CalArts TV, photoreal skin",
  },
  flash_vector: {
    id: "flash_vector",
    name: "2000s Early Web Flash / Adobe Animate",
    era: "2000s",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.88,
    promptDirective:
      "[STYLE: Early 2000s web animation aesthetic, Macromedia Flash vector art, thick uniform outlines, flat color fills, rigid keyframe interpolation, iconic early internet cartoon style]",
    negativePrompt:
      "hand-drawn line variation, organic watercolor, film grain, 3D lighting",
  },
  digital_rigged_2d: {
    id: "digital_rigged_2d",
    name: "Digital Rigged 2D / Toon Boom",
    era: "2010s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: Digital rigged 2D animation, Toon Boom Harmony deformers, clean vector-ink hybrids, reusable turnaround rigs, TV-feature hybrid polish]",
    negativePrompt:
      "clay chatter, photoreal CGI, messy independent line boil",
  },
  feature_3d_cgi: {
    id: "feature_3d_cgi",
    name: "Feature CGI 3D",
    era: "2000s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: Contemporary feature CGI 3D animation, physically based materials, cinematic lighting, subsurface skin, Pixar-scale camera language, volume and contact shadows]",
    negativePrompt:
      "flat 2D fills, paper cutout, Flash vector, noisy stop-motion chatter",
  },
  calarts_bean_smile: {
    id: "calarts_bean_smile",
    name: "CalArts Bean-Mouth TV",
    era: "2010s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.91,
    promptDirective:
      "[STYLE: Modern CalArts TV animation, bean-shaped mouths, thick-thin character design, pastel palettes, noodle limbs, graphic comedy staging, soft rim light]",
    negativePrompt:
      "1930s rubber hose pie eyes, grimy rotoscope, hyperreal CGI",
  },
  spiderverse_hybrid: {
    id: "spiderverse_hybrid",
    name: "Spider-Verse Hybrid Comic CGI",
    era: "2018-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.94,
    promptDirective:
      "[STYLE: Spider-Verse hybrid animation, comic halftone, on-model linework over 3D, variable frame rates, chromatic split, graphic action smear frames]",
    negativePrompt: "smooth 60fps Pixar interpolation, Flash web cartoons, claymation",
  },
  indie_mixed_media: {
    id: "indie_mixed_media",
    name: "Indie Mixed Media / Multi-Style",
    era: "2020s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.92,
    promptDirective:
      "[STYLE: Modern indie experimental animation, mixed media fusion, pencil textures on 3D geometry, frame-by-frame paint chatter, kinetic variable line weight, stylized grain overlay]",
    negativePrompt: "generic corporate vector, rigid CGI, untextured flat fills",
  },
  chibi_anime: {
    id: "chibi_anime",
    name: "Chibi SD Anime",
    era: "2000s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: Super-deformed chibi anime, oversized heads, tiny bodies, glossy cel highlights, comedic squash takes, bright pastel palettes, 2-head-tall proportions]",
    negativePrompt: "realistic adult anatomy, western CalArts bean mouths, clay fingerprints",
  },
  pixel_art: {
    id: "pixel_art",
    name: "Pixel Art / Sprite Animation",
    era: "1980s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.93,
    promptDirective:
      "[STYLE: Pixel-art sprite animation, limited color palettes, chunky pixels, 8-bit/16-bit game motion, no anti-alias, snappy frame holds]",
    negativePrompt: "high-res film grain, smooth vector curves, photoreal CGI, watercolor",
  },
  game_engine_cgi: {
    id: "game_engine_cgi",
    name: "Real-Time Game Engine CGI",
    era: "2010s-Present",
    category: "Modern Digital & Hybrid",
    styleWeight: 0.9,
    promptDirective:
      "[STYLE: Real-time game-engine cinematic CGI, Unreal/Unity look, ray-traced reflections, mocap body language, cutscene camera, physically based materials, slightly game-resolution sharpness]",
    negativePrompt:
      "hand-painted 2D cels, paper cutout, Flash vectors, stop-motion fingerprints",
  },
};

export const COMPLETE_ANIMATION_STYLE_PRESETS = COMPLETE_30_ANIMATION_STYLES;
export const ANIMATION_STYLE_PRESETS = COMPLETE_30_ANIMATION_STYLES;

export function isAnimationStyleType(
  value: string,
): value is AnimationStyleType {
  return Object.hasOwn(COMPLETE_30_ANIMATION_STYLES, value);
}

export function resolveAnimationStyle(
  value: string | null | undefined,
): StylePreset {
  if (value && isAnimationStyleType(value)) {
    return COMPLETE_30_ANIMATION_STYLES[value];
  }
  return COMPLETE_30_ANIMATION_STYLES.golden_age_cel;
}

export function applyAnimationStyle(
  scriptText: string,
  styleType: AnimationStyleType,
): { prompt: string; styleApplied: string; negativePrompt: string } {
  const preset = COMPLETE_30_ANIMATION_STYLES[styleType];
  return {
    styleApplied: preset.name,
    negativePrompt: preset.negativePrompt,
    prompt: `${preset.promptDirective} Action: ${scriptText.trim()}. Maintain steady camera motion.`,
  };
}

export function listStylesByCategory(
  category: AnimationStyleCategory,
): StylePreset[] {
  return Object.values(COMPLETE_30_ANIMATION_STYLES).filter(
    (preset) => preset.category === category,
  );
}
