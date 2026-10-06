import { WebSocket, WebSocketServer } from "ws";
import { RedstoneSimulator } from "../engine/redstoneSimulator";

export interface RedstoneTickEvent {
  tick: number;
  timestamp: number;
  activeNodes: Array<{ x: number; y: number; z: number; power: number }>;
}

export interface RedstoneStreamServerOptions {
  wss?: WebSocketServer;
  simulator?: RedstoneSimulator;
  autoStart?: boolean;
}

export class RedstoneStreamServer {
  private wss: WebSocketServer;
  private redstoneSim: RedstoneSimulator;
  private currentTick = 0;
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(port = 8080, options: RedstoneStreamServerOptions = {}) {
    this.wss = options.wss ?? new WebSocketServer({ port, host: "0.0.0.0" });
    this.redstoneSim = options.simulator ?? new RedstoneSimulator();
    this.init();
    // Run tick loop at 20 TPS (50ms per tick)
    if (options.autoStart !== false) {
      this.tickInterval = setInterval(() => this.processTick(), 50);
    }
    console.log(`[Redstone WS] Streaming server running on ws://localhost:${port}`);
  }

  public getTick(): number {
    return this.currentTick;
  }

  public getSimulator(): RedstoneSimulator {
    return this.redstoneSim;
  }

  private init(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[Redstone WS] Client connected");

      ws.on("message", (message: WebSocket.RawData) => {
        try {
          const payload = JSON.parse(message.toString()) as {
            action?: unknown;
            x?: unknown;
            y?: unknown;
            z?: unknown;
            power?: unknown;
          };

          if (payload.action === "SET_SIGNAL") {
            const x = Number(payload.x);
            const y = Number(payload.y);
            const z = Number(payload.z);
            const power = Number(payload.power ?? 15);
            this.redstoneSim.propagateSignal(x, y, z, power);
          }
        } catch {
          ws.send(JSON.stringify({ error: "Invalid WS payload format" }));
        }
      });

      ws.on("close", () => console.log("[Redstone WS] Client disconnected"));
    });
  }

  public processTick(): RedstoneTickEvent {
    this.currentTick += 1;
    const activeNodes = this.redstoneSim.getActiveNodes();
    const eventPayload: RedstoneTickEvent = {
      tick: this.currentTick,
      timestamp: Date.now(),
      activeNodes,
    };

    if (activeNodes.length === 0 && this.currentTick % 20 !== 0) {
      return eventPayload;
    }

    const data = JSON.stringify({ type: "REDSTONE_TICK", payload: eventPayload });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
    return eventPayload;
  }

  public stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.wss.close();
  }
}
