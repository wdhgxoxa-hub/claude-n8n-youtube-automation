import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  testDir: ".",
  // Cada contexto conserva video, captura y métricas propios; evita mezclar sus trazas ZIP.
  use: { ...config.use, trace: "off" },
  testMatch: ["**/movimiento/*.spec.ts"],
  timeout: 600000,
  maxFailures: 1,
  reportSlowTests: { max: 3, threshold: 600000 },
  projects: [
    {
      name: "movimiento",
      use: {
        baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`,
      },
    },
  ],
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `.cache/videos-movimiento/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}/playwright.json`,
      },
    ],
  ],
});
