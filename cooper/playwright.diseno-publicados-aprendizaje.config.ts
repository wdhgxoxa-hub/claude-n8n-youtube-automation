import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";

const port = process.env.COOPER_E2E_PORT ?? "33181";
const fixturePort = process.env.COOPER_E2E_FIXTURE_PORT ?? "33182";
const secret = process.env.COOPER_E2E_SECRET ?? randomBytes(32).toString("hex");
process.env.COOPER_E2E_SECRET = secret;
process.env.COOPER_E2E_FIXTURE_PORT = fixturePort;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./diseno-publicados-aprendizaje",
  testMatch: "puerta.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  retries: 0,
  outputDir: "../evidencias-diseno/playwright-artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "../evidencias-diseno/puerta-diseno.json" }],
  ],
  use: {
    browserName: "chromium",
    baseURL,
    extraHTTPHeaders: { Referer: baseURL },
    timezoneId: "America/Lima",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    video: "on",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "pantallas", grepInvert: /fluidez y CLS/ },
    {
      name: "medicion",
      grep: /fluidez y CLS/,
      use: { video: "off", trace: "off" },
    },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${baseURL}/entrar`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      COOPER_E2E_PORT: port,
      COOPER_E2E_FIXTURE_PORT: fixturePort,
      COOPER_E2E_SECRET: secret,
      COOPER_DEMO: "0",
    },
  },
});
