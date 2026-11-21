import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
mkdirSync(".cache", { recursive: true });
const port = process.env.COOPER_E2E_PORT ?? "33171";
const dir = mkdtempSync(".cache/e2e-");
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  AUTH_SECRET: randomBytes(32).toString("hex"),
  AUTH_TRUST_HOST: "true",
  AUTH_URL: `http://127.0.0.1:${port}`,
  COOPER_ADMIN_EMAIL: "admin@example.test",
  COOPER_DATABASE_PATH: resolve(dir, "cooper.sqlite"),
  COOPER_FABRICA: "simulada",
  COOPER_MENSAJERIA: "simulada",
  COOPER_AVATAR: "simulada",
  COOPER_VOZ_CLONADA: "simulada",
  COOPER_VOZ_CATALOGO: "simulada",
  COOPER_TRANSCRIPCION: "simulada",
  COOPER_SIMULACION_MS: "400",
  COOPER_GASTO_ALERTA_USD: "0.5",
};
// La aplicación no recibe la credencial del emisor ni tiene ruta de ensayo.
const appEnv = { ...env };
delete appEnv.COOPER_E2E_SECRET;
delete appEnv.COOPER_TEST_MODE;
delete appEnv.COOPER_TEST_SECRET;
const fixture = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/e2e-fixtures.ts"],
  { stdio: ["ignore", "inherit", "inherit", "ipc"], env },
);
let app;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  fixture.kill("SIGTERM");
  app?.kill("SIGTERM");
  Promise.all(
    [fixture, app]
      .filter(Boolean)
      .map((child) =>
        child.exitCode !== null
          ? Promise.resolve()
          : new Promise((r) => child.once("exit", r)),
      ),
  ).then(() => process.exit(code));
}
fixture.once("message", () => {
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { stdio: "inherit", env: appEnv },
  );
  app.once("exit", (code) => stop(code ?? 1));
});
fixture.once("exit", (code) => stop(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
