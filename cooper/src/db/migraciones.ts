import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
// Conserva SQL y diario de Drizzle; toma el bloqueo ANTES de leer el diario.
export function aplicarMigraciones(sqlite: Database.Database, folder: string) {
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  sqlite
    .transaction(() => {
      sqlite.exec(
        "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
      );
      const applied = sqlite
        .prepare(
          "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
        )
        .all() as { hash: string; created_at: number }[];
      for (const row of applied) {
        const source = migrations.find(
          (m) => m.folderMillis === row.created_at,
        );
        if (!source || source.hash !== row.hash)
          throw new Error(
            "El historial de migraciones no coincide con el código. Restaura la versión correspondiente.",
          );
      }
      for (const migration of migrations) {
        if (applied.some((row) => row.created_at === migration.folderMillis))
          continue;
        for (const statement of migration.sql) sqlite.exec(statement);
        sqlite
          .prepare(
            "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
          )
          .run(migration.hash, migration.folderMillis);
      }
    })
    .immediate();
}
