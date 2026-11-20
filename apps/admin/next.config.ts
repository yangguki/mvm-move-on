import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mvn/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.MVN_API_PROXY ?? "http://localhost:3001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
