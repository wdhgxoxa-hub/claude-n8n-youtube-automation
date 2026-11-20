#!/usr/bin/env node
// Nunca carga .env. La clave REST se suministra en N8N_API_KEY, fuera de Git.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { N8nApi } from "./cooper/n8n-api.mjs";

const manifest = JSON.parse(
  await readFile(
    new URL("../contratos/cooper-migracion-tablas.json", import.meta.url),
  ),
);
const missing = (value) =>
  value === undefined || value === null || value === "";
export async function planMigration(api, admin, { assignAll = false } = {}) {
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(admin) ||
    admin !== admin.toLowerCase()
  )
    throw new Error("Administrador inválido");
  const tables = await api.all("/data-tables");
  const selected = {};
  const columns = [];
  for (const [name, schema] of Object.entries(manifest.tablas)) {
    const matches = tables.filter((t) => t.name === name);
    if (matches.length !== 1)
      throw new Error(
        `Se requiere una sola tabla ${name}; encontradas: ${matches.length}`,
      );
    const table = matches[0];
    selected[name] = { ...table, rows: await api.rows(table.id) };
    for (const [column, type] of Object.entries(schema)) {
      const current = table.columns.find((c) => c.name === column);
      if (current && current.type !== type)
        throw new Error(`Tipo incompatible: ${name}.${column}`);
      if (!current) columns.push({ table: table.id, name: column, type });
    }
  }
  const unique = (rows, key) => {
    const map = new Map();
    for (const row of rows) {
      if (!row[key] || map.has(row[key]))
        throw new Error(
          `Identificador ausente/duplicado: ${key}, fila ${row.id}`,
        );
      map.set(row[key], row);
    }
    return map;
  };
  const channels = unique(selected.fab_canales.rows, "canal_id");
  const videos = unique(selected.fab_videos.rows, "video_id");
  unique(
    selected.fab_costos.rows.filter((row) => !missing(row.paso_id)),
    "paso_id",
  );
  const owner = (row) => (assignAll ? admin : row.dueno_email || admin);
  const channelOwner = (id) => {
    const channel = channels.get(id);
    if (!channel) throw new Error(`Canal huérfano: ${id}`);
    return owner(channel);
  };
  const videoOwner = (id) => {
    const video = videos.get(id);
    if (!video) throw new Error(`Video huérfano: ${id}`);
    return channelOwner(video.canal_id);
  };
  const updates = [];
  for (const [name, table] of Object.entries(selected)) {
    for (const row of table.rows) {
      const data = {};
      const setMissing = (key, value) => {
        if (missing(row[key])) data[key] = value;
      };
      if (name !== "fab_planos") {
        const expected =
          name === "fab_canales"
            ? owner(row)
            : name === "fab_videos"
              ? channelOwner(row.canal_id)
              : row.video_id?.startsWith("canal:")
                ? row.video_id === "canal:"
                  ? admin
                  : channelOwner(row.video_id.slice(6))
                : row.video_id
                  ? videoOwner(row.video_id)
                  : row.canal_id
                    ? channelOwner(row.canal_id)
                    : admin;
        if (
          !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(expected) ||
          expected !== expected.toLowerCase()
        )
          throw new Error(`Dueño inválido en ${name}, fila ${row.id}`);
        if (row.dueno_email && row.dueno_email !== expected && !assignAll)
          throw new Error(`Dueño contradictorio en ${name}, fila ${row.id}`);
        if (assignAll && row.dueno_email !== expected)
          data.dueno_email = expected;
        else setMissing("dueno_email", expected);
      }
      if (["fab_canales", "fab_videos"].includes(name))
        setMissing("eliminado", false);
      if (name === "fab_videos") {
        // No inventar guiones, aprobaciones ni transiciones históricas.
        setMissing("guion_cooper", "");
        const timestamp = Date.parse(row.updatedAt || row.createdAt);
        if (missing(row.cooper_actualizado_en) && !Number.isFinite(timestamp))
          throw new Error(`Fecha inválida en ${name}, fila ${row.id}`);
        setMissing("cooper_actualizado_en", timestamp);
        setMissing("cooper_evento_id", `migracion-dueno:${table.id}:${row.id}`);
      }
      if (name === "fab_costos") {
        setMissing("paso_id", `migracion-costo:${table.id}:${row.id}`);
        setMissing("estimado", true);
      }
      // Cadena vacía ya escrita también es un valor final válido.
      for (const key of Object.keys(data))
        if (row[key] === data[key]) delete data[key];
      if (Object.keys(data).length)
        updates.push({
          table: table.id,
          name,
          id: row.id,
          before: Object.fromEntries(
            Object.keys(data).map((key) => [key, row[key] ?? null]),
          ),
          after: data,
        });
    }
  }
  return { version: 1, origin: api.url, admin, assignAll, columns, updates };
}
export async function applyMigration(api, plan, journal) {
  if (journal)
    await writeFile(journal, JSON.stringify(plan, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
  for (const column of plan.columns) {
    const { table, ...body } = column;
    await api.request("POST", `/data-tables/${table}/columns`, body);
  }
  for (const update of plan.updates) {
    const current = (await api.rows(update.table)).find(
      (row) => row.id === update.id,
    );
    if (
      !current ||
      Object.entries(update.before).some(
        ([key, value]) => (current[key] ?? null) !== value,
      )
    )
      throw new Error(
        `Cambio concurrente: ${update.name}, fila ${update.id}; detener órdenes y revisar diario`,
      );
    const changed = await api.update(update.table, update, update.after);
    if (changed.length !== 1)
      throw new Error("La actualización no afectó exactamente una fila");
  }
}
export async function reverseMigration(api, plan, simulate) {
  if (plan.version !== 1 || api.url !== plan.origin)
    throw new Error("El diario no pertenece a este destino");
  const changes = [];
  for (const update of plan.updates) {
    const row = (await api.rows(update.table)).find((r) => r.id === update.id);
    if (!row) throw new Error(`Fila ausente durante reversa: ${update.id}`);
    const data = {};
    for (const [key, before] of Object.entries(update.before)) {
      if ((row[key] ?? null) === before) continue;
      if (row[key] !== update.after[key])
        throw new Error(
          `Dato cambiado tras migrar: ${update.name}.${key}, fila ${update.id}`,
        );
      data[key] = before;
    }
    if (Object.keys(data).length) changes.push({ ...update, data });
  }
  if (!simulate)
    for (const change of changes)
      await api.update(change.table, change, change.data);
  return changes.length;
}
async function main() {
  const args = process.argv.slice(2);
  const value = (key) =>
    args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  const url = value("--url");
  const admin = value("--admin") || "wdhgxoxa@gmail.com";
  const simulate = args.includes("--simular");
  if (
    !url ||
    !process.env.N8N_API_KEY ||
    (!simulate && !args.includes("--aplicar"))
  )
    throw new Error(
      "Uso: N8N_API_KEY desde entorno; node tools/migrar_dueno.mjs --url URL --admin CORREO --simular | --aplicar --respaldo ARCHIVO [--revertir DIARIO]",
    );
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["http:", "https:"].includes(parsed.protocol)
  )
    throw new Error("URL inválida");
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
  )
    throw new Error("HTTP permitido solo en loopback");
  const api = new N8nApi(url, process.env.N8N_API_KEY);
  if (value("--revertir")) {
    const plan = JSON.parse(await readFile(value("--revertir"), "utf8"));
    console.log(
      JSON.stringify({
        reversa: await reverseMigration(api, plan, simulate),
        simular: simulate,
        columnas_conservadas: true,
      }),
    );
    return;
  }
  const plan = await planMigration(api, admin, {
    assignAll: args.includes("--asignar-todo-al-admin"),
  });
  console.log(
    JSON.stringify(
      {
        simular: simulate,
        columnas: plan.columns,
        filas: plan.updates.map((row) => ({
          tabla: row.name,
          id: row.id,
          cambios: row.after,
        })),
      },
      null,
      2,
    ),
  );
  if (!simulate) {
    if (!value("--respaldo"))
      throw new Error(
        "Falta --respaldo para el diario de reversa (archivo nuevo)",
      );
    await applyMigration(api, plan, resolve(value("--respaldo")));
    console.log("Migración aplicada; columnas aditivas, sin SQL interno.");
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
