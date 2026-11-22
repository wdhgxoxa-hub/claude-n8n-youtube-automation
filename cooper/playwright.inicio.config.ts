import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.base-diseno.config";

// Mismo servidor y emisor aislados que la puerta común; sin OAuth ni n8n.
export default defineConfig({
  ...config,
  testDir: "./e2e",
  testMatch: "inicio-diseno.spec.ts",
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../evidencias-diseno/inicio-recorridos",
  reporter: [
    ["list"],
    ["json", { outputFile: "../evidencias-diseno/inicio-playwright.json" }],
    [
      "html",
      { outputFolder: "../evidencias-diseno/inicio-informe", open: "never" },
    ],
  ],
  use: {
    ...config.use,
    video: "off",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: "off",
    timezoneId: "America/Lima",
  },
  projects: [
    {
      name: "inicio-diseno",
      use: {
        ...devices["Desktop Chrome"],
        // La base elige DRM/EGL si está disponible y SwiftShader si no lo está.
        launchOptions: config.projects?.[0]?.use?.launchOptions,
        baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
        extraHTTPHeaders: {
          Referer: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
        },
      },
    },
  ],
});
