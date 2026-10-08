import { describe, expect, it } from "vitest";
import metricsRouter, { prometheusExporter } from "./metricsRouter";

type MockRes = {
  headers: Record<string, string>;
  statusCode: number;
  body: string;
  setHeader: (key: string, value: string) => void;
  status: (code: number) => MockRes;
  send: (payload: string) => MockRes;
};

function invokeMetrics(): MockRes {
  const layer = (
    metricsRouter as unknown as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{ handle: (req: object, res: MockRes) => void }>;
        };
      }>;
    }
  ).stack.find((entry) => entry.route?.path === "/metrics");
  if (!layer?.route) {
    throw new Error("GET /metrics is not registered");
  }

  const res: MockRes = {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  layer.route.stack[0]!.handle({}, res);
  return res;
}

describe("Prometheus metrics router", () => {
  it("exposes OpenMetrics text on GET /metrics", () => {
    prometheusExporter.incrementCounter(
      "minecraft_redstone_ticks_total",
      3,
      "Redstone simulation ticks processed",
    );
    prometheusExporter.setGauge(
      "minecraft_pathfinder_reservations",
      1,
      "Active multi-agent collision locks",
    );

    const res = invokeMetrics();
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe(
      "text/plain; version=0.0.4; charset=utf-8",
    );
    expect(res.body).toContain("# TYPE minecraft_redstone_ticks_total counter");
    expect(res.body).toContain("minecraft_redstone_ticks_total 3");
    expect(res.body).toContain("# TYPE minecraft_pathfinder_reservations gauge");
    expect(res.body).toContain("minecraft_engine_up 1");
    expect(res.body).toContain("process_uptime_seconds");
  });
});
