import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";

const baseURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;

export default defineConfig({
  ...config,
  testDir: "./e2e-diseno",
  testMatch: "fluidez-marcas-resto.spec.ts",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../evidencias-diseno/fluidez-cooper-recorridos",
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "../evidencias-diseno/fluidez-cooper-playwright.json" },
    ],
  ],
  use: {
    ...config.use,
    video: "off",
    trace: "off",
    screenshot: "off",
    timezoneId: "America/Lima",
    reducedMotion: "no-preference",
  },
  projects: [
    {
      name: "fluidez-cooper",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        extraHTTPHeaders: { Referer: baseURL },
        // El mismo compositor de la prueba base; es software, no GPU física.
        launchOptions: {
          args: ["--enable-gpu", "--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
  ],
});
