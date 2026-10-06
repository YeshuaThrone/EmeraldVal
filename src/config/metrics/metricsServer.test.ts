import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createMinecraftMetricsApp, startMinecraftMetricsServer } from "./metricsServer";

const prometheusYml = readFileSync(
  path.join(import.meta.dirname, "../telemetry/prometheus.yml"),
  "utf8",
);

describe("Prometheus minecraft_core_engine scrape config", () => {
  it("pulls /metrics from minecraft-engine:3000 every 5s", () => {
    expect(prometheusYml).toMatch(/scrape_interval:\s*5s/);
    expect(prometheusYml).toMatch(/evaluation_interval:\s*5s/);
    expect(prometheusYml).toContain("job_name: 'minecraft_core_engine'");
    expect(prometheusYml).toContain("metrics_path: '/metrics'");
    expect(prometheusYml).toContain("targets: ['minecraft-engine:3000']");
    expect(prometheusYml).toContain("environment: 'production'");
    expect(prometheusYml).toContain("service: 'game-engine-backend'");
  });
});

describe("minecraft-engine metrics server", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => (error ? reject(error) : resolve()));
      server = undefined;
    });
  });

  it("serves Prometheus text at GET /metrics", async () => {
    const app = createMinecraftMetricsApp();
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP address");
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/metrics`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("minecraft_engine_up 1");
  });

  it("binds through startMinecraftMetricsServer", async () => {
    server = startMinecraftMetricsServer(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP address");
    }
    const res = await fetch(`http://127.0.0.1:${address.port}/metrics`);
    expect(res.status).toBe(200);
  });
});
