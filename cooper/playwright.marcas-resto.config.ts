import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";
const baseURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
export default defineConfig({
  ...config,
  testDir: "./e2e-diseno",
  testMatch: "marcas-resto.spec.ts",
  timeout: 600000,
  workers: 1,
  retries: 0,
  outputDir: "../evidencias-diseno/recorridos-marcas-resto",
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "../evidencias-diseno/marcas-resto-playwright.json" },
    ],
  ],
  use: {
    ...config.use,
    video: "on",
    trace: "retain-on-failure",
    timezoneId: "America/Lima",
  },
  projects: [
    {
      name: "marcas-resto",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        extraHTTPHeaders: { Referer: baseURL },
      },
    },
  ],
});
