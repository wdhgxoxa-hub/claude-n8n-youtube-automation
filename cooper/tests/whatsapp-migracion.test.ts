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

it("actualiza las catorce migraciones integradas sin perder contactos ni envíos y persiste conversaciones", () => {
  const folder = mkdtempSync(".cache/whatsapp-migracion-");
  const anterior = resolve(folder, "anterior");
  mkdirSync(resolve(anterior, "meta"), { recursive: true });
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  const entries = journal.entries.filter(
    (entry: { idx: number }) => entry.idx < 14,
  );
  for (const entry of entries)
    copyFileSync(
      `drizzle/${entry.tag}.sql`,
      resolve(anterior, `${entry.tag}.sql`),
    );
  writeFileSync(
    resolve(anterior, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  const path = resolve(folder, "migracion.sqlite");
  const sqlite = new Database(path);
  try {
    sqlite.pragma("foreign_keys = ON");
    aplicarMigraciones(sqlite, anterior);
    sqlite.exec(`INSERT INTO users(id,email,name) VALUES ('propio','migracion@example.test','Prueba');
      INSERT INTO whatsapp_contacts(owner_id,phone,verified_at) VALUES ('propio','+15555550100',1);
      INSERT INTO whatsapp_outbox(id,dedupe_key,owner_id,phone,kind,next_at,expires_at,created_at)
      VALUES ('aviso','aviso','propio','+15555550100','guion',1,2,1);`);
    aplicarMigraciones(sqlite, resolve("drizzle"));
    aplicarMigraciones(sqlite, resolve("drizzle"));
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get(),
    ).toEqual({ n: journal.entries.length });
    expect(
      sqlite.prepare("SELECT verified_at FROM whatsapp_contacts").get(),
    ).toEqual({ verified_at: 1 });
    expect(sqlite.prepare("SELECT id FROM whatsapp_outbox").get()).toEqual({
      id: "aviso",
    });
    const insertar = sqlite.prepare(`INSERT INTO whatsapp_chat_jobs
      (id,owner_id,phone,text,contact_verified_at,simulated,next_at,created_at)
      VALUES (?, 'propio', '+15555550100', 'Hola', 1, 1, 2, 2)`);
    insertar.run("wamid.simulado");
    expect(() => insertar.run("wamid.simulado")).toThrow("UNIQUE");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  } finally {
    sqlite.close();
  }
  const reopened = new Database(path);
  try {
    expect(
      reopened
        .prepare("SELECT id, state, attempts FROM whatsapp_chat_jobs")
        .get(),
    ).toEqual({
      id: "wamid.simulado",
      state: "pendiente",
      attempts: 0,
    });
  } finally {
    reopened.close();
  }
});
