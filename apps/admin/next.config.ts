import type { NextConfig } from "next";

const isCloudExport = process.env.NEXT_PUBLIC_MVN_DATA_MODE === "cloud";

const nextConfig: NextConfig = {
  transpilePackages: ["@mvn/shared"],
  ...(isCloudExport
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      async rewrites() {
        return [
          {
            source: "/api/:path*",
            destination: `${process.env.MVN_API_PROXY ?? "http://localhost:3001"}/:path*`,
          },
        ];
      },
    }),
};

export default nextConfig;