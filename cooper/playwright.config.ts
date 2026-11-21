import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
const baseURL = `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "3107"}`;
const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
const secret = process.env.COOPER_E2E_SECRET ?? randomBytes(32).toString("hex");
process.env.COOPER_E2E_SECRET = secret;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter:
    process.env.COOPER_CI_REPORTES === "1"
      ? [
          ["list"],
          ["html", { open: "never" }],
          ["json", { outputFile: ".cache/puerta/playwright.json" }],
        ]
      : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // Las llamadas API del ensayo deben cumplir el mismo control CSRF que el navegador.
    extraHTTPHeaders: { Referer: baseURL },
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
  projects: [
    {
      name: "chromium",
      testIgnore: [
        "diseno.spec.ts",
        "animacion.spec.ts",
        "resultados.spec.ts",
        "operacion.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "demostracion",
      testMatch: [
        "diseno.spec.ts",
        "animacion.spec.ts",
        "resultados.spec.ts",
        "operacion.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: demoURL,
        extraHTTPHeaders: { Referer: demoURL },
      },
    },
  ],
  webServer: [
    {
      command: "node scripts/e2e-server.mjs",
      url: `${baseURL}/entrar`,
      reuseExistingServer: false,
      timeout: 120000,
      env: { COOPER_E2E_SECRET: secret, COOPER_DEMO: "0" },
    },
    {
      command: "node scripts/e2e-server.mjs",
      url: `${demoURL}/entrar`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        COOPER_E2E_SECRET: secret,
        COOPER_DEMO: "1",
        COOPER_E2E_PORT: process.env.COOPER_E2E_DEMO_PORT ?? "3109",
        COOPER_E2E_FIXTURE_PORT:
          process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173",
      },
    },
  ],
});
