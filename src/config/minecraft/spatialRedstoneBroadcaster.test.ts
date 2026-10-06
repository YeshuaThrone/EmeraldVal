import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { OctreeNode } from "../engine/octreePartition";
import { VarIntProtocol } from "../network/varIntProtocol";
import { SpatialRedstoneBroadcaster } from "./spatialRedstoneBroadcaster";

class MockSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sent: Buffer[] = [];
  send(data: Buffer) {
    this.sent.push(data);
  }
}

class MockWss extends EventEmitter {
  close() {}
}

function decodeBlockPacket(packet: Buffer) {
  const length = VarIntProtocol.readVarInt(packet);
  const packetId = VarIntProtocol.readVarInt(packet, length.bytesRead);
  const payload = packet.subarray(length.bytesRead + packetId.bytesRead);
  return {
    packetId: packetId.value,
    body: JSON.parse(payload.toString()) as {
      x: number;
      y: number;
      z: number;
      blockId: string;
    },
  };
}

describe("OctreeNode", () => {
  it("returns only entities inside the query AABB", () => {
    const tree = new OctreeNode({
      min: { x: -1000, y: -64, z: -1000 },
      max: { x: 1000, y: 320, z: 1000 },
    });
    tree.insert({ id: "near", position: { x: 0, y: 64, z: 0 } });
    tree.insert({ id: "far", position: { x: 500, y: 64, z: 500 } });
    const hits = tree.queryRange({
      min: { x: -64, y: 0, z: -64 },
      max: { x: 64, y: 128, z: 64 },
    });
    expect(hits.map((entity) => entity.id)).toEqual(["near"]);
  });
});

describe("SpatialRedstoneBroadcaster", () => {
  it("sends VarInt block-change packets only to in-range players", () => {
    const wss = new MockWss();
    const server = new SpatialRedstoneBroadcaster(0, { wss: wss as never });
    const near = new MockSocket();
    const far = new MockSocket();
    server.upsertClient({
      id: "near",
      position: { x: 0, y: 64, z: 0 },
      renderDistance: 64,
      ws: near as never,
    });
    server.upsertClient({
      id: "far",
      position: { x: 500, y: 64, z: 500 },
      renderDistance: 64,
      ws: far as never,
    });

    server.broadcastBlockEvent(2, 64, 2, "minecraft:redstone_block");

    expect(near.sent).toHaveLength(1);
    expect(far.sent).toHaveLength(0);
    const decoded = decodeBlockPacket(near.sent[0]!);
    expect(decoded.packetId).toBe(0x0f);
    expect(decoded.body.blockId).toBe("minecraft:redstone_block");
    expect(decoded.body.x).toBe(2);
    server.stop();
  });

  it("registers a spawn player on websocket connection", () => {
    const wss = new MockWss();
    const server = new SpatialRedstoneBroadcaster(0, { wss: wss as never });
    const client = new MockSocket();
    wss.emit("connection", client);
    server.broadcastBlockEvent(0, 64, 0, "minecraft:redstone_wire");
    expect(client.sent).toHaveLength(1);
    expect(decodeBlockPacket(client.sent[0]!).packetId).toBe(0x0f);
    client.emit("close");
    server.broadcastBlockEvent(0, 64, 0, "minecraft:redstone_wire");
    expect(client.sent).toHaveLength(1);
    server.stop();
  });
});
