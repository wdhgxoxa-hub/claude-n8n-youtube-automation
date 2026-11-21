import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
export default defineConfig({
  ...config,
  testDir: ".",
  retries: 0,
  maxFailures: 1,
  reportSlowTests: { max: 3, threshold: 600000 },
  projects: [
    ...config.projects!.map((project) => ({ ...project, testDir: "./e2e" })),
    {
      name: "movimiento-integrado",
      testDir: "./movimiento",
      timeout: 600000,
      use: {
        baseURL: demoURL,
        extraHTTPHeaders: { Referer: demoURL },
        trace: "off",
      },
    },
    {
      name: "estres-integrado",
      testDir: "./pulido",
      testMatch: "estres.spec.ts",
      timeout: 120000,
      use: { baseURL: demoURL, extraHTTPHeaders: { Referer: demoURL } },
    },
    {
      name: "recorrido-integrado",
      testDir: "./integracion3",
      timeout: 240000,
      use: {
        baseURL: demoURL,
        extraHTTPHeaders: { Referer: demoURL },
        trace: "off",
      },
    },
  ],
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `.cache/videos-integracion3/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}/playwright.json`,
      },
    ],
  ],
});
