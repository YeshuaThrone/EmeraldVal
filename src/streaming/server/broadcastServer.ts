import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createCreatorInvite, findValidInvite } from "./creatorInvites";
import { isAdminAuthorized } from "./adminAuth";

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// --- ADMIN AUTH MIDDLEWARE ---
export const requireAdminAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!isAdminAuthorized(req.headers.authorization)) {
    res.status(401).json({ error: "Unauthorized: Invalid Admin Token" });
    return;
  }
  next();
};

// --- INVITE GENERATION ENDPOINT ---
app.post(
  "/api/admin/invites/create",
  requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { creatorName, creatorEmail, validDays = 7 } = req.body as {
      creatorName?: string;
      creatorEmail?: string;
      validDays?: number;
    };

    if (!creatorName || !creatorEmail) {
      res.status(400).json({ error: "Creator name and email required" });
      return;
    }

    try {
      const invite = await createCreatorInvite({
        creatorName,
        creatorEmail,
        validDays,
      });
      res.json({ success: true, ...invite });
    } catch {
      res.status(500).json({ error: "Failed to create invite" });
    }
  },
);

// --- TOKEN VALIDATION ENDPOINT ---
app.get(
  "/api/invites/validate/:token",
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;

    try {
      const invite = token ? await findValidInvite(token) : null;
      if (!invite) {
        res
          .status(404)
          .json({ valid: false, error: "Invalid or expired invite token" });
        return;
      }
      res.json({ valid: true, invite });
    } catch {
      res.status(500).json({ error: "Validation failed" });
    }
  },
);

// --- REAL-TIME BROADCAST CLOCK SOCKET ---
io.on("connection", (socket) => {
  console.log(`[Socket] Viewer connected: ${socket.id}`);

  socket.emit("clockSync", { serverTime: Date.now() });

  socket.on("disconnect", () => {
    console.log(`[Socket] Viewer disconnected: ${socket.id}`);
  });
});

// Heartbeat pulse every 5 seconds to lock sync across all client players
const broadcastHeartbeat = setInterval(() => {
  io.emit("heartbeat", { broadcastTime: Date.now() });
}, 5000);
broadcastHeartbeat.unref();

export { app, httpServer, io, broadcastHeartbeat };
