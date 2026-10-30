import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // In development the API runs on port 8000. Requests under /api go there.
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  test: { environment: "jsdom" },
});
