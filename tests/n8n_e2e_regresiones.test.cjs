// Regresiones del ensayo e2e reconciliadas con el aprendizaje ampliado y el retorno M01.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const workflow = id => JSON.parse(fs.readFileSync(path.join(root, 'workflows/v2', id + '.json'), 'utf8'));
const code = (id, name) => workflow(id).nodes.find(n => n.name === name).parameters.jsCode;
const observabilidad = fs.readFileSync(path.join(root, 'tools/cooper/observabilidad.js'), 'utf8');
function ejecutar(js, nodes = {}, input = []) {
  const $ = name => ({ first: () => ({ json: nodes[name]?.[0] || {} }), all: () => (nodes[name] || []).map(json => ({ json })), isExecuted: Object.hasOwn(nodes, name) });
  return new Function('$', '$input', '$json', js)($, { all: () => input.map(json => ({ json })) }, input[0] || {});
}
const fecha = '2026-11-21T12:00:00Z';
const trabajo = (job_id, modo, resultado, extra = {}) => ({ job_id, modo, estado: 'listo', canal_id: 'c-uno', video_id: 'v-uno', createdAt: fecha, resultado: JSON.stringify({ resultado }), ...extra });
const leccion = id => ({ id, regla:'Una pregunta concreta mejora la apertura.', causa:'Hipótesis con una muestra', correccion:'Probar otra apertura', origenes:[{video_id:'v-uno',red:'youtube',ventana:'24h',fecha,metrica:'vistas',valor:100}], nivel:'hipotesis' });
const aprendido = id => ({ evidencia_version:1, lecciones:[leccion(id)] });
const guion = (jobs, temas = []) => ejecutar(code('FabOrquestador01','Nuevo video'), {
  Inicio:[{canal_id:'c-uno',tema:'Una pregunta nueva'}], 'Buscar canal':[{canal_id:'c-uno',formato_defecto:'short'}],
  'Buscar biblia':[{resultado:JSON.stringify({resultado:{voz:{tono:'Cercano'}}})}],
  'Lecciones antes del guion':jobs, 'Temas recientes del canal':temas,
})[0].json;
function evidencia(jobs) {
  const video={video_id:'v-uno',canal_id:'c-uno',tema:'Luz natural'};
  return ejecutar(code('FabAprendizaje01','Pedir lecciones'), {
    'Trabajos para aprender':jobs, 'Videos para aprender':[video], 'Planos para aprender':[],
    'Cooper · historial YouTube':[{video_id:'v-uno',metricas_consultadas_en:fecha,metricas_youtube:JSON.stringify([{fecha,ventana:'24h',vistas:100}])}],
    'Pedidos de retención':[video], Retención:[{rows:[[0,0.8],[1,0.6]]}],
  })[0].json.datos.evidencias[0];
}

test('e2e: el retorno confirmado aparece en Aprendizaje y no mezcla pendientes ni otros canales', () => {
  const resultado=aprendido('leccion-uno');
  const reserva={resultado:JSON.stringify({resultado,retorno:{version:1,huella:'huella',entregado:false}})};
  const fila=ejecutar(code('FabRetornoClaud1','Fila actualizada'), {Validar:[{estado:'ok'}],'Reserva del retorno':[reserva]})[0].json;
  assert.equal(fila.estado,'listo'); assert.equal(JSON.parse(fila.resultado).retorno.entregado,true);
  const jobs=[trabajo('a','aprender',resultado,fila),trabajo('b','aprender',aprendido('pendiente'),{estado:'enviado'}),trabajo('c','aprender',aprendido('ajena'),{canal_id:'c-otro'})];
  const out=ejecutar(observabilidad+"return leccionesCooper({canal_id:'c-uno'},$input.all().map(i=>i.json));",{},jobs);
  assert.deepEqual(out.map(l=>l.id),['leccion-uno']);
});

test('e2e: siguiente guion conserva temas, biblia y lectura obligatoria de aprendizajes propios', () => {
  const nuevo=guion([trabajo('a','aprender',aprendido('propia')),trabajo('b','aprender',aprendido('ajena'),{canal_id:'c-otro'})],[{video_id:'v-previo',tema:'Tema anterior',createdAt:fecha}]);
  assert.deepEqual(nuevo.pedido.datos.temas_recientes,['Tema anterior']);
  assert.equal(nuevo.pedido.datos.biblia.voz.tono,'Cercano');
  assert.deepEqual(nuevo.pedido.datos.aprendizaje.lecciones.map(l=>l.id),['propia']);
  assert.equal(nuevo.pedido.datos.aprendizaje.obligatorio,true);
  assert.deepEqual(nuevo.pedido.datos.biblia.lecciones_automaticas,nuevo.pedido.datos.aprendizaje.lecciones);
  const pedido=ejecutar(code('FabOrquestador01','Pedir guion'),{'Nuevo video':[nuevo]})[0].json;
  assert.deepEqual(pedido.datos.aprendizaje,nuevo.pedido.datos.aprendizaje);
});

test('e2e: lectura ordena por fecha y acota las treinta lecciones verificadas más recientes', () => {
  const jobs=Array.from({length:35},(_,i)=>trabajo('j-'+i,'aprender',aprendido('l-'+i),{createdAt:new Date(Date.parse(fecha)+i*1000).toISOString()}));
  const out=guion(jobs).pedido.datos.aprendizaje.lecciones;
  assert.equal(out.length,30);assert.equal(out[0].id,'l-34');assert.equal(out.at(-1).id,'l-5');
});

test('e2e: métricas conservan guion corregido y planos del canal medido', () => {
  const jobs=[trabajo('g1','guion',{titulo:'Original',guion:'Texto anterior'}),trabajo('g2','corregir_guion',{titulo:'Revisado',guion:'Texto aprobado'},{updatedAt:'2026-11-21T13:00:00Z'}),trabajo('s','storyboard',{planos:[{id:'p01',texto_narrado:'Texto aprobado',duracion_s:4}]}),trabajo('ajeno','guion',{guion:'AJENO'},{canal_id:'c-otro',updatedAt:'2026-11-21T14:00:00Z'}),trabajo('pendiente','storyboard',{planos:[{id:'pendiente'}]},{estado:'enviado'})];
  const out=evidencia(jobs); assert.equal(out.creativo.guion,'Texto aprobado');assert.equal(out.creativo.titulo,'Revisado');
  assert.equal(out.creativo.planos[0].id,'p01');assert.equal(out.creativo.planos[0].texto,'Texto aprobado');assert.equal(out.creativo.planos[0].duracion_s,4);
  assert.doesNotMatch(JSON.stringify(out),/AJENO|pendiente/);assert.deepEqual(out.retencion,[[0,0.8],[1,0.6]]);
});

test('e2e: datos corruptos no inventan guion ni tiempos de planos', () => {
  const out=evidencia([trabajo('roto','guion',{}, {resultado:'{incompleto'})]);
  assert.equal(out.creativo.guion,null);assert.deepEqual(out.creativo.planos,[]);assert.equal(out.duracion_s,null);
});

test('e2e: proyección histórica tolera elementos nulos y no los convierte en evidencia comprobada', () => {
  const resultado={resumen:'Pregunta clara',lecciones:[null,[],3,false,{regla:'Mostrar el cambio al inicio.'},'Pregunta concreta'],ganchos:[null,{},2,{gancho:'Pregunta concreta'}],temas:[null,[],{tema:'Luz natural'}]};
  const jobs=[trabajo('antiguo','aprender',resultado)];
  const out=ejecutar(observabilidad+"return leccionesCooper({canal_id:'c-uno'},$input.all().map(i=>i.json));",{},jobs);
  assert.equal(out.length,1);assert.match(out[0].resumen,/Mostrar el cambio/);assert.deepEqual(out[0].temas,['Luz natural']);
  assert.deepEqual(guion(jobs).pedido.datos.aprendizaje.lecciones,[]);
});

test('e2e: planos inválidos se descartan conservando planos válidos y duración desconocida', () => {
  const jobs=[trabajo('g','guion',{guion:'Mira la luz.'}),trabajo('s','storyboard',{planos:[null,[],'inválido',2,false,{id:'p01',texto_narrado:'Mira la luz.'}]})];
  const out=evidencia(jobs);assert.equal(out.creativo.planos.length,1);assert.equal(out.creativo.planos[0].id,'p01');assert.equal(out.creativo.planos[0].duracion_s,null);
});

test('e2e: lecturas de aprendizaje preceden a sus consumidores y mantienen el contexto explícito', () => {
  const edges=(w,n)=>(w.connections[n]?.main || []).flat().map(e=>e.node);
  const orq=workflow('FabOrquestador01'),apr=workflow('FabAprendizaje01');
  assert.ok(edges(orq,'Lecciones antes del guion').includes('Nuevo video'));
  assert.ok(edges(apr,'Trabajos para aprender').includes('Videos para aprender'));
  assert.ok(edges(apr,'Videos para aprender').includes('Planos para aprender'));
  assert.ok(edges(apr,'Planos para aprender').includes('Pedir lecciones'));
  assert.match(code('FabOrquestador01','Nuevo video'),/Temas recientes del canal/);
});
