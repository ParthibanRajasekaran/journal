import { defineConfig, devices } from "@playwright/test";

// Browser journeys run only against an address you name. There is no default: the live site is production,
// and a casual run must never write to it. Use `make web-e2e-local` for a local backend.
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error(
    "E2E_BASE_URL is required (for example http://127.0.0.1:8000). Playwright never defaults to the live site.",
  );
}

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { viewport: { width: 360, height: 780 }, isMobile: false } },
  ],
});
