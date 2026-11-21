// Ejecutar exclusivamente con ejecutar-volumen-n8n.mjs, dentro de la imagen fijada.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const {performance} = require('node:perf_hooks');
const {FECHA,dueno,tablasPorNodo,fixture,esperados,contexto,parametros} = require('./volumen-fixture.cjs');
const req = createRequire('/usr/local/lib/node_modules/n8n/package.json');
const root = '/usr/local/lib/node_modules/n8n/node_modules/@n8n/backend-module-data-table/dist/';
const nodeRoot = '/usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-base/dist/nodes/DataTable/';
const {DataSource} = req('@n8n/typeorm');
const {DataTableDDLService} = require(root+'persistence/data-table-ddl.js');
const {DataTableRowsRepository} = require(root+'data-table-rows.repository.js');
const {normalizeRows,toTableName} = require(root+'utils/sql-utils.js');
const get = require(nodeRoot+'actions/row/get.operation.js').execute;
const hash = x => createHash('sha256').update(x).digest('hex');
const workflow = JSON.parse(fs.readFileSync('/ensayo/puente.json'));
const schemas = JSON.parse(fs.readFileSync('/ensayo/esquema.json')).tablas;
const resolverCode = workflow.nodes.find(n=>n.name === 'Resolver').parameters.jsCode;
const resolver = new Function('$',resolverCode);
const lecturas = Object.keys(tablasPorNodo).map(name=>workflow.nodes.find(n=>n.name === name));
const mib = n=>n/1024/1024;
const fuente = [root+'persistence/data-table-ddl.js',root+'data-table-rows.repository.js',root+'data-table.service.js',root+'utils/sql-utils.js',nodeRoot+'actions/row/get.operation.js',nodeRoot+'common/selectMany.js',nodeRoot+'common/utils.js'];
async function main() {
  assert.equal(req('./package.json').version,'2.47.6');
  assert.ok(global.gc,'Requiere --expose-gc');
  const ds = new DataSource({type:'sqlite-pooled',database:'/tmp/volumen.sqlite',poolSize:1,enableWAL:true,entities:[]});
  await ds.initialize();
  try {
    const repo = new DataTableRowsRepository(ds);
    const ddl = new DataTableDDLService(ds);
    let datos = fixture();
    const fixtureHash = hash(JSON.stringify(datos));
    const columnas = {};
    const poblacion = {};
    for (const [tabla,rows] of Object.entries(datos)) {
      columnas[tabla] = Object.entries(schemas[tabla]).map(([name,type])=>({name,type}));
      for(const row of rows) for(const key of Object.keys(row)) assert.ok(schemas[tabla][key],`${tabla}.${key} no existe`);
      await ddl.createTableWithColumns(tabla,columnas[tabla]);
      await repo.insertRows(tabla,rows,columnas[tabla],'count');
      await ds.query(`UPDATE "${toTableName(tabla)}" SET "createdAt"=?,"updatedAt"=?`,[FECHA,FECHA]);
      poblacion[tabla] = rows.length;
    }
    datos = null;
    const resultados = [];
    async function muestra(auth, exportar) {
      global.gc();
      const antes = process.memoryUsage();
      const t = performance.now();
      const filas = {}, nodos = [];
      for (const node of lecturas) {
        const tabla = tablasPorNodo[node.name], cols = columnas[tabla];
        const p = parametros(node.parameters,contexto(filas,auth));
        const paginas = [];
        const proxy = {
          getColumns:async()=>cols,
          getManyRowsAndCount:async dto=>{
            const r = await repo.getManyAndCount(tabla,dto,cols,{});
            paginas.push({skip:dto.skip,take:dto.take,count:r.count,filas:r.data.length});
            return {count:r.count,data:normalizeRows(r.data,cols)};
          },
        };
        const ctx = {getNode:()=>node,getExecutionCancelSignal:()=>undefined,helpers:{getDataTableProxy:async()=>proxy},getNodeParameter:(path,index,fallback)=>path.split('.').reduce((o,k)=>o?.[k],p) ?? fallback};
        const inicio = performance.now();
        const rows = await get.call(ctx,0);
        filas[node.name] = rows.length ? rows : [{json:{}}]; // alwaysOutputData del motor de workflows
        nodos.push({nombre:node.name,ms:performance.now()-inicio,recuperadas:rows.length,paginas});
      }
      const despuesLectura = process.memoryUsage();
      const inicioProyeccion = performance.now();
      const result = resolver(contexto(filas,auth))[0].json;
      const fin = performance.now();
      const memoria = process.memoryUsage();
      // Verificaciones y serialización fuera del tiempo y del delta de heap.
      assert.equal(result.status,200);
      const videos = result.respuesta.videos;
      assert.deepEqual(videos.map(v=>v.id),esperados(auth));
      for (const v of videos) {
        if (!auth.admin) assert.equal(v.dueno_email,auth.dueno_email);
        assert.equal(v.observabilidad.escenas[0].id,`plano-${Number(v.id.slice(6))}`);
        assert.equal(v.observabilidad.publicaciones[0].url,`https://www.youtube.com/watch?v=${v.id}`);
        assert.deepEqual(v.observabilidad.publicaciones[0].historial.map(m=>m.vistas),[1,3]);
        assert.equal(v.observabilidad.incidencias.length,1);
        assert.equal(v.script.length,4096);
      }
      const inicioSerializacion = performance.now();
      const serializado = JSON.stringify(result.respuesta);
      const serializacionMs = performance.now()-inicioSerializacion;
      if (exportar) fs.writeFileSync(`/salida/${exportar}.json`,serializado);
      return {ms:fin-t,lecturaMs:inicioProyeccion-t,proyeccionMs:fin-inicioProyeccion,heapDeltaMiB:mib(memoria.heapUsed-antes.heapUsed),heapLecturaMiB:mib(despuesLectura.heapUsed-antes.heapUsed),rssMiB:mib(memoria.rss),proyectadas:videos.length,canales:result.respuesta.canales.length,bytesJSON:Buffer.byteLength(serializado),sha256:hash(serializado),serializacionMs,nodos};
    }
    for (const [nombre,email,admin] of [['usuario-0',dueno(0),false],['usuario-9',dueno(9),false],['administrador',dueno(0),true],['sin-recursos','nadie@example.test',false]]) {
      const auth={admin,dueno_email:email,solicitud:{evento:'estado',datos:{}}};
      const caliente=await muestra(auth,process.argv.includes('--exportar-snapshots') ? nombre : undefined), muestras=[];
      for(let i=0;i<7;i++) {
        const r=await muestra(auth); assert.equal(r.sha256,caliente.sha256); muestras.push(r);
      }
      const tiempos=muestras.map(m=>m.ms).sort((a,b)=>a-b);
      const maxMs=Math.max(...tiempos), maxHeapMiB=Math.max(...muestras.map(m=>m.heapDeltaMiB));
      const resumen={nombre,medianaMs:tiempos[3],maxMs,maxHeapMiB,presupuestoM12:maxMs<=1000 && maxHeapMiB<=128,proyectadas:caliente.proyectadas};
      console.log(JSON.stringify(resumen));
      resultados.push({...resumen,calentamiento:caliente,muestras});
    }
    const salida={version:1,fecha:new Date().toISOString(),node:process.version,n8n:'2.47.6',fixtureHash,poblacion,fuentes:fuente.map(p=>({ruta:p,sha256:hash(fs.readFileSync(p))})),resolverHash:hash(resolverCode),maxRSSProcesoMiB:process.resourceUsage().maxRSS/1024,memoriaCgroup:Object.fromEntries(['memory.peak','memory.max','cpu.max','cpuset.cpus.effective'].map(k=>[k,fs.readFileSync('/sys/fs/cgroup/'+k,'utf8').trim()])),presupuesto:{maxMs:1000,maxHeapMiB:128,origen:'M12 lecturas; comparación de laboratorio, no SLA'},resultados};
    fs.writeFileSync('/salida/medicion.json',JSON.stringify(salida,null,2)+'\n');
  } finally {await ds.destroy();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
