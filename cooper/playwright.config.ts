import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
const baseURL = `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "3107"}`;
const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
const secret = process.env.COOPER_E2E_SECRET ?? randomBytes(32).toString("hex");
process.env.COOPER_E2E_SECRET = secret;
// Firefox y WebKit: 390 y 1440 en la puerta; las rondas piden la matriz entera
// con COOPER_ANCHOS_MOTORES=360,390,768,1024,1440,1920.
const anchosMotores = (process.env.COOPER_ANCHOS_MOTORES ?? "390,1440")
  .split(",")
  .map(Number);
if (!anchosMotores.every((w) => Number.isInteger(w) && w >= 320 && w <= 2560))
  throw new Error("COOPER_ANCHOS_MOTORES no válido.");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter:
    process.env.COOPER_CI_REPORTES === "1"
      ? [
          ["list"],
          ["html", { open: "never" }],
          ["json", { outputFile: ".cache/puerta/playwright.json" }],
        ]
      : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // Las llamadas API del ensayo deben cumplir el mismo control CSRF que el navegador.
    extraHTTPHeaders: { Referer: baseURL },
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    permissions: ["microphone"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.COOPER_E2E_VIDEO === "1" ? "on" : "off",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [
        "base-diseno.spec.ts",
        "inicio-diseno.spec.ts",
        "multiengine.spec.ts",
        "accesibilidad.spec.ts",
        "diseno.spec.ts",
        "conexion-diseno.spec.ts",
        "animacion.spec.ts",
        "resultados.spec.ts",
        "operacion.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "demostracion",
      testMatch: [
        "accesibilidad.spec.ts",
        "diseno.spec.ts",
        "animacion.spec.ts",
        "resultados.spec.ts",
        "operacion.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: demoURL,
        extraHTTPHeaders: { Referer: demoURL },
      },
    },
    ...(["firefox", "webkit"] as const).flatMap((browserName) =>
      (["oscuro"] as const).flatMap((theme) =>
        anchosMotores.map((width) => ({
          name: `${browserName}-${theme}-${width}`,
          testMatch: "multiengine.spec.ts",
          metadata: { theme },
          use: {
            browserName,
            permissions: [],
            launchOptions: {
              args: [],
              firefoxUserPrefs: {
                "media.navigator.streams.fake": true,
                "media.navigator.permission.disabled": true,
              },
            },
            viewport: { width, height: 900 },
            // Viewport adaptable: no representa un iPhone ni Firefox móvil real.
            baseURL: demoURL,
            extraHTTPHeaders: { Referer: demoURL },
          },
        })),
      ),
    ),
  ],
  webServer: [
    {
      command: "node scripts/e2e-server.mjs",
      url: `${baseURL}/entrar`,
      reuseExistingServer: false,
      timeout: 120000,
      env: { COOPER_E2E_SECRET: secret, COOPER_DEMO: "0" },
    },
    {
      command: "node scripts/e2e-server.mjs",
      url: `${demoURL}/entrar`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        COOPER_E2E_SECRET: secret,
        COOPER_DEMO: "1",
        COOPER_E2E_PORT: process.env.COOPER_E2E_DEMO_PORT ?? "3109",
        COOPER_E2E_FIXTURE_PORT:
          process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173",
      },
    },
  ],
});
