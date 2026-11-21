// Administración local, fijada a n8n 2.47.4. Usa su servicio de tablas, nunca SQL DDL propio.
const { createRequire } = require('node:module');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

function planColumnas(tablas, manifest) {
  const plan = [];
  for (const [nombre, campos] of Object.entries(manifest.tablas)) {
    const nombres = nombre === 'fab_publicaciones' ? ['fab_publicaciones', 'publicaciones'] : [nombre];
    const matches = tablas.filter(t => nombres.includes(t.name));
    if (matches.length !== 1) throw new Error(`Tabla ambigua o ausente: ${nombre}`);
    const tabla = matches[0];
    for (const [name, type] of Object.entries(campos)) {
      const anterior = tabla.columns.find(c => c.name === name);
      if (anterior && anterior.type !== type) throw new Error(`Tipo incompatible: ${nombre}.${name}`);
      if (!anterior) plan.push({ tableId: tabla.id, projectId: tabla.projectId, table: tabla.name, name, type });
    }
  }
  return plan;
}
module.exports = { planColumnas };
let paso = 'inicio';

async function main() {
  const root = '/usr/local/lib/node_modules/n8n';
  const r = createRequire(path.join(root, 'package.json'));
  if (r('./package.json').version !== '2.47.4') throw new Error('Versión de n8n no ensayada');
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error('Falta manifiesto de columnas');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const aplicar = process.argv.includes('--aplicar');
  const journal = process.argv[process.argv.indexOf('--diario') + 1];
  if (aplicar && !process.argv.includes('--diario')) throw new Error('Falta diario previo');
  paso = 'configuracion';
  r('reflect-metadata');
  r('./dist/config');
  const { Container } = r('@n8n/di');
  const { ModuleRegistry } = r('@n8n/backend-common');
  const { DbConnection } = r('@n8n/db');
  paso = 'modulos';
  const registry = Container.get(ModuleRegistry);
  registry.registerPackagedModules(r('./dist/modules/modules.manifest').packagedModules);
  await registry.loadModules();
  const db = Container.get(DbConnection);
  paso = 'conexion';
  await db.init();
  try {
    paso = 'servicios';
    const { DataTableRepository, DataTableService } = r('@n8n/backend-module-data-table');
    paso = 'inventario';
    const tables = await Container.get(DataTableRepository).find({ relations: ['columns'] });
    paso = 'plan';
    const plan = planColumnas(tables, manifest);
    if (aplicar) {
      writeFileSync(journal, JSON.stringify({ version: 1, columnas: plan }, null, 2), { flag: 'wx', mode: 0o600 });
      paso = 'columnas';
      const service = Container.get(DataTableService);
      for (const column of plan) await service.addColumn(column.tableId, column.projectId, { name: column.name, type: column.type });
      const after = await Container.get(DataTableRepository).find({ relations: ['columns'] });
      if (planColumnas(after, manifest).length) throw new Error('Migración incompleta');
    }
    console.log(JSON.stringify({ modo: aplicar ? 'aplicar' : 'simular', columnas: plan, sin_filas_modificadas: true }));
  } finally { await db.close(); }
}
if (require.main === module) main().then(() => process.exit(0)).catch(() => {
  // Los mensajes de librerías podrían contener filas/configuración privada.
  console.error(`Falló la migración de columnas en ${paso}; revisar versión, esquema y diario, sin exponer datos.`);
  process.exit(1);
});
