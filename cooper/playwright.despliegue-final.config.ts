import { defineConfig } from "@playwright/test";
import base from "./playwright.base-diseno.config";

// Movimiento en ejecución real (despliegue final). Reutiliza los dos servidores
// aislados de la puerta común y el lanzamiento con GPU de base-diseno; el
// servidor de demostración es el que reciben los navegadores.
const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
const launchOptions = base.projects?.[0]?.use?.launchOptions;
const comun = {
  browserName: "chromium" as const,
  launchOptions,
  baseURL: demoURL,
  extraHTTPHeaders: { Referer: demoURL },
  timezoneId: "America/Lima",
  deviceScaleFactor: 1,
};

export default defineConfig({
  ...base,
  testDir: "./despliegue-final",
  testMatch: "movimiento.spec.ts",
  timeout: 300000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../evidencias-diseno/despliegue-final/salida-playwright",
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "../evidencias-diseno/despliegue-final/playwright.json" },
    ],
  ],
  use: {
    ...base.use,
    video: "on",
    trace: "off",
    timezoneId: "America/Lima",
  },
  projects: [
    {
      name: "movimiento-1440",
      // La barra inferior solo existe por debajo de 1024 px.
      grepInvert: /Barra inferior móvil/,
      use: {
        ...comun,
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: "movimiento-390",
      use: {
        ...comun,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
