// Solo genera una base nueva con datos ficticios. No acepta rutas de bases reales,
// no carga .env ni importa db() de producción. Ejecutar desde cooper/.
import Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { cpus, platform } from "node:os";

const destination = resolve(".cache/rendimiento/sqlite");
mkdirSync(destination, { recursive: true });
const run = mkdtempSync(`${destination}/ensayo-`);
const sqlite = new Database(`${run}/sintetica.sqlite`);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const migrations = readMigrationFiles({ migrationsFolder: resolve("drizzle") });
const indexMigration = 1795176018000;
const counts = {
  owners: 10,
  messages: 80000,
  events: 120000,
  expenses: 120000,
  brands: 100,
  accounts: 500,
  pieces: 24000,
};
const now = Date.UTC(2026, 10, 21, 12);
// Mismo límite de Lima y exclusión de fechas futuras del servicio integrado.
const day = Date.UTC(2026, 10, 21, 5);
const week = Date.UTC(2026, 10, 16, 5);
const month = Date.UTC(2026, 10, 1, 5);
const samples = 60;
const warmup = 5;
const stamp = (i) => now - i * 1000;
const id = (prefix, i) => `${prefix}-${String(i).padStart(7, "0")}`;
function migrate(selected) {
  sqlite.transaction(() => {
    for (const migration of selected)
      for (const statement of migration.sql) sqlite.exec(statement);
  })();
}
function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function measure(query) {
  const stmt = sqlite.prepare(query.sql);
  const execute = () =>
    query.transform
      ? query.transform(stmt.all(...query.params))
      : stmt.all(...query.params);
  for (let i = 0; i < warmup; i++) execute();
  const times = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    execute();
    times.push(performance.now() - start);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const result = execute();
  return {
    sql: query.sql,
    params: query.params,
    plan: sqlite
      .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(...query.params),
    p50Ms: sorted[Math.floor(samples * 0.5)],
    p95Ms: sorted[Math.ceil(samples * 0.95) - 1],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    samplesMs: times,
    rowsReturned: result.length,
    resultSha256: digest(result),
  };
}
const owner = id("usuario", 1);
const marca = id("marca", 1);
const oldExpenses = (rows) =>
  Array.from({ length: counts.owners }, (_, n) => {
    const ownerId = id("usuario", n);
    const own = rows.filter((r) => r.owner_id === ownerId);
    const sum = (since) =>
      Math.round(
        own
          .filter((r) => r.created_at >= since && r.created_at <= now)
          .reduce((total, r) => total + r.amount, 0) * 100,
      ) / 100;
    return { ownerId, day: sum(day), week: sum(week), month: sum(month) };
  });
const newExpenses = (rows) =>
  Array.from({ length: counts.owners }, (_, n) => {
    const ownerId = id("usuario", n),
      row = rows.find((r) => r.ownerId === ownerId);
    const round = (amount = 0) => Math.round(amount * 100) / 100;
    return {
      ownerId,
      day: round(row?.day),
      week: round(row?.week),
      month: round(row?.month),
    };
  });
const queries = [
  {
    name: "ultimos_mensajes",
    source: "src/servicios/datos.ts:estado",
    sql: "SELECT * FROM messages WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100",
    params: [owner],
  },
  {
    name: "sse_dueno",
    source: "src/app/api/eventos/route.ts",
    sql: "SELECT * FROM events WHERE type = ? AND owner_id = ? AND created_at > ? ORDER BY created_at, id LIMIT 100",
    params: ["progreso", owner, now - 10000],
  },
  {
    name: "sse_admin",
    source: "src/app/api/eventos/route.ts",
    sql: "SELECT * FROM events WHERE type = ? AND created_at > ? ORDER BY created_at, id LIMIT 100",
    params: ["progreso", now - 10000],
  },
  {
    name: "operacion_dueno",
    source: "src/servicios/operacion.ts:propios",
    sql: "SELECT * FROM events WHERE type = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 500",
    params: ["operacion_canal", owner],
  },
  {
    name: "cuentas_marca",
    source: "src/servicios/marcas/servicio.ts:estadoMarcas",
    sql: "SELECT * FROM cuentas_marca WHERE marca_id = ?",
    params: [marca],
  },
  {
    name: "piezas_marca",
    source: "src/servicios/marcas/servicio.ts:estadoMarcas",
    sql: "SELECT * FROM piezas_marca WHERE marca_id = ?",
    params: [marca],
    transform: (rows) => rows.sort((a, b) => a.programada - b.programada),
    after: {
      sql: "SELECT * FROM piezas_marca WHERE marca_id = ? ORDER BY programada",
      params: [marca],
    },
  },
  {
    name: "gastos_admin",
    source: "src/servicios/datos.ts:administracion",
    sql: "SELECT * FROM expenses",
    params: [],
    transform: oldExpenses,
    after: {
      sql: "SELECT owner_id AS ownerId, sum(case when created_at >= ? then amount else 0 end) AS day, sum(case when created_at >= ? then amount else 0 end) AS week, sum(case when created_at >= ? then amount else 0 end) AS month FROM expenses WHERE created_at >= ? AND created_at <= ? GROUP BY owner_id",
      params: [day, week, month, Math.min(week, month), now],
      transform: newExpenses,
    },
  },
];
try {
  migrate(migrations.filter((m) => m.folderMillis < indexMigration));
  sqlite.transaction(() => {
    const user = sqlite.prepare(
      "INSERT INTO users(id,email,name) VALUES (?,?,?)",
    );
    const message = sqlite.prepare(
      "INSERT INTO messages(id,owner_id,role,content,created_at) VALUES (?,?,?,?,?)",
    );
    const event = sqlite.prepare(
      "INSERT INTO events(id,owner_id,type,payload,created_at) VALUES (?,?,?,?,?)",
    );
    const expense = sqlite.prepare(
      "INSERT INTO expenses(id,owner_id,amount,concept,created_at) VALUES (?,?,?,?,?)",
    );
    const brand = sqlite.prepare(
      "INSERT INTO marcas(id,owner_id,nombre,rubro,zona,guia,created_at) VALUES (?,?,?,'general','America/Lima','{}',?)",
    );
    const account = sqlite.prepare(
      "INSERT INTO cuentas_marca(id,marca_id,red,alias,remoto) VALUES (?,?,'instagram',?,?)",
    );
    const piece = sqlite.prepare(
      "INSERT INTO piezas_marca(id,marca_id,cuenta_id,datos,guia,programada,created_at,updated_at) VALUES (?,?,?,'{}','{}',?,?,?)",
    );
    for (let i = 0; i < counts.owners; i++)
      user.run(id("usuario", i), `sintetico-${i}@example.test`, `Ensayo ${i}`);
    for (let i = 0; i < counts.messages; i++)
      message.run(
        id("mensaje", i),
        id("usuario", i % counts.owners),
        i % 2 ? "assistant" : "user",
        `Conversación ficticia ${i}. `.repeat(8),
        stamp(i),
      );
    for (let i = 0; i < counts.events; i++)
      event.run(
        id("evento", i),
        id("usuario", i % counts.owners),
        i % 3 ? "progreso" : "operacion_canal",
        JSON.stringify({ simulada: true, paso: i }),
        stamp(i),
      );
    for (let i = 0; i < counts.expenses; i++)
      expense.run(
        id("gasto", i),
        id("usuario", i % counts.owners),
        ((i % 100) + 1) / 100,
        "Gasto ficticio",
        now - (i % 365) * 86400000 - i,
      );
    for (let i = 0; i < counts.brands; i++)
      brand.run(
        id("marca", i),
        id("usuario", i % counts.owners),
        `Marca ficticia ${i}`,
        stamp(i),
      );
    for (let i = 0; i < counts.accounts; i++)
      account.run(
        id("cuenta", i),
        id("marca", i % counts.brands),
        `cuenta-ficticia-${i}`,
        `remoto-ficticio-${i}`,
      );
    for (let i = 0; i < counts.pieces; i++)
      piece.run(
        id("pieza", i),
        id("marca", i % counts.brands),
        id("cuenta", i % counts.accounts),
        stamp(i),
        stamp(i),
        stamp(i),
      );
  })();
  const beforeBytes =
    sqlite.pragma("page_count", { simple: true }) *
    sqlite.pragma("page_size", { simple: true });
  const before = Object.fromEntries(
    queries.map((query) => [query.name, measure(query)]),
  );
  const start = performance.now();
  migrate(migrations.filter((m) => m.folderMillis >= indexMigration));
  const createIndexesMs = performance.now() - start;
  const optimizeStart = performance.now();
  sqlite.pragma("optimize = 0x10002");
  const firstOptimizeMs = performance.now() - optimizeStart;
  const migrationMs = performance.now() - start;
  const after = Object.fromEntries(
    queries.map((query) => [query.name, measure(query.after ?? query)]),
  );
  const afterBytes =
    sqlite.pragma("page_count", { simple: true }) *
    sqlite.pragma("page_size", { simple: true });
  // Apertura posterior: conexión nueva al MISMO archivo sintético con estadísticas
  // ya pobladas. No incluye la lectura/comprobación del diario de migraciones.
  const openingStart = performance.now();
  const reopened = new Database(`${run}/sintetica.sqlite`);
  let repeatedOptimizeMs;
  try {
    reopened.pragma("journal_mode = WAL");
    reopened.pragma("foreign_keys = ON");
    reopened.pragma("busy_timeout = 5000");
    const repeatedStart = performance.now();
    reopened.pragma("optimize = 0x10002");
    repeatedOptimizeMs = performance.now() - repeatedStart;
  } finally {
    reopened.close();
  }
  const reopenSetupMs = performance.now() - openingStart;
  const comparison = queries.map(({ name, source }) => ({
    name,
    source,
    beforeP50Ms: before[name].p50Ms,
    afterP50Ms: after[name].p50Ms,
    beforeP95Ms: before[name].p95Ms,
    afterP95Ms: after[name].p95Ms,
    speedupP50: before[name].p50Ms / after[name].p50Ms,
    sameResults: before[name].resultSha256 === after[name].resultSha256,
  }));
  const report = {
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      sqlite: sqlite.prepare("SELECT sqlite_version() AS version").get()
        .version,
      platform: platform(),
      cpu: cpus()[0]?.model,
    },
    methodology: {
      database:
        "Archivo nuevo, WAL y foreign_keys activos; solo datos ficticios. Caché caliente, ejecución secuencial, no benchmark de red/VPS ni telemetría real.",
      warmup,
      samples,
      counts,
      beforeBytes,
      afterBytes,
      migrationMs,
      createIndexesMs,
      firstOptimizeMs,
      repeatedOptimizeMs,
      reopenSetupMs,
      openingNote:
        "Una muestra de apertura nueva con estadísticas calientes y pragmas de producción. Excluye lectura/verificación del diario; la primera optimización se mide aparte tras crear índices. No mide reinicio frío de disco ni bloqueo entre procesos.",
      dateForPeriods: new Date(now).toISOString(),
      querySources:
        "SQL equivalente a las lecturas indicadas; gastos antes incluye filtrado/agregación JS; piezas antes incluye sort JS.",
    },
    comparison,
    before,
    after,
    checks: {
      integrity: sqlite.pragma("integrity_check", { simple: true }),
      foreignKeys: sqlite.pragma("foreign_key_check"),
    },
  };
  writeFileSync(`${run}/resultado.json`, JSON.stringify(report, null, 2));
  writeFileSync(
    `${destination}/resultado.json`,
    JSON.stringify(report, null, 2),
  );
  console.table(
    comparison.map((row) => ({
      consulta: row.name,
      "antes p50 ms": row.beforeP50Ms.toFixed(3),
      "después p50 ms": row.afterP50Ms.toFixed(3),
      "antes p95 ms": row.beforeP95Ms.toFixed(3),
      "después p95 ms": row.afterP95Ms.toFixed(3),
      "mejora ×": row.speedupP50.toFixed(1),
      iguales: row.sameResults,
    })),
  );
  console.log(`Evidencia: ${run}/resultado.json`);
  if (
    comparison.some((row) => !row.sameResults) ||
    report.checks.integrity !== "ok" ||
    report.checks.foreignKeys.length
  )
    process.exitCode = 1;
} finally {
  sqlite.close();
}
