import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "ioredis", "bullmq"],
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/agents/main/chat",
      },
    ];
  },
};

export default nextConfig;
