import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mvn/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
