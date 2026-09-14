export interface AdImpression {
  impressionId: string;
  channelId: string;
  assetId: string;
  creatorId: string;
  cpmRateUSD: number;
  impressionCount: number;
  timestamp: Date;
}

export interface RevenueSplitResult {
  creatorId: string;
  assetId: string;
  grossRevenue: number;
  platformShare: number; // 50%
  creatorShare: number; // 50%
}

export class AdRevenueLedger {
  private static PLATFORM_SPLIT = 0.5;

  public static processSplit(event: AdImpression): RevenueSplitResult {
    const grossRevenue = (event.cpmRateUSD / 1000) * event.impressionCount;
    const platformShare = grossRevenue * this.PLATFORM_SPLIT;
    const creatorShare = grossRevenue - platformShare;

    return {
      creatorId: event.creatorId,
      assetId: event.assetId,
      grossRevenue: Number(grossRevenue.toFixed(4)),
      platformShare: Number(platformShare.toFixed(4)),
      creatorShare: Number(creatorShare.toFixed(4)),
    };
  }
}
