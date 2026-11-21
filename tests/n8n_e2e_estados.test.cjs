// Contratos de fallo ejercitados por el ensayo local, sin servicios remotos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = id => JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows/v2', id + '.json'), 'utf8'));
const production = workflow('FabProduccion001');
const orchestrator = workflow('FabOrquestador01');
const callback = workflow('FabRetornoClaud1');
const node = (w, name) => {
  const result = w.nodes.find(n => n.name === name);
  assert.ok(result, 'Nodo presente: ' + name);
  return result;
};
const run = (w, name, json = {}, nodes = {}, runIndex = 0) => {
  const $ = name => ({ first: () => ({ json: nodes[name] }), all: () => [{ json: nodes[name] }] });
  return new Function('$', '$json', '$runIndex', node(w, name).parameters.jsCode)($, json, runIndex);
};
const destinations = (w, name, output = 0) => (w.connections[name]?.main[output] || []).map(x => x.node);

test('ensayo: callback exige el mismo modo y un trabajo todavía enviado', () => {
  const expression = node(callback, '¿Trabajo pendiente?').parameters.conditions.conditions[0].leftValue.slice(3, -2);
  const accept = (job, received) => new Function('$', '$json', 'return (' + expression + ')')(
    () => ({ first: () => ({ json: received }) }), job,
  );
  const job = { job_id: 'guion-abc-xyz', modo: 'guion', estado: 'enviado' };
  assert.equal(accept(job, job), true);
  assert.equal(accept(job, { ...job, modo: 'crear_biblia' }), false);
  assert.equal(accept({ ...job, estado: 'listo' }, job), false);
  assert.equal(accept(job, { ...job, job_id: 'guion-otro-xyz' }), false);
});

test('ensayo: render pendiente tiene un límite durable de 40 consultas', () => {
  const poll = index => run(production, 'Render · limitar espera', { status: 'rendering' }, {}, index)[0].json;
  assert.equal(poll(0).status, 'rendering');
  assert.equal(poll(38).status, 'rendering');
  assert.equal(poll(39).status, 'failed');
  assert.equal(poll(39).consultas_render, 40);
  assert.match(poll(39).error_message, /40 consultas/);
  assert.deepEqual(destinations(production, 'Consultar render'), ['Render · limitar espera']);
  assert.deepEqual(destinations(production, 'Render · limitar espera'), ['¿Render listo?']);
});

test('ensayo: render listo conserva el resultado aun en la última consulta', () => {
  const result = { status: 'succeeded', url: 'https://example.test/render.mp4', duration: 16.3, width: 1080, height: 1920 };
  const got = run(production, 'Render · limitar espera', result, {}, 39)[0].json;
  assert.deepEqual(got, { ...result, consultas_render: 40 });
});

test('ensayo: render fallido, cancelado o ilegible termina sin filtrar mensajes del proveedor', () => {
  for (const status of ['failed', 'cancelled', 'canceled', 'unexpected', undefined]) {
    const response = run(production, 'Render · limitar espera', { status, error_message: 'mensaje privado del proveedor' })[0].json;
    assert.equal(response.status, 'failed');
    assert.ok(!response.error_message.includes('privado'));
    const closure = run(production, 'Render · fallo durable', response)[0].json;
    assert.equal(closure.estado, 'con_fallas');
    assert.equal(closure.etapa, 'montaje');
  }
  assert.equal(run(production, 'Render · limitar espera', { status: 'succeeded' })[0].json.status, 'failed');
});

test('ensayo: fallo de montaje se guarda antes de emitir el aviso', () => {
  assert.deepEqual(destinations(production, '¿Render fallido?'), ['Render · fallo durable']);
  assert.ok(destinations(production, 'Render · fallo durable').some(x => x.includes('Render · guardar fallo')));
  assert.deepEqual(destinations(production, 'Render · conservar fallo'), ['Aviso: render fallido']);
  assert.deepEqual(destinations(production, '¿Render fallido?', 1), ['Esperar render']);
});

test('ensayo: interruptores y presupuesto en pausa dejan un estado recuperable', () => {
  for (const bloqueo of ['presupuesto', 'voz_apagada', 'produccion_pausada']) {
    const result = run(production, 'Pausa · Aviso: falta encender', {}, { 'Plan de producción': { bloqueo } })[0].json;
    assert.equal(result.estado, 'detenido');
    assert.equal(result.etapa, 'produccion');
    assert.match(result.error, bloqueo === 'presupuesto' ? /presupuesto/ : /habilitaciones/);
  }
  assert.deepEqual(destinations(production, '¿Todo encendido?', 1), ['Pausa · Aviso: falta encender']);
  assert.deepEqual(destinations(production, '¿Dentro del presupuesto?', 1), ['Pausa · Aviso: sobre presupuesto']);
});

test('ensayo: error de especialista cierra el video y no retorna a la ruta de éxito', () => {
  for (const modo of ['guion', 'corregir_guion', 'storyboard']) {
    const result = run(orchestrator, 'Especialista · fallo durable', {}, { Inicio: { modo } })[0].json;
    assert.equal(result.estado, 'con_fallas');
    assert.equal(result.etapa, modo === 'storyboard' ? 'storyboard' : 'guion');
  }
  assert.deepEqual(destinations(orchestrator, '¿Falló el especialista?'), ['Especialista · fallo durable']);
  assert.deepEqual(destinations(orchestrator, '¿Falló el especialista?', 1), ['Ruta']);
});

test('ensayo: cierres no reactivan videos eliminados ni cancelados y reciben sello', () => {
  for (const [w, names] of [[production, ['Render · guardar fallo', 'Pausa · Aviso: falta encender guardar', 'Pausa · Aviso: sobre presupuesto guardar']], [orchestrator, ['Especialista · guardar fallo']]]) {
    for (const name of names) {
      const conditions = node(w, name).parameters.filters.conditions;
      assert.ok(conditions.some(c => c.keyName === 'eliminado' && c.condition === 'neq' && c.keyValue === true));
      assert.ok(conditions.some(c => c.keyName === 'estado' && c.condition === 'neq' && c.keyValue === 'cancelado'));
      assert.ok(node(w, 'Cooper · sello ' + name));
      assert.ok(node(w, 'Cooper · sello ' + name + ' aviso'));
    }
  }
});

const itemsFromSubworkflow = () => [
  { json: { plano_id: 'p01', metadata: { dominio: 'contenido permitido' } }, binary: { archivo: { data: 'YWJj', mimeType: 'audio/wav' } }, pairedItem: { item: 4 }, metadata: { subExecution: { executionId: 'ensayo-1' } }, debug: 'interno' },
  { json: { plano_id: 'p02', resultado: 'segundo canal' }, pairedItem: [{ item: 8, input: 0 }], metadata: { subExecution: { executionId: 'ensayo-2' } } },
];
const runPassthrough = (w, name, items, extraNodes = {}) => {
  const $ = source => ({ all: () => items, first: () => ({ json: extraNodes[source] || {} }), isExecuted: Object.hasOwn(extraNodes, source) });
  return new Function('$', '$input', node(w, name).parameters.jsCode)($, { all: () => items });
};
const assertPublicItems = (actual, source) => {
  assert.equal(actual.length, source.length);
  for (let k = 0; k < actual.length; k++) {
    assert.deepEqual(actual[k].json, source[k].json);
    assert.deepEqual(actual[k].binary, source[k].binary);
    assert.ok(Object.keys(actual[k]).every(key => ['json', 'binary', 'pairedItem'].includes(key)));
    assert.ok(!Object.hasOwn(actual[k], 'metadata'));
  }
};

test('ensayo: radar devuelve dos subejecuciones sin metadata reservada y conserva binarios', () => {
  const radar = workflow('FabRadar00000001'), items = itemsFromSubworkflow();
  const actual = runPassthrough(radar, 'Cooper · costo Analista de tendencias seguir', items);
  assertPublicItems(actual, items);
  assert.deepEqual(actual.map(i => i.pairedItem), [{ item: 0 }, { item: 1 }]);
  assert.equal(actual[0].json.metadata.dominio, 'contenido permitido');
  assert.ok(Object.hasOwn(items[0], 'metadata'), 'La proyección no muta el resultado original');
});

test('ensayo: todas las restauraciones de ítems descartan metadata interna del motor', () => {
  const root = path.join(__dirname, '../workflows/v2');
  const tested = [];
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.json'))) {
    const w = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    for (const n of w.nodes) {
      const code = n.parameters.jsCode || '';
      if (!code.startsWith('/* Ítems públicos de n8n:')) continue;
      const items = itemsFromSubworkflow();
      const actual = runPassthrough(w, n.name, items);
      assertPublicItems(actual, items);
      if (!code.includes('pairedItem:{item:k}')) assert.deepEqual(actual.map(i => i.pairedItem), items.map(i => i.pairedItem));
      tested.push(w.id + ':' + n.name);
    }
  }
  assert.ok(tested.some(name => name.includes('Presentación ·')));
  assert.ok(tested.some(name => name.includes('Costo · Verificar guion noticia seguir')));
  assert.ok(tested.some(name => name.includes('Cooper · continuar ejecución')));
  assert.ok(tested.some(name => name.includes('Cooper · seguir auxiliar')));
  assert.ok(tested.some(name => name.includes('Guardar costos')));
});

test('ensayo: respaldo conserva la prohibición de gasto y proyecta el contrato Code', () => {
  const w = workflow('FabTextoGPT0001'), items = itemsFromSubworkflow();
  assert.throws(() => runPassthrough(w, 'Permitir respaldo', items, { 'Pedido de texto': { api_permitida: false } }), /respaldo API está apagado/);
  assertPublicItems(runPassthrough(w, 'Permitir respaldo', items, { 'Pedido de texto': { api_permitida: true } }), items);
});

test('ensayo: radar de noticias filtra canales antes de limpiar metadata', () => {
  const w = workflow('FabRadar00000001');
  const items = [
    { json: { canal_id: 'c1', estado: 'activo' }, metadata: { subExecution: {} } },
    { json: { canal_id: 'c2', estado: 'activo' }, metadata: { subExecution: {} } },
    { json: { canal_id: 'c1', estado: 'activo', eliminado: true }, metadata: { subExecution: {} } },
  ];
  const actual = runPassthrough(w, 'Pedidos de noticias', items, { Inicio: { canal_id: 'c1' } });
  assertPublicItems(actual, [items[0]]);
});

test('ensayo: montaje y miniatura llegan de calidad al video y a Cooper sin perderse en el sello', () => {
  const publication = workflow('FabPublicacion01');
  const qc = {
    video_id: 'v-ensayo', canal_id: 'c-ensayo', render_url: 'https://example.test/render.mp4',
    miniatura_url: 'https://example.test/miniatura.jpg', avisos: [], duracion_s: 16.3,
    costo_usd: 0, formato: 'short', carpeta: 'ensayo', publicacion: {},
  };
  const message = run(publication, 'Mensaje final', qc)[0].json;
  const fields = run(publication, 'Cooper · Aprobación final etapa', {}, { 'Cooper · Aprobación final entrada': message });
  assert.deepEqual(fields, [{ json: { etapa: 'aprobacion_final', render_url: qc.render_url, miniatura_url: qc.miniatura_url } }]);
  const stampName = 'Cooper · sello Cooper · Aprobación final guardar';
  const stamped = new Function('$input', '$execution', '$runIndex', node(publication, stampName).parameters.jsCode)(
    { all: () => fields }, { id: 'ejecucion-ensayo' }, 0,
  )[0].json;
  const video = { video_id: qc.video_id, ...stamped };
  const projectionSource = fs.readFileSync(path.join(__dirname, '../tools/cooper/observabilidad.js'), 'utf8');
  const projected = new Function('v', projectionSource + '\nreturn observabilidadCooper(v,[],[],[],[]);')(video);
  assert.equal(projected.montaje, qc.render_url);
  assert.equal(projected.miniatura, qc.miniatura_url);
  assert.equal(video.cooper_evento_id, 'ejecucion-ensayo:Cooper · Aprobación final guardar:0:0');
  assert.deepEqual(destinations(publication, 'Cooper · Aprobación final etapa'), [stampName]);
  assert.deepEqual(destinations(publication, stampName), ['Cooper · Aprobación final guardar']);
  assert.deepEqual(destinations(publication, 'Cooper · Aprobación final seguir'), ['Presentación · Aprobación final entrada']);
  assert.deepEqual(destinations(publication, 'Presentación · Aprobación final seguir'), ['Aprobación final']);
});

test('ensayo: aprobación final exige montaje HTTPS y descarta miniaturas inválidas', () => {
  const publication = workflow('FabPublicacion01');
  const fields = contexto => run(publication, 'Cooper · Aprobación final etapa', {}, { 'Cooper · Aprobación final entrada': { contexto } })[0].json;
  for (const render_url of ['', 'javascript:alert(1)', 'http://example.test/render.mp4']) {
    assert.throws(() => fields({ render_url }), /montaje válido/);
  }
  assert.equal(fields({ render_url: 'https://example.test/render.mp4', miniatura_url: 'file:///tmp/miniatura.png' }).miniatura_url, '');
  const migration = JSON.parse(fs.readFileSync(path.join(__dirname, '../contratos/cooper-migracion-tablas.json'), 'utf8'));
  assert.equal(migration.tablas.fab_videos.render_url, 'string');
  assert.equal(migration.tablas.fab_videos.miniatura_url, 'string');
});
