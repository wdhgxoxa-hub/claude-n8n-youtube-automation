import { beforeEach, vi } from "vitest";
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(".cache", { recursive: true });
process.env.COOPER_DATABASE_PATH = resolve(
  mkdtempSync(".cache/unit-"),
  "cooper.sqlite",
);
process.env.COOPER_ADMIN_EMAIL = "admin@example.test";
process.env.COOPER_FABRICA = "simulada";
process.env.COOPER_CHAT = "simulada";
process.env.COOPER_SIMULACION_MS = "200";

for (const name of [
  "COOPER_AVATAR",
  "COOPER_VOZ_CLONADA",
  "COOPER_VOZ_CATALOGO",
  "COOPER_TRANSCRIPCION",
])
  process.env[name] = "simulada";

// Toda salida de red debe estar reemplazada expresamente por el transporte del caso.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Red bloqueada en pruebas");
    }),
  );
});
