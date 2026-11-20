import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  planMigration,
  applyMigration,
  reverseMigration,
} from "../tools/migrar_dueno.mjs";
const schema = JSON.parse(
  readFileSync(
    new URL("../contratos/cooper-migracion-tablas.json", import.meta.url),
  ),
).tablas;
function fixture() {
  const tables = Object.entries(schema).map(([name, fields]) => ({
    name,
    id: name,
    columns: Object.entries(fields).map(([name, type]) => ({ name, type })),
  }));
  const data = Object.fromEntries(tables.map((t) => [t.id, []]));
  data.fab_canales = [{ id: 1, canal_id: "c" }];
  data.fab_videos = [
    { id: 1, video_id: "v", canal_id: "c", updatedAt: "2026-11-20T12:00:00Z" },
  ];
  data.fab_costos = [
    { id: 1, video_id: "v", estimado: false, paso_id: "conciliado" },
  ];
  const calls = [];
  const api = {
    url: "http://127.0.0.1:1234",
    all: async () => structuredClone(tables),
    rows: async (id) => structuredClone(data[id]),
    request: async (...args) => calls.push(args),
    update: async (id, row, patch) => {
      calls.push([id, row.id, patch]);
      const found = data[id].find((r) => r.id === row.id);
      Object.assign(found, patch);
      return [found];
    },
  };
  return { api, data, tables, calls };
}
test("planifica sin escribir y conserva costos conciliados y dueños explícitos", async () => {
  const f = fixture();
  f.data.fab_canales[0].dueno_email = "ana@example.test";
  const plan = await planMigration(f.api, "admin@example.test");
  assert.equal(f.calls.length, 0);
  assert.equal(
    plan.updates.find((u) => u.name === "fab_videos").after.dueno_email,
    "ana@example.test",
  );
  assert.deepEqual(plan.updates.find((u) => u.name === "fab_costos").after, {
    dueno_email: "ana@example.test",
  });
});
test("huérfanos y contradicciones se rechazan antes de escribir", async () => {
  const f = fixture();
  f.data.fab_videos[0].canal_id = "ausente";
  await assert.rejects(planMigration(f.api, "admin@example.test"), /huérfano/);
  f.data.fab_videos[0].canal_id = "c";
  f.data.fab_videos[0].dueno_email = "otra@example.test";
  await assert.rejects(
    planMigration(f.api, "admin@example.test"),
    /contradictorio/,
  );
  assert.equal(f.calls.length, 0);
});
test("nombres duplicados y tipos incompatibles no se migran", async () => {
  const f = fixture();
  f.tables.push(f.tables[0]);
  await assert.rejects(
    planMigration(f.api, "admin@example.test"),
    /una sola tabla/,
  );
  f.tables.pop();
  f.tables[0].columns[0].type = "number";
  await assert.rejects(
    planMigration(f.api, "admin@example.test"),
    /Tipo incompatible/,
  );
  assert.equal(f.calls.length, 0);
});
test("segunda ejecución vacía y reversa aditiva idempotente", async () => {
  const f = fixture();
  const plan = await planMigration(f.api, "admin@example.test");
  await applyMigration(f.api, plan);
  assert.equal(
    (await planMigration(f.api, "admin@example.test")).updates.length,
    0,
  );
  const n = f.calls.length;
  assert.equal(await reverseMigration(f.api, plan, true), 3);
  assert.equal(f.calls.length, n);
  assert.equal(await reverseMigration(f.api, plan, false), 3);
  assert.equal(await reverseMigration(f.api, plan, false), 0);
});
test("la reversa no pisa cambios posteriores ni otro destino", async () => {
  const f = fixture();
  const plan = await planMigration(f.api, "admin@example.test");
  await applyMigration(f.api, plan);
  f.data.fab_videos[0].dueno_email = "nuevo@example.test";
  const n = f.calls.length;
  await assert.rejects(reverseMigration(f.api, plan, false), /Dato cambiado/);
  assert.equal(f.calls.length, n);
  await assert.rejects(
    reverseMigration(f.api, { ...plan, origin: "https://otro.invalid" }, false),
    /destino/,
  );
});
test("cambio entre plan y escritura detiene la aplicación", async () => {
  const f = fixture();
  const plan = await planMigration(f.api, "admin@example.test");
  f.data.fab_canales[0].dueno_email = "nuevo@example.test";
  await assert.rejects(applyMigration(f.api, plan), /Cambio concurrente/);
  assert.equal(f.calls.length, 0);
});
test("la decisión explícita de asignar todo al administrador conserva reversa e idempotencia", async () => {
  const f = fixture();
  for (const rows of Object.values(f.data))
    for (const row of rows) row.dueno_email = "historico@example.test";
  const plan = await planMigration(f.api, "admin@example.test", {
    assignAll: true,
  });
  assert.equal(plan.updates.length, 3);
  assert(
    plan.updates.every((row) => row.after.dueno_email === "admin@example.test"),
  );
  await applyMigration(f.api, plan);
  assert.equal(
    (await planMigration(f.api, "admin@example.test", { assignAll: true }))
      .updates.length,
    0,
  );
  await reverseMigration(f.api, plan, false);
  assert.equal(f.data.fab_canales[0].dueno_email, "historico@example.test");
});
