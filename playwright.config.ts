import { defineConfig, devices } from "@playwright/test";
const url = process.env.TEST_DATABASE_URL;
const runtimeUrl = url ? new URL(url) : null;
if (runtimeUrl) {
  runtimeUrl.username = "vocabdeck_app";
  runtimeUrl.password = "";
}
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/e2e/setup.ts",
  globalTeardown: "./tests/e2e/teardown.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/auth-server.mjs",
      url: "http://127.0.0.1:55434/health",
      reuseExistingServer: false,
      env: { VOCABDECK_E2E: "1" },
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://localhost:3100",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_APP_URL: "http://localhost:3100",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55434",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
        DATABASE_URL:
          process.env.TEST_RUNTIME_DATABASE_URL || runtimeUrl?.toString() || "",
        AI_ENABLED: "false",
      },
    },
  ],
});
