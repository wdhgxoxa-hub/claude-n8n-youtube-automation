import { defineConfig } from "@playwright/test";
import config from "./playwright.integracion3.config";

const ronda = process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico";
const salida =
  process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-total-sentinel";
const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;

export default defineConfig({
  ...config,
  outputDir: `${salida}/${ronda}/pruebas`,
  use: { ...config.use, video: "on" },
  projects: [
    ...config.projects!,
    {
      name: "estres-movil",
      testDir: "./pulido",
      testMatch: "estres.spec.ts",
      timeout: 120000,
      use: {
        baseURL: demoURL,
        extraHTTPHeaders: { Referer: demoURL },
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  reporter: [
    ["list"],
    ["json", { outputFile: `${salida}/${ronda}/playwright.json` }],
    ["html", { open: "never", outputFolder: `${salida}/${ronda}/reporte` }],
  ],
});
