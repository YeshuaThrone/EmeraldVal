import { describe, expect, it } from "vitest";
import {
  MinecraftCoreRegistry,
  compileMinecraftAssetPrompt,
  minecraftCoreRegistry,
} from "./minecraftCoreRegistry";

describe("MinecraftCoreRegistry", () => {
  it("registers ancient debris, crafter, warden, breeze, and latex", () => {
    const registry = new MinecraftCoreRegistry();
    expect(registry.getBlock("minecraft:ancient_debris")?.minTier).toBe("DIAMOND");
    expect(registry.getBlock("minecraft:ancient_debris")?.dimension).toBe("NETHER");
    expect(registry.getBlock("minecraft:crafter")?.isRedstoneComponent).toBe(true);
    expect(registry.getMob("minecraft:warden")?.healthPoints).toBe(500);
    expect(registry.getMob("minecraft:breeze")?.drops[0]?.itemId).toBe(
      "minecraft:breeze_rod",
    );
    expect(registry.getCompound("latex")?.formula).toBe("C5H8");
    expect(minecraftCoreRegistry.listBlocks()).toHaveLength(2);
  });

  it("compiles a cartoon voxel prompt for the Warden", () => {
    const prompt = compileMinecraftAssetPrompt({ mobId: "minecraft:warden" });
    expect(prompt).toContain("[MINECRAFT_ASSET]");
    expect(prompt).toContain("The Warden");
    expect(prompt).toContain("deep_dark");
    expect(prompt).toContain("cell shading");
  });
});
