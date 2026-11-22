import { expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { aplicarMigraciones } from "@/db/migraciones";

it("migra desde las 14 originales hasta el diario integrado conservando videos y observabilidad; reejecutar no duplica ni genera medios", () => {
  const directory = mkdtempSync(".cache/migracion-video-medios-");
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  try {
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    );
    const entries = journal.entries.slice(0, 14);
    mkdirSync(join(directory, "meta"));
    writeFileSync(
      join(directory, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries }),
    );
    for (const migration of entries)
      copyFileSync(
        `drizzle/${migration.tag}.sql`,
        join(directory, `${migration.tag}.sql`),
      );
    aplicarMigraciones(sqlite, directory);
    sqlite.exec(
      "INSERT INTO users(id,email,name) VALUES('ana','ana@example.test','Ana'); INSERT INTO channels(id,owner_id,name,niche,created_at) VALUES('canal','ana','Canal','Ciencia',1); INSERT INTO videos(id,owner_id,channel_id,title,script,created_at,updated_at,observability) VALUES('video','ana','canal','Historia','Guion',1,1,'{\"montaje\":\"https://cdn.creatomate.com/renders/original.mp4\"}');",
    );
    const anterior = sqlite.prepare("SELECT * FROM videos").get();
    aplicarMigraciones(sqlite, resolve("drizzle"));
    aplicarMigraciones(sqlite, resolve("drizzle"));
    expect(sqlite.prepare("SELECT * FROM videos").get()).toEqual(anterior);
    expect(
      sqlite.prepare("SELECT count(*) n FROM __drizzle_migrations").get(),
    ).toEqual({ n: journal.entries.length });
    expect(sqlite.prepare("SELECT count(*) n FROM video_medios").get()).toEqual(
      { n: 0 },
    );
    const insert = sqlite.prepare(
      "INSERT INTO video_medios(clave,video_id,revision,estado,tinte,actualizado_en,preview_bytes,preview_duracion) VALUES('cache','video','rev','listo','hsl(0 30% 52%)',1,?,?)",
    );
    expect(() => insert.run(600001, 5)).toThrow();
    expect(() => insert.run(1000, 7)).toThrow();
    insert.run(600000, 5);
    sqlite.prepare("DELETE FROM videos WHERE id='video'").run();
    expect(sqlite.prepare("SELECT count(*) n FROM video_medios").get()).toEqual(
      { n: 0 },
    );
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
