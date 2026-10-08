function sanitizeMetricName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_:]/g, "_");
  if (!/^[a-zA-Z_:]/.test(cleaned)) {
    throw new Error(`Invalid Prometheus metric name: ${name}`);
  }
  return cleaned;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(value);
}

interface MetricSample {
  value: number;
  help: string;
  type: "counter" | "gauge";
}

export class PrometheusExporter {
  private samples = new Map<string, MetricSample>();

  public incrementCounter(name: string, amount = 1, help = ""): void {
    const key = sanitizeMetricName(name);
    const existing = this.samples.get(key);
    if (existing && existing.type !== "counter") {
      throw new Error(`${key} is already registered as a ${existing.type}`);
    }
    this.samples.set(key, {
      type: "counter",
      help: help || existing?.help || key,
      value: (existing?.value ?? 0) + amount,
    });
  }

  public setGauge(name: string, value: number, help = ""): void {
    const key = sanitizeMetricName(name);
    const existing = this.samples.get(key);
    if (existing && existing.type !== "gauge") {
      throw new Error(`${key} is already registered as a ${existing.type}`);
    }
    this.samples.set(key, {
      type: "gauge",
      help: help || existing?.help || key,
      value,
    });
  }

  /**
   * OpenMetrics / Prometheus 0.0.4 text exposition.
   */
  public getPrometheusMetrics(): string {
    this.setGauge(
      "process_uptime_seconds",
      process.uptime(),
      "Process uptime in seconds",
    );
    this.setGauge(
      "process_resident_memory_bytes",
      process.memoryUsage().rss,
      "Resident set size in bytes",
    );
    this.setGauge(
      "nodejs_heap_used_bytes",
      process.memoryUsage().heapUsed,
      "Node.js heap used in bytes",
    );
    this.setGauge(
      "minecraft_engine_up",
      1,
      "Minecraft engine scrape target is up",
    );

    if (!this.samples.has("minecraft_redstone_ticks_total")) {
      this.incrementCounter(
        "minecraft_redstone_ticks_total",
        0,
        "Redstone simulation ticks processed",
      );
    }
    if (!this.samples.has("minecraft_pathfinder_reservations")) {
      this.setGauge(
        "minecraft_pathfinder_reservations",
        0,
        "Active multi-agent collision locks",
      );
    }
    if (!this.samples.has("minecraft_chunk_saves_total")) {
      this.incrementCounter(
        "minecraft_chunk_saves_total",
        0,
        "World chunks written to Redis",
      );
    }

    const lines: string[] = [];
    for (const [name, sample] of this.samples) {
      lines.push(`# HELP ${name} ${sample.help}`);
      lines.push(`# TYPE ${name} ${sample.type}`);
      lines.push(`${name} ${formatValue(sample.value)}`);
    }
    return `${lines.join("\n")}\n`;
  }
}
