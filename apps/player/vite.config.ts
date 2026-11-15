import { defineConfig } from "vite";

export default defineConfig({
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
    },
  },
});
