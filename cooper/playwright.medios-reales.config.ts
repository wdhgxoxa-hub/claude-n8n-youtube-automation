import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Ensayo manual: no forma parte de e2e/ ni de la matriz global de diseño.
export default defineConfig({
  ...base,
  testDir: "./diseno-medios-reales",
  timeout: 180000,
  retries: 0,
  workers: 1,
  outputDir: "../evidencias-diseno/medios-reales-playwright",
  use: {
    ...base.use,
    timezoneId: "America/Lima",
    video: "on",
    trace: "on",
    serviceWorkers: "block",
  },
  projects: [390, 1440].map((width) => ({
    name: `medios-reales-${width}`,
    use: {
      browserName: "chromium" as const,
      viewport: { width, height: 900 },
      video: { mode: "on" as const, size: { width, height: 900 } },
    },
  })),
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "../evidencias-diseno/medios-reales-playwright.json" },
    ],
  ],
});
