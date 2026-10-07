import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3217);

/**
 * End-to-end tests run against a production build of the real server
 * (Next.js + Socket.IO), with shortened countdown/result timings.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? "npx tsx server.ts" : "npm run build && npx tsx server.ts",
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "localhost",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
      PERSISTENCE: "memory",
      WD_COUNTDOWN_MS: "1200",
      WD_RESULT_MS: "1500",
      WD_DISCONNECT_GRACE_MS: "30000",
      WD_SILENT: "1",
    },
  },
});
