import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";

const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
export default defineConfig({
  ...config,
  testMatch: "conexion-diseno.spec.ts",
  timeout: 300_000,
  use: {
    ...config.use,
    baseURL: demoURL,
    extraHTTPHeaders: { Referer: demoURL },
    video: "on",
    trace: "retain-on-failure",
    timezoneId: "America/Lima",
  },
  projects: [
    { name: "conexion-diseno", use: { ...devices["Desktop Chrome"] } },
  ],
  reporter: [
    ["list"],
    ["json", { outputFile: "../evidencias-diseno/playwright.json" }],
  ],
});
