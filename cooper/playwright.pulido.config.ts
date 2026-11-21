import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  testDir: ".",
  testMatch: ["**/pulido/*.spec.ts", "**/e2e/resultados.spec.ts"],
  // La matriz secuencial y Sentinel requieren unos siete minutos por archivo.
  reportSlowTests: { max: 5, threshold: 600000 },
  timeout: 240000,
  projects: [
    {
      name: "pulido",
      use: {
        baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
        extraHTTPHeaders: {
          Referer: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
        },
      },
    },
  ],
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env.COOPER_PULIDO_REPORT || ".cache/pulido-playwright.json",
      },
    ],
  ],
});
