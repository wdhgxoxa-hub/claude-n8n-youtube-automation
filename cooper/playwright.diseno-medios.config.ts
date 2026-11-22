import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./diseno-medios",
  timeout: 600000,
  retries: 0,
  use: { ...base.use, timezoneId: "America/Lima", trace: "retain-on-failure" },
  projects: [
    {
      name: "diseno-medios",
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
    ["json", { outputFile: "../evidencias-diseno/playwright.json" }],
  ],
});
