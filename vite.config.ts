import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
