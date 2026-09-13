import { defineConfig, devices } from "@playwright/test";

// 3100 rather than 3000: another process commonly holds 3000 on this machine,
// and binding it silently would test the wrong server.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && PORT=${PORT} npm run start`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      SESSION_SECRET: "e2e-session-secret-value-at-least-32-chars",
      // scrypt hash of "e2e-password"; regenerate with npm run admin:hash
      ADMIN_PASSWORD_HASH: process.env.E2E_ADMIN_HASH ?? "",
      PGLITE_PATH: "./.pglite-e2e",
      UPLOAD_DIR: "./.uploads-e2e",
      NEXT_PUBLIC_ETISALAT_NUMBER: "01000000000",
      NEXT_PUBLIC_INSTAPAY_URL: "https://example.com/instapay",
      // Every request in a Playwright run comes from one address, which would
      // otherwise trip limits sized for the public internet. Rate limiting
      // itself is covered by tests/api/orders.test.ts.
      ORDER_RATE_LIMIT: "1000",
      ADMIN_LOGIN_RATE_LIMIT: "1000",
    },
  },
});
