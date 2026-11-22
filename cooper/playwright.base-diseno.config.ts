import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";

const browser = {
  ...devices["Desktop Chrome"],
  baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
  extraHTTPHeaders: {
    Referer: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
  },
};

export default defineConfig({
  ...config,
  testDir: "./e2e",
  testMatch: "base-diseno.spec.ts",
  timeout: 600000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../evidencias-diseno/recorridos",
  reporter: [
    ["list"],
    ["json", { outputFile: "../evidencias-diseno/playwright.json" }],
    ["html", { outputFolder: "../evidencias-diseno/informe", open: "never" }],
  ],
  use: {
    ...config.use,
    video: "on",
    trace: "retain-on-failure",
    timezoneId: "America/Lima",
  },
  projects: [
    {
      name: "base-diseno",
      grepInvert: /Movimiento: medicion/,
      use: {
        ...browser,
        trace: "off",
      },
    },
    {
      name: "base-diseno-medicion",
      grep: /Movimiento: medicion/,
      use: {
        ...browser,
        video: "off",
        trace: "off",
      },
    },
  ],
});
