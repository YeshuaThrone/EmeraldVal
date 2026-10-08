import { pathToFileURL } from "node:url";
import express from "express";
import metricsRouter from "./metricsRouter";

export function createMinecraftMetricsApp() {
  const app = express();
  app.use(metricsRouter);
  return app;
}

export function startMinecraftMetricsServer(
  port = Number(process.env.MINECRAFT_ENGINE_PORT || process.env.PORT || 3000),
  host = process.env.MINECRAFT_ENGINE_HOST || "0.0.0.0",
) {
  const app = createMinecraftMetricsApp();
  const server = app.listen(port, host, () => {
    console.log(
      `[Minecraft engine] Prometheus scrape target http://${host}:${port}/metrics`,
    );
  });
  return server;
}

function isDirectRun(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return import.meta.url === pathToFileURL(invoked).href;
  } catch {
    return /config[\\/]metrics[\\/]metricsServer\.(ts|js)$/.test(invoked);
  }
}

if (isDirectRun()) {
  startMinecraftMetricsServer();
}
