import { Router, type Request, type Response } from "express";
import { PrometheusExporter } from "../telemetry/prometheusExporter";

export const prometheusExporter = new PrometheusExporter();
const metricsRouter = Router();

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * GET /metrics
 * Scraped by Prometheus server on a configured pull interval.
 */
metricsRouter.get("/metrics", (_req: Request, res: Response) => {
  try {
    const metricsPayload = prometheusExporter.getPrometheusMetrics();

    // Standard OpenTelemetry / Prometheus plain text content type
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(metricsPayload);
  } catch (error: unknown) {
    res
      .status(500)
      .send(`# ERROR: Failed to render metrics - ${errorMessage(error, "unknown")}`);
  }
});

export default metricsRouter;
