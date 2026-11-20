import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
mkdirSync(".cache", { recursive: true });
const port = process.env.COOPER_E2E_PORT ?? "3107";
const dir = mkdtempSync(".cache/e2e-");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      AUTH_SECRET: randomBytes(32).toString("hex"),
      AUTH_TRUST_HOST: "true",
      AUTH_URL: `http://127.0.0.1:${port}`,
      COOPER_TEST_MODE: "1",
      COOPER_ADMIN_EMAIL: "admin@example.test",
      COOPER_DATABASE_PATH: resolve(dir, "cooper.sqlite"),
      COOPER_FABRICA: "simulada",
      COOPER_SIMULACION_MS: "400",
      COOPER_GASTO_ALERTA_USD: "0.5",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
