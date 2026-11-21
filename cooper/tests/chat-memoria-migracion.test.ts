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

it("actualiza la base anterior conservando mensajes y no atribuye canales desconocidos", () => {
  const anterior = mkdtempSync(".cache/memoria-migracion-");
  mkdirSync(`${anterior}/meta`);
  const diario = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  diario.entries = diario.entries.filter(
    (e: { tag: string }) => e.tag !== "0009_memoria",
  );
  for (const e of diario.entries)
    copyFileSync(`drizzle/${e.tag}.sql`, `${anterior}/${e.tag}.sql`);
  writeFileSync(`${anterior}/meta/_journal.json`, JSON.stringify(diario));
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  try {
    aplicarMigraciones(sqlite, anterior);
    sqlite.exec(
      "INSERT INTO users(id,email,name) VALUES ('ana','ana@example.test','Ana'); INSERT INTO messages(id,owner_id,role,content,created_at) VALUES ('previo','ana','user','Conversación anterior',1); INSERT INTO chat_sessions(owner_id) VALUES ('ana');",
    );
    aplicarMigraciones(sqlite, resolve("drizzle"));
    aplicarMigraciones(sqlite, resolve("drizzle"));
    expect(
      sqlite.prepare("SELECT content,channel_id FROM messages").get(),
    ).toEqual({ content: "Conversación anterior", channel_id: "" });
    expect(
      sqlite.prepare("SELECT memory_after FROM chat_sessions").get(),
    ).toEqual({ memory_after: 0 });
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM chat_memories").get(),
    ).toEqual({ n: 0 });
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO chat_memories(owner_id,scope,summary,updated_at) VALUES ('ana','falso','{}',1)",
        )
        .run(),
    ).toThrow();
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  } finally {
    sqlite.close();
  }
});
