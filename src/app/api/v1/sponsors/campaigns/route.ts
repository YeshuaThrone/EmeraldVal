import { NextRequest, NextResponse } from "next/server";
import {
  listSponsorCampaigns,
  provisionSponsorCampaign,
} from "@/streaming/ads/sponsorCampaigns";

export async function GET() {
  try {
    const campaigns = await listSponsorCampaigns();
    return NextResponse.json({ success: true, campaigns });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to list campaigns" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: {
    advertiserName?: unknown;
    campaignName?: unknown;
    cpmRate?: unknown;
    totalBudget?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const campaign = await provisionSponsorCampaign(body);
    return NextResponse.json({
      success: true,
      message: `Campaign ${campaign.campaignName} booked.`,
      campaign,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create sponsor campaign";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          status === 500 ? "Failed to create sponsor campaign" : message,
      },
      { status },
    );
  }
}
