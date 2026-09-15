import { afterEach, describe, expect, it, vi } from "vitest";
import { provisionSponsorCampaign } from "./sponsorCampaigns";

vi.mock("../db/dbEngine", () => ({
  CableDatabaseEngine: {
    insertAdCampaign: vi.fn().mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    ),
    loadAdCampaigns: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
  },
}));

describe("provisionSponsorCampaign", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("books a campaign in memory when Postgres is down", async () => {
    const campaign = await provisionSponsorCampaign({
      advertiserName: "Rainey Street Brewing",
      campaignName: "Patio Flight",
      cpmRate: 18,
      totalBudget: 2500,
    });
    expect(campaign.advertiserName).toBe("Rainey Street Brewing");
    expect(campaign.id).toMatch(/^cmp-rainey-street-brewing-/);
    expect(campaign.spentBudget).toBe(0);
  });

  it("requires advertiser and budget", async () => {
    await expect(
      provisionSponsorCampaign({ campaignName: "Ghost" }),
    ).rejects.toThrow("advertiserName is required");
  });
});
