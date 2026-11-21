const test = require('node:test');
const assert = require('node:assert/strict');
const { planColumnas } = require('../deploy/n8n-columnas.cjs');
const schema = {tablas:{fab_publicaciones:{metricas_historial:'string'}}};
test('reconoce publicaciones real sin crear otra tabla ni cambiar filas', () => {
  const tables=[{id:'t1',projectId:'p1',name:'publicaciones',columns:[]}];
  assert.deepEqual(planColumnas(tables,schema),[{tableId:'t1',projectId:'p1',table:'publicaciones',name:'metricas_historial',type:'string'}]);
  assert.equal(tables[0].columns.length,0);
  tables[0].columns.push({name:'metricas_historial',type:'string'});
  assert.deepEqual(planColumnas(tables,schema),[]);
});
test('rechaza alias ambiguo y columna incompatible', () => {
  assert.throws(()=>planColumnas([{name:'publicaciones'},{name:'fab_publicaciones'}],schema),/ambigua/);
  assert.throws(()=>planColumnas([{name:'publicaciones',columns:[{name:'metricas_historial',type:'number'}]}],schema),/incompatible/);
});
