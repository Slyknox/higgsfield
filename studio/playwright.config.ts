import { defineConfig, devices } from "@playwright/test"

// End-to-end tests against a production build (`pnpm build` first) and a
// throwaway Postgres database. E2E_DATABASE_URL's public schema is wiped.
const PORT = Number(process.env.E2E_PORT ?? 3123)
const BASE_URL = `http://localhost:${PORT}`
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/studio_test"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL,
      AUTH_SECRET: process.env.E2E_AUTH_SECRET ?? "e2e-only-secret-not-for-production-0123456789",
      AUTH_URL: BASE_URL,
      EMAIL_TRANSPORT: "outbox",
      HF_API_BASE_URL: "https://api.higgsfield.ai",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  metadata: { databaseUrl: DATABASE_URL },
})
