// Ambient shorthand module declaration for leaflet.heat's side-effecting
// import (`await import("leaflet.heat")` in HeatmapLayer.tsx). Kept in its
// own global script file (no top-level import/export) so it registers as a
// true ambient module rather than a local augmentation scoped to importers
// of ./leaflet-heat.d.ts.
declare module "leaflet.heat";
