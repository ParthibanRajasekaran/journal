import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Release modes ship to phones and real users: the API must be reached over HTTPS.
const RELEASE_MODES = ["beta", "production"];

export default defineConfig(({ mode }) => {
  if (RELEASE_MODES.includes(mode)) {
    const apiBase = loadEnv(mode, process.cwd(), "VITE_").VITE_API_BASE ?? "";
    if (!apiBase.startsWith("https://")) {
      throw new Error(
        `vite build --mode ${mode} needs VITE_API_BASE to start with https:// (got ${apiBase || "nothing"})`,
      );
    }
  }
  return {
    plugins: [react()],
    server: {
      // In development the API runs on port 8000. Requests under /api go there.
      proxy: { "/api": "http://127.0.0.1:8000" },
    },
    test: { environment: "jsdom", include: ["src/**/*.test.ts"] },
  };
});
