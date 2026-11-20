import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(".cache", { recursive: true });
process.env.COOPER_DATABASE_PATH = resolve(
  mkdtempSync(".cache/unit-"),
  "cooper.sqlite",
);
process.env.COOPER_ADMIN_EMAIL = "admin@example.test";
process.env.COOPER_FABRICA = "simulada";
process.env.COOPER_SIMULACION_MS = "200";
