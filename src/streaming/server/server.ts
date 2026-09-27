import { pathToFileURL } from "node:url";
import { app, httpServer } from "./broadcastServer";
import { initializeDatabase } from "../db/dbInit";
import { CableDatabaseEngine } from "../db/dbEngine";
import { startScheduleGapWorker } from "../workers/scheduleGapWorker";

const PORT = Number(process.env.BROADCAST_PORT || process.env.PORT || 4000);

export async function bootstrapServer() {
  try {
    console.log("[Server] Starting Cable Network Infrastructure...");

    await initializeDatabase();

    const networks = await CableDatabaseEngine.loadAllNetworks();
    console.log(
      `[Server] Loaded ${networks.length} active networks from database.`,
    );

    startScheduleGapWorker();

    httpServer.listen(PORT, () => {
      console.log(
        `[Server] Broadcast Server online and listening on port ${PORT}`,
      );
      console.log(`[Server] Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("[Server] Fatal startup error:", error);
    process.exit(1);
  }
}

app.get("/health", (_req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

function isDirectRun(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return import.meta.url === pathToFileURL(invoked).href;
  } catch {
    return /streaming[\\/]server[\\/]server\.(ts|js)$/.test(invoked);
  }
}

if (isDirectRun()) {
  void bootstrapServer();
}
