import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./diseno-fabrica-video",
  timeout: 240000,
  workers: 1,
  retries: 0,
  outputDir: "../evidencias-diseno/fabrica-video-recorridos",
  use: { ...base.use, timezoneId: "America/Lima", trace: "retain-on-failure" },
  projects: [
    {
      name: "fabrica-video",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: [
            "--enable-gpu",
            "--use-gl=angle",
            existsSync("/dev/dri/renderD128")
              ? "--use-angle=gl-egl"
              : "--use-angle=swiftshader",
          ],
        },
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
      { outputFile: "../evidencias-diseno/fabrica-video-playwright.json" },
    ],
  ],
});
