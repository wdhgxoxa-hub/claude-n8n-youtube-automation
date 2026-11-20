import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { aplicarMigraciones } from "./migraciones";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";
import { rutaBase } from "@/lib/demo";
function connect() {
  // La base es un archivo de ejecución, no un recurso que deba incluirse en el bundle.
  const path = resolve(
    /* turbopackIgnore: true */ rutaBase(
      process.env.COOPER_DATABASE_PATH ?? "./data/cooper.sqlite",
      process.env.COOPER_DEMO === "1",
    ),
  );
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const database = drizzle(sqlite, { schema });
  try {
    aplicarMigraciones(sqlite, resolve("drizzle"));
  } catch (error) {
    sqlite.close();
    throw error;
  }
  return database;
}
type Db = ReturnType<typeof connect>;
const globals = globalThis as typeof globalThis & { cooperDb?: Db };
export function db(): Db {
  return (globals.cooperDb ??= connect());
}
