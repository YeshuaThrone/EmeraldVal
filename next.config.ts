import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["leaflet", "react-leaflet", "three"],
  // better-sqlite3 is a native addon — keep it out of the bundler and
  // require it at runtime from the server only.
  serverExternalPackages: [
    "better-sqlite3",
    "pg",
    "express",
    "socket.io",
    "redis",
    "bullmq",
  ],
};

export default nextConfig;
