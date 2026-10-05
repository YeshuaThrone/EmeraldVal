import { formatHousingLabel, type HousingTier } from "./housingMaterials";

export interface PalaisRoseRoomConfig {
  roomName: string;
  architecturalStyle: string;
  primaryMaterials: string[];
  lightingMood: string;
  keyFeatures: string[];
}

export interface PalaisRoseExteriorPreset {
  tier: HousingTier;
  primaryMaterial: string;
  roofMaterial: string;
  facadeStyle: string;
  architecturalElements: string[];
  colorPalette: string[];
}

export const PALAIS_ROSE_EXTERIOR_PRESET: PalaisRoseExteriorPreset = {
  tier: "PALAIS_ROSE_MANSION",
  primaryMaterial: "Pink French Marble & Carved Limestone",
  roofMaterial: "Copper Mansard & Ornate Stone Balustrades",
  facadeStyle: "Grand Trianon Neoclassical",
  architecturalElements: [
    "Double Corinthian marble columns",
    "Arched floor-to-ceiling French doors",
    "Central circular driveway with marble sculpture fountain",
    "Manicured hedges and classical statues",
    "Detached glass and iron conservatory sunroom",
  ],
  colorPalette: ["#f472b6", "#fef08a", "#e2e8f0", "#0f172a"],
};

export const PALAIS_ROSE_INTERIOR_ROOMS: PalaisRoseRoomConfig[] = [
  {
    roomName: "Grand Foyer & Reception Hall",
    architecturalStyle: "French Classical Baroque",
    primaryMaterials: [
      "Polished Checkerboard Marble",
      "Gold Leaf Molding",
      "Crystal Chandeliers",
    ],
    lightingMood: "Warm Golden Hour Sunlight through arched tall windows",
    keyFeatures: [
      "Grand double staircase",
      "Classical wall portraits",
      "Ornate carved fireplace",
    ],
  },
  {
    roomName: "Glass Conservatory Dining Room",
    architecturalStyle: "19th Century French Iron & Glass Orangerie",
    primaryMaterials: [
      "Wrought Iron Beams",
      "Clear Paned Glass",
      "Teak Wood Flooring",
    ],
    lightingMood: "Diffused Natural Daylight surrounded by garden flora",
    keyFeatures: [
      "Long banquette table",
      "Overhanging brass lanterns",
      "Surrounding manicured lawns",
    ],
  },
  {
    roomName: "Private Luxury Cinema Room",
    architecturalStyle: "Modern Art Deco Home Theater",
    primaryMaterials: [
      "Plush Red Velvet",
      "Tufted Leather",
      "Acoustic Mahogany Wood Panels",
    ],
    lightingMood: "Moody Warm Ambient LED Strip Lights",
    keyFeatures: [
      "Multi-tier recliners",
      "Vintage popcorn bar",
      "Recessed ceiling cove lighting",
    ],
  },
];

export function compilePalaisRoseExteriorPrompt(): string {
  const preset = PALAIS_ROSE_EXTERIOR_PRESET;
  return `[CARTOON_STRUCTURE] ${formatHousingLabel(preset.tier)} exterior. Facade: ${preset.facadeStyle}. Primary: ${preset.primaryMaterial}. Roof: ${preset.roofMaterial}. Elements: ${preset.architecturalElements.join(", ")}. Palette: ${preset.colorPalette.join(", ")}. Maintaining clean cartoon line art and cell shading.`;
}

export function compilePalaisRoseRoomPrompt(room: PalaisRoseRoomConfig): string {
  return `[CARTOON_INTERIOR] ${room.roomName} in Palais Rose. Style: ${room.architecturalStyle}. Materials: ${room.primaryMaterials.join(", ")}. Lighting: ${room.lightingMood}. Features: ${room.keyFeatures.join(", ")}. Maintaining clean cartoon line art and cell shading.`;
}
