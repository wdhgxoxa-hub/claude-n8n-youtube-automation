import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Una sola política de color evita el conflicto NO_COLOR / FORCE_COLOR en los hijos.
delete process.env.NO_COLOR;
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
const cli = "node_modules/@playwright/test/cli.js";
const { chromium } = require("@playwright/test");
if (!existsSync(chromium.executablePath())) {
  const install = spawnSync(process.execPath, [cli, "install", "chromium"], {
    stdio: "inherit",
    env: process.env,
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
}
// Compilar una sola vez antes de arrancar los dos servidores aislados.
const build = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit", env: process.env },
);
if (build.status !== 0) process.exit(build.status ?? 1);
const test = spawnSync(
  process.execPath,
  [cli, "test", ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env },
);
process.exit(test.status ?? 1);
