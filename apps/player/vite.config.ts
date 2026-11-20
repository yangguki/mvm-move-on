import path from "node:path";
import { defineConfig } from "vite";

const isCloudExport = process.env.VITE_MVN_DATA_MODE === "cloud";

export default defineConfig({
  base: isCloudExport ? "/player/" : "/",
  resolve: {
    alias: {
      "@mvn/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  build: {
    target: "es2017",
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 3002,
    proxy: {
      "/player": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/skins": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
