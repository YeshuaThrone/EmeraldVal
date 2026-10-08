import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { RedstoneSimulator } from "../engine/redstoneSimulator";
import { RedstoneStreamServer } from "./redstoneStreamServer";

class MockSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
}

class MockWss extends EventEmitter {
  clients = new Set<MockSocket>();
  close() {
    this.clients.clear();
  }
}

describe("RedstoneStreamServer", () => {
  it("broadcasts active nodes on a redstone tick", () => {
    const simulator = new RedstoneSimulator();
    simulator.setNode({ x: 0, y: 64, z: 0, type: "dust" });
    simulator.propagateSignal(0, 64, 0, 15);

    const wss = new MockWss();
    const client = new MockSocket();
    wss.clients.add(client);

    const server = new RedstoneStreamServer(0, {
      wss: wss as never,
      simulator,
      autoStart: false,
    });
    const event = server.processTick();
    expect(event.tick).toBe(1);
    expect(event.activeNodes[0]?.power).toBe(15);
    expect(JSON.parse(client.sent[0]!).type).toBe("REDSTONE_TICK");
    server.stop();
  });

  it("applies SET_SIGNAL from a connected client", () => {
    const simulator = new RedstoneSimulator();
    const wss = new MockWss();
    const server = new RedstoneStreamServer(0, {
      wss: wss as never,
      simulator,
      autoStart: false,
    });
    const client = new MockSocket();
    wss.emit("connection", client);
    client.emit(
      "message",
      JSON.stringify({ action: "SET_SIGNAL", x: 2, y: 64, z: 2, power: 12 }),
    );
    expect(simulator.getNodePower(2, 64, 2)).toBe(12);
    expect(simulator.getActiveNodes()).toHaveLength(1);
    server.stop();
  });

  it("skips empty ticks except every 20th heartbeat", () => {
    const wss = new MockWss();
    const client = new MockSocket();
    wss.clients.add(client);
    const server = new RedstoneStreamServer(0, {
      wss: wss as never,
      simulator: new RedstoneSimulator(),
      autoStart: false,
    });

    server.processTick();
    expect(client.sent).toHaveLength(0);

    for (let i = 0; i < 18; i += 1) {
      server.processTick();
    }
    expect(client.sent).toHaveLength(0);

    const heartbeat = server.processTick();
    expect(heartbeat.tick).toBe(20);
    expect(heartbeat.activeNodes).toEqual([]);
    expect(JSON.parse(client.sent[0]!).type).toBe("REDSTONE_TICK");
    server.stop();
  });

  it("rejects malformed SET_SIGNAL payloads", () => {
    const wss = new MockWss();
    const server = new RedstoneStreamServer(0, {
      wss: wss as never,
      autoStart: false,
    });
    const client = new MockSocket();
    wss.emit("connection", client);
    client.emit("message", "{not-json");
    expect(JSON.parse(client.sent[0]!).error).toBe("Invalid WS payload format");
    server.stop();
  });
});
