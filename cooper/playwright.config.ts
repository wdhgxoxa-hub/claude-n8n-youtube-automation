import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
const secret = process.env.COOPER_E2E_SECRET ?? randomBytes(32).toString("hex");
process.env.COOPER_E2E_SECRET = secret;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3107",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    permissions: ["microphone"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:3107/entrar",
    reuseExistingServer: false,
    timeout: 120000,
    env: { COOPER_TEST_SECRET: secret },
  },
});
