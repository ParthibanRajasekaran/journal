import { defineConfig, devices } from "@playwright/test";

// Tests run against the live site by default. Point E2E_BASE_URL at another address to test elsewhere.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://journal.getrendercheck.com",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { viewport: { width: 360, height: 780 }, isMobile: false } },
  ],
});
