import { describe, expect, it } from "vitest";
import {
  PALAIS_ROSE_EXTERIOR_PRESET,
  PALAIS_ROSE_INTERIOR_ROOMS,
  compilePalaisRoseExteriorPrompt,
  compilePalaisRoseRoomPrompt,
} from "./palaisRosePresets";

describe("Palais Rose estate presets", () => {
  it("describes the Grand Trianon exterior", () => {
    expect(PALAIS_ROSE_EXTERIOR_PRESET.tier).toBe("PALAIS_ROSE_MANSION");
    expect(PALAIS_ROSE_EXTERIOR_PRESET.facadeStyle).toContain("Grand Trianon");
    const prompt = compilePalaisRoseExteriorPrompt();
    expect(prompt).toContain("[CARTOON_STRUCTURE]");
    expect(prompt).toContain("Double Corinthian marble columns");
    expect(prompt).toContain("#f472b6");
  });

  it("ships foyer, orangerie dining, and cinema interiors", () => {
    expect(PALAIS_ROSE_INTERIOR_ROOMS.map((room) => room.roomName)).toEqual([
      "Grand Foyer & Reception Hall",
      "Glass Conservatory Dining Room",
      "Private Luxury Cinema Room",
    ]);
    const cinema = PALAIS_ROSE_INTERIOR_ROOMS[2]!;
    const prompt = compilePalaisRoseRoomPrompt(cinema);
    expect(prompt).toContain("[CARTOON_INTERIOR]");
    expect(prompt).toContain("Plush Red Velvet");
    expect(prompt).toContain("Vintage popcorn bar");
  });
});
