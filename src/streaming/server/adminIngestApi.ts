import { Router, type Request, type Response } from "express";
import {
  bridgeActiveChannelGaps,
  listLineupChannels,
  provisionCustomChannel,
} from "../admin/channelProvisioning";
import {
  listSponsorCampaigns,
  provisionSponsorCampaign,
} from "../ads/sponsorCampaigns";
import { HlsIngestionPipeline } from "../ingest/hlsIngestionService";
import { AtxNewsService } from "../news/atxNewsService";

export const adminRouter = Router();

adminRouter.get("/channels", async (_req: Request, res: Response): Promise<void> => {
  try {
    const channels = await listLineupChannels();
    res.json({ success: true, channels });
  } catch {
    res.status(500).json({ success: false, error: "Failed to list channels" });
  }
});

adminRouter.get("/news/austin", async (_req: Request, res: Response): Promise<void> => {
  const headlines = await AtxNewsService.getLiveAustinHeadlines();
  res.json({
    success: true,
    channelId: "ch-04",
    headlines,
    ticker: AtxNewsService.formatTicker(headlines),
  });
});

adminRouter.get(
  "/sponsors/campaigns",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const campaigns = await listSponsorCampaigns();
      res.json({ success: true, campaigns });
    } catch {
      res.status(500).json({ success: false, error: "Failed to list campaigns" });
    }
  },
);

adminRouter.post(
  "/sponsors/campaigns",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const campaign = await provisionSponsorCampaign(req.body);
      res.json({
        success: true,
        message: `Campaign ${campaign.campaignName} booked.`,
        campaign,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create sponsor campaign";
      const status = message.includes("required") ? 400 : 500;
      res.status(status).json({
        success: false,
        error: status === 500 ? "Failed to create sponsor campaign" : message,
      });
    }
  },
);

function readAdminKey(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

export function isWorfiAdminKey(header: string | string[] | undefined): boolean {
  const secret = process.env.WORFI_ADMIN_SECRET;
  if (!secret) return false;
  return readAdminKey(header) === secret;
}

/**
 * POST /api/v1/admin/schedule-segment
 * INTERNAL ONLY: Network programming team schedules approved content onto channels
 */
adminRouter.post(
  "/admin/schedule-segment",
  async (req: Request, res: Response): Promise<void> => {
    const adminKey = req.headers["x-worfi-admin-key"];
    if (!isWorfiAdminKey(adminKey)) {
      res.status(403).json({ success: false, error: "Unauthorized network access" });
      return;
    }

    const { title, creatorName, channelId, sourceVideoUrl } = req.body as {
      title?: string;
      creatorName?: string;
      channelId?: string;
      sourceVideoUrl?: string;
    };

    try {
      const result = await HlsIngestionPipeline.processAndIngestVideo({
        title: title ?? "",
        creatorName: creatorName ?? "",
        channelId: channelId ?? "",
        sourceVideoUrl: sourceVideoUrl ?? "",
      });

      res.json({
        success: true,
        message: `Program scheduled successfully on ${channelId}`,
        ...result,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to schedule programming";
      const status = message.includes("not found") ? 404 : 500;
      res.status(status).json({ success: false, error: message });
    }
  },
);

/**
 * POST /api/v1/admin/channels/create
 * INTERNAL ONLY: Provision a new custom channel (News, Sports, Indie, etc.)
 */
adminRouter.post(
  "/admin/channels/create",
  async (req: Request, res: Response): Promise<void> => {
    if (!isWorfiAdminKey(req.headers["x-worfi-admin-key"])) {
      res.status(403).json({ success: false, error: "Unauthorized network access" });
      return;
    }

    const { channelNumber, channelName, category } = req.body as {
      channelNumber?: unknown;
      channelName?: unknown;
      category?: unknown;
    };

    try {
      const created = await provisionCustomChannel({
        channelNumber,
        channelName,
        category,
      });
      res.json({
        success: true,
        message: `Channel CH ${created.channelNumber} (${created.channelName}) provisioned successfully.`,
        channelId: created.channelId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create custom channel";
      const status = message.includes("required") ? 400 : 500;
      res.status(status).json({
        success: false,
        error:
          status === 500 ? "Failed to create custom channel" : message,
      });
    }
  },
);

/**
 * POST /api/v1/admin/bridge-gaps
 * INTERNAL ONLY: Fill 30-minute block remainders with station bumpers
 */
adminRouter.post(
  "/admin/bridge-gaps",
  async (req: Request, res: Response): Promise<void> => {
    if (!isWorfiAdminKey(req.headers["x-worfi-admin-key"])) {
      res.status(403).json({ success: false, error: "Unauthorized network access" });
      return;
    }

    const channelId =
      typeof req.body?.channelId === "string" ? req.body.channelId : undefined;

    try {
      const result = await bridgeActiveChannelGaps(channelId);
      res.json({
        success: true,
        message:
          result.inserted > 0
            ? `Bridged ${result.inserted} gap(s) across ${result.processed} channel(s).`
            : "No schedule gaps needed bridging.",
        inserted: result.inserted,
      });
    } catch {
      res.status(500).json({ success: false, error: "Failed." });
    }
  },
);
