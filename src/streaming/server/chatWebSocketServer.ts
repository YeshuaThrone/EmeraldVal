import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import {
  buildChatBroadcast,
  type ChatPayload,
} from "./chatTypes";

export class WorfiChatServer {
  private io: SocketIOServer;
  private channelViewerCounts: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      path: "/v1/chat/ws",
    });

    this.initListeners();
  }

  private initListeners() {
    this.io.on("connection", (socket: Socket) => {
      let currentRoom: string | null = null;

      socket.on("JOIN_ROOM", ({ channelId }: { channelId: string }) => {
        if (currentRoom) {
          socket.leave(currentRoom);
          this.decrementViewer(currentRoom, socket.id);
        }

        currentRoom = `room:${channelId}`;
        socket.join(currentRoom);
        this.incrementViewer(currentRoom, socket.id);

        this.broadcastViewerCount(currentRoom);
      });

      socket.on("SEND_MESSAGE", (payload: ChatPayload) => {
        const broadcastData = buildChatBroadcast(payload);
        if (!broadcastData) return;
        this.io.to(`room:${payload.channelId}`).emit("NEW_MESSAGE", broadcastData);
      });

      socket.on("disconnect", () => {
        if (currentRoom) {
          this.decrementViewer(currentRoom, socket.id);
          this.broadcastViewerCount(currentRoom);
        }
      });
    });
  }

  private incrementViewer(room: string, socketId: string) {
    if (!this.channelViewerCounts.has(room)) {
      this.channelViewerCounts.set(room, new Set());
    }
    this.channelViewerCounts.get(room)!.add(socketId);
  }

  private decrementViewer(room: string, socketId: string) {
    const viewers = this.channelViewerCounts.get(room);
    if (viewers) {
      viewers.delete(socketId);
      if (viewers.size === 0) {
        this.channelViewerCounts.delete(room);
      }
    }
  }

  private broadcastViewerCount(room: string) {
    const count = this.channelViewerCounts.get(room)?.size || 0;
    this.io.to(room).emit("VIEWER_COUNT_UPDATE", { viewerCount: count });
  }
}
