import { expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
const entries = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf8"),
).entries;
// Se fuerza el intercalado: otro proceso aplica las migraciones después de leer
// el diario y antes de iniciar la transacción. No depende del planificador.
it("R07 serializa la lectura del diario y la aplicación de migraciones", async () => {
  const path = resolve(mkdtempSync(".cache/migracion-"), "cooper.sqlite");
  vi.stubEnv("COOPER_DATABASE_PATH", path);
  const original = Database.prototype.prepare;
  let raced = false;
  const second = new Database(path, { timeout: 0 });
  const spy = vi
    .spyOn(Database.prototype, "prepare")
    .mockImplementation(function (this: Database.Database, sql: string) {
      const statement = original.call(this, sql);
      if (
        /FROM [\"`]?__drizzle_migrations.*ORDER BY created_at/.test(sql) &&
        !raced
      ) {
        const all = statement.all.bind(statement) as (
          ...params: unknown[]
        ) => unknown[];
        statement.all = (...params: unknown[]) => {
          const rows = all(...params);
          raced = true;
          if (this.inTransaction) {
            expect(() => second.exec("BEGIN IMMEDIATE")).toThrow("locked");
          } else {
            migrate(drizzle(second), { migrationsFolder: resolve("drizzle") });
          }
          return rows;
        };
      }
      return statement;
    });
  try {
    const { db } = await import("@/db");
    expect(() => db()).not.toThrow();
    expect(raced).toBe(true);
    expect(
      second.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get(),
    ).toEqual({ n: entries.length });
  } finally {
    spy.mockRestore();
    second.close();
    vi.unstubAllEnvs();
  }
});
it("R07 preserva datos al actualizar, repite sin duplicar y revierte SQL fallido", async () => {
  const { aplicarMigraciones } = await import("@/db/migraciones");
  const { writeFileSync, mkdirSync, copyFileSync } = await import("node:fs");
  const folder = mkdtempSync(".cache/sql-");
  mkdirSync(`${folder}/meta`);
  copyFileSync("drizzle/0000_inicio.sql", `${folder}/0000_inicio.sql`);
  const entry = {
    idx: 0,
    version: "6",
    when: 1795176000000,
    tag: "0000_inicio",
    breakpoints: true,
  };
  writeFileSync(
    `${folder}/meta/_journal.json`,
    JSON.stringify({ entries: [entry] }),
  );
  const sqlite = new Database(":memory:");
  try {
    aplicarMigraciones(sqlite, folder);
    sqlite
      .prepare(
        "INSERT INTO users(id,email,name) VALUES ('ficticio','migracion@example.test','Ensayo')",
      )
      .run();
    aplicarMigraciones(sqlite, resolve("drizzle"));
    aplicarMigraciones(sqlite, resolve("drizzle"));
    expect(sqlite.prepare("SELECT name FROM users").get()).toEqual({
      name: "Ensayo",
    });
    expect(sqlite.prepare("PRAGMA table_info(videos)").all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "avatar_id" })]),
    );
    for (const migration of entries)
      copyFileSync(
        `drizzle/${migration.tag}.sql`,
        `${folder}/${migration.tag}.sql`,
      );
    writeFileSync(
      `${folder}/fallida.sql`,
      "CREATE TABLE temporal(id TEXT);\n--> statement-breakpoint\nSQL INVALIDO;",
    );
    writeFileSync(
      `${folder}/meta/_journal.json`,
      JSON.stringify({
        entries: [
          ...entries,
          { ...entry, when: entries.at(-1).when + 1000, tag: "fallida" },
        ],
      }),
    );
    expect(() => aplicarMigraciones(sqlite, folder)).toThrow();
    expect(
      sqlite
        .prepare("SELECT name FROM sqlite_master WHERE name='temporal'")
        .get(),
    ).toBeUndefined();
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get(),
    ).toEqual({ n: entries.length });
    sqlite.prepare("UPDATE __drizzle_migrations SET hash='alterado'").run();
    expect(() => aplicarMigraciones(sqlite, resolve("drizzle"))).toThrow(
      "historial",
    );
  } finally {
    sqlite.close();
  }
});
