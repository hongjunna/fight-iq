import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Lets clients recover cleanly when a blue/green deployment changes the build
  // serving subsequent navigation requests.
  deploymentId: process.env.DEPLOYMENT_VERSION,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
