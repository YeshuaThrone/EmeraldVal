import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@deck.gl/core",
    "@deck.gl/react",
    "@deck.gl/geo-layers",
    "@deck.gl/layers",
    "@deck.gl/mesh-layers",
    "@deck.gl/widgets",
    "@luma.gl/core",
    "@luma.gl/engine",
    "@math.gl/core",
    "@loaders.gl/core",
    "@loaders.gl/3d-tiles",
  ],
};

export default nextConfig;
