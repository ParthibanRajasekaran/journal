import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Release builds must reach the API over HTTPS. `beta` is the phone build: it has no origin of its own, so the base must
// be an https:// URL. Plain `vite build` is mode `production` and makes the web client the API serves, where an empty
// base means same-origin; there only a non-HTTPS base is refused.
export default defineConfig(({ mode }) => {
  if (mode === "beta" || mode === "production") {
    const apiBase = loadEnv(mode, process.cwd(), "VITE_").VITE_API_BASE ?? "";
    const sameOriginWeb = mode === "production" && apiBase === "";
    if (!apiBase.startsWith("https://") && !sameOriginWeb) {
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
