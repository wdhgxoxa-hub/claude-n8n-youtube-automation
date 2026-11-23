import { expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { aplicarMigraciones } from "@/db/migraciones";
import { TEMAS, TEMA_INICIAL } from "@/lib/temas";

it("lleva los temas históricos al tema inicial y conserva los ya elegidos", () => {
  mkdirSync(".cache", { recursive: true });
  const folder = mkdtempSync(".cache/temas-migracion-");
  const anterior = resolve(folder, "anterior");
  mkdirSync(resolve(anterior, "meta"), { recursive: true });
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  const entries = journal.entries.filter(
    (entry: { tag: string }) => entry.tag !== "0020_temas",
  );
  expect(entries).toHaveLength(journal.entries.length - 1);
  for (const entry of entries)
    copyFileSync(
      `drizzle/${entry.tag}.sql`,
      resolve(anterior, `${entry.tag}.sql`),
    );
  writeFileSync(
    resolve(anterior, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  const sqlite = new Database(resolve(folder, "migracion.sqlite"));
  try {
    sqlite.pragma("foreign_keys = ON");
    aplicarMigraciones(sqlite, anterior);
    const alta = sqlite.prepare(
      "INSERT INTO users(id,email,name,theme) VALUES (?,?,?,?)",
    );
    for (const tema of ["oscuro", "claro", "sistema", "sala", "dia"])
      alta.run(tema, `${tema}@example.test`, tema, tema);
    // Alta sin tema: toma el DEFAULT histórico de SQL.
    sqlite
      .prepare("INSERT INTO users(id,email,name) VALUES (?,?,?)")
      .run("sin", "sin@example.test", "sin");
    aplicarMigraciones(sqlite, resolve("drizzle"));
    aplicarMigraciones(sqlite, resolve("drizzle"));
    const temas = Object.fromEntries(
      (
        sqlite.prepare("SELECT id, theme FROM users").all() as {
          id: string;
          theme: string;
        }[]
      ).map((u) => [u.id, u.theme]),
    );
    expect(temas).toEqual({
      oscuro: TEMA_INICIAL,
      claro: TEMA_INICIAL,
      sistema: TEMA_INICIAL,
      sin: TEMA_INICIAL,
      sala: "sala",
      dia: "dia",
    });
    expect(Object.values(temas).every((t) => TEMAS.includes(t as never))).toBe(
      true,
    );
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  } finally {
    sqlite.close();
  }
});
