export interface MetaHumanAsset {
  id: string;
  name: string;
  blueprintPath: string;
  liveLinkSubjectName: string;
  gender: "MALE" | "FEMALE" | "NEUTRAL";
  defaultLightingRig: string;
}

export const METAHUMAN_REGISTRY: Record<string, MetaHumanAsset> = {
  HOST_01: {
    id: "HOST_01",
    name: "Marcus (Main Anchor)",
    blueprintPath: "/Game/MetaHumans/Marcus/BP_Marcus.BP_Marcus_C",
    liveLinkSubjectName: "Audio2Face_Marcus",
    gender: "MALE",
    defaultLightingRig: "KEY_SPOT_NEUTRAL",
  },
  GUEST_01: {
    id: "GUEST_01",
    name: "Elena (Tech Analyst)",
    blueprintPath: "/Game/MetaHumans/Elena/BP_Elena.BP_Elena_C",
    liveLinkSubjectName: "Audio2Face_Elena",
    gender: "FEMALE",
    defaultLightingRig: "WARM_AMBIFILL",
  },
};

const assignedSlots = new Set<string>();

export function lookupMetaHuman(hostId: string): MetaHumanAsset | null {
  const key = hostId.trim();
  if (!key) return null;
  return METAHUMAN_REGISTRY[key] ?? METAHUMAN_REGISTRY[key.toUpperCase()] ?? null;
}

/**
 * Resolves the target MetaHuman blueprint and LiveLink channel for a given studio host slot.
 */
export function getMetaHumanConfig(hostId: string): MetaHumanAsset {
  const asset = lookupMetaHuman(hostId);
  if (!asset) {
    throw new Error(
      `[MetaHumanRegistry] Target character ID '${hostId}' non-existent in active library.`,
    );
  }
  return asset;
}

export function listMetaHumans(): MetaHumanAsset[] {
  return Object.values(METAHUMAN_REGISTRY);
}

export function acquireMetaHuman(hostId: string): MetaHumanAsset {
  const asset = getMetaHumanConfig(hostId);
  if (assignedSlots.has(asset.id)) {
    throw new Error(
      `[MetaHumanRegistry] ${asset.id} is already assigned on the LiveLink pool.`,
    );
  }
  assignedSlots.add(asset.id);
  return asset;
}

export function releaseMetaHuman(hostId: string): void {
  const asset = lookupMetaHuman(hostId);
  assignedSlots.delete(asset?.id ?? hostId.trim().toUpperCase());
}

export function listAssignedMetaHumans(): string[] {
  return [...assignedSlots];
}

export function resetMetaHumanPool(): void {
  assignedSlots.clear();
}
