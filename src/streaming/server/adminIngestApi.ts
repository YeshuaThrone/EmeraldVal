import { Router, type Request, type Response } from "express";
import { HlsIngestionPipeline } from "../ingest/hlsIngestionService";

export const adminRouter = Router();

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
