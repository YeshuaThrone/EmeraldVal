import WebSocket, { WebSocketServer } from "ws";
import { OctreeNode, type BoundingBox3D, type SpatialEntity } from "../engine/octreePartition";
import { VarIntProtocol } from "../network/varIntProtocol";

export interface SpatialPlayerClient extends SpatialEntity {
  ws: WebSocket;
  renderDistance: number; // Block distance (e.g., 64)
}

export interface SpatialRedstoneBroadcasterOptions {
  wss?: WebSocketServer;
}

export class SpatialRedstoneBroadcaster {
  private wss: WebSocketServer;
  private clients: Map<string, SpatialPlayerClient> = new Map();

  constructor(port = 8080, options: SpatialRedstoneBroadcasterOptions = {}) {
    this.wss = options.wss ?? new WebSocketServer({ port, host: "0.0.0.0" });
    this.initServer();
  }

  private initServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      const clientId = `player_${Math.random().toString(36).substring(2, 9)}`;

      // Register connected player at spawn (0, 64, 0)
      const playerClient: SpatialPlayerClient = {
        id: clientId,
        position: { x: 0, y: 64, z: 0 },
        renderDistance: 64,
        ws,
      };

      this.clients.set(clientId, playerClient);

      ws.on("close", () => {
        this.clients.delete(clientId);
      });
    });
  }

  public upsertClient(client: SpatialPlayerClient): void {
    this.clients.set(client.id, client);
  }

  /**
   * Constructs an Octree spatial tree from active players and streams
   * block/redstone events exclusively to nearby clients.
   */
  public broadcastBlockEvent(x: number, y: number, z: number, blockId: string): void {
    const worldBounds: BoundingBox3D = {
      min: { x: -1000, y: -64, z: -1000 },
      max: { x: 1000, y: 320, z: 1000 },
    };

    // 1. Build dynamic Octree partition of active player locations
    const octree = new OctreeNode(worldBounds);
    for (const player of this.clients.values()) {
      octree.insert(player);
    }

    // 2. Query clients within range of the block update coordinate
    const eventBox: BoundingBox3D = {
      min: { x: x - 64, y: y - 64, z: z - 64 },
      max: { x: x + 64, y: y + 64, z: z + 64 },
    };

    const recipientEntities = octree.queryRange(eventBox);
    const recipientIds = new Set(recipientEntities.map((entity) => entity.id));

    // 3. Create VarInt-framed binary payload
    const payload = Buffer.from(
      JSON.stringify({ x, y, z, blockId, timestamp: Date.now() }),
    );
    const binaryPacket = VarIntProtocol.createPacket(0x0f, payload); // Packet 0x0F: Block Change

    // 4. Send packet exclusively to in-range players
    for (const recipientId of recipientIds) {
      const recipient = this.clients.get(recipientId);
      if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
        recipient.ws.send(binaryPacket);
      }
    }
  }

  public stop(): void {
    this.wss.close();
  }
}
