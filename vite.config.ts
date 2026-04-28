import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set BASE_PATH at build time when deploying to GitHub Pages under a subpath,
// e.g. BASE_PATH=/claudeapps-/ for https://<user>.github.io/claudeapps-/
declare const process: { env: Record<string, string | undefined> };
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Local dev: proxy /api/* to a local Functions emulator if you run one.
      // With `wrangler pages dev`, it serves on :8788 by default.
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
