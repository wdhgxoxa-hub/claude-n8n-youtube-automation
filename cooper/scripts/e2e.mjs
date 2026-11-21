import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { comprobarInstalacion } from "./entorno-pruebas.mjs";
comprobarInstalacion();
// Una sola política de color evita el conflicto NO_COLOR / FORCE_COLOR en los hijos.
delete process.env.NO_COLOR;
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
// Cada worktree usa un puerto libre; nunca reutilizar o detener servidores ajenos.
for (const key of [
  "COOPER_E2E_PORT",
  "COOPER_E2E_DEMO_PORT",
  "COOPER_E2E_FIXTURE_PORT",
  "COOPER_E2E_DEMO_FIXTURE_PORT",
]) {
  if (process.env[key]) continue;
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  process.env[key] = String(reservation.address().port);
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
}
const cli = "node_modules/@playwright/test/cli.js";
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
