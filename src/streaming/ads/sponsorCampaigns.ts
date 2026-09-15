import { CableDatabaseEngine, isUnavailableDb } from "../db/dbEngine";

export interface SponsorCampaign {
  id: string;
  advertiserName: string;
  campaignName: string;
  cpmRate: number;
  totalBudget: number;
  spentBudget: number;
  isActive: boolean;
}

const memoryCampaigns: SponsorCampaign[] = [];

export function buildCampaignId(advertiserName: string): string {
  const slug = advertiserName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, 24);
  return `cmp-${slug || "sponsor"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function listSponsorCampaigns(): Promise<SponsorCampaign[]> {
  try {
    const rows = await CableDatabaseEngine.loadAdCampaigns();
    if (rows.length > 0) return rows;
  } catch {
    /* fall through to in-memory */
  }
  return memoryCampaigns.map((c) => ({ ...c }));
}

export async function provisionSponsorCampaign(input: {
  advertiserName?: unknown;
  campaignName?: unknown;
  cpmRate?: unknown;
  totalBudget?: unknown;
}): Promise<SponsorCampaign> {
  const advertiserName = String(input.advertiserName ?? "").trim();
  const campaignName = String(input.campaignName ?? "").trim();
  const cpmRate = Number(input.cpmRate);
  const totalBudget = Number(input.totalBudget);

  if (!advertiserName) throw new Error("advertiserName is required");
  if (!campaignName) throw new Error("campaignName is required");
  if (!Number.isFinite(cpmRate) || cpmRate <= 0) {
    throw new Error("cpmRate is required");
  }
  if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
    throw new Error("totalBudget is required");
  }

  const campaign: SponsorCampaign = {
    id: buildCampaignId(advertiserName),
    advertiserName,
    campaignName,
    cpmRate,
    totalBudget,
    spentBudget: 0,
    isActive: true,
  };

  try {
    await CableDatabaseEngine.insertAdCampaign({
      id: campaign.id,
      advertiserName,
      campaignName,
      cpmRate,
      totalBudget,
    });
  } catch (err) {
    if (!isUnavailableDb(err)) {
      throw new Error("Failed to create sponsor campaign");
    }
  }

  memoryCampaigns.push(campaign);
  return campaign;
}
