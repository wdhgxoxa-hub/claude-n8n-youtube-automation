// Cortes reales de contratos descubiertos al recorrer la fábrica con n8n local.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const workflow = id => JSON.parse(fs.readFileSync(path.join(root, 'workflows/v2', id + '.json'), 'utf8'));
const code = (id, name) => workflow(id).nodes.find(n => n.name === name).parameters.jsCode;
const observabilidad = fs.readFileSync(path.join(root, 'tools/cooper/observabilidad.js'), 'utf8');

function ejecutar(js, nodes = {}, input = []) {
  const $ = name => ({
    first: () => ({ json: nodes[name]?.[0] || {} }),
    all: () => (nodes[name] || []).map(json => ({ json })),
    isExecuted: Object.hasOwn(nodes, name),
  });
  return new Function('$', '$input', '$json', js)($, { all: () => input.map(json => ({ json })) }, input[0] || {});
}
const fecha = '2026-11-21T12:00:00Z';
const trabajo = (job_id, modo, resultado, extra = {}) => ({
  job_id, modo, estado: 'listo', canal_id: 'c-uno', video_id: 'v-uno',
  createdAt: fecha, resultado: JSON.stringify({ resultado }), ...extra,
});

test('e2e: el estado escrito por Retorno aparece en Aprendizaje sin exponer trabajos pendientes', () => {
  const resultado = { resumen: 'La apertura con pregunta retuvo mejor.', lecciones: [{ regla: 'Abrir con una pregunta concreta.' }] };
  const fila = ejecutar(code('FabRetornoClaud1', 'Fila actualizada'), { Validar: [{ estado: 'ok', resultado, avisos: [] }] })[0].json;
  assert.equal(fila.estado, 'listo');
  const jobs = [
    trabajo('aprender-uno', 'aprender', resultado, fila),
    trabajo('pendiente', 'aprender', { resumen: 'No completado' }, { estado: 'enviado' }),
    trabajo('error', 'aprender', { resumen: 'No completado' }, { estado: 'error' }),
    trabajo('ajeno', 'aprender', { resumen: 'Privado de otro canal' }, { canal_id: 'c-otro' }),
  ];
  const proyectadas = ejecutar(observabilidad + "return leccionesCooper({canal_id:'c-uno'}, $input.all().map(i=>i.json));", {}, jobs);
  assert.equal(proyectadas.length, 1);
  assert.equal(proyectadas[0].id, 'aprender-uno');
  assert.match(proyectadas[0].resumen, /pregunta concreta/);
});

test('e2e: el siguiente guion recibe aprendizaje terminado del canal y conserva temas recientes', () => {
  const biblia = { voz: { tono: 'Cercano' } };
  const nodes = {
    Inicio: [{ canal_id: 'c-uno', tema: 'Una pregunta nueva' }],
    'Buscar canal': [{ canal_id: 'c-uno', formato_defecto: 'short', presupuesto_short_usd: 5 }],
    'Buscar biblia': [{ resultado: JSON.stringify({ resultado: biblia }) }],
    'Aprendizaje del canal': [
      trabajo('aprender-uno', 'aprender', { resumen: 'La pregunta concreta mejora el gancho.' }),
      trabajo('aprender-otro', 'aprender', { resumen: 'No compartir' }, { canal_id: 'c-otro' }),
    ],
  };
  const nuevo = ejecutar(code('FabOrquestador01', 'Nuevo video'), nodes, [{ video_id: 'v-previo', tema: 'Tema anterior', createdAt: fecha }])[0].json;
  assert.deepEqual(nuevo.pedido.datos.temas_recientes, ['Tema anterior']);
  assert.deepEqual(nuevo.pedido.datos.biblia, biblia);
  assert.equal(nuevo.pedido.datos.aprendizaje.length, 1);
  assert.equal(nuevo.pedido.datos.aprendizaje[0].id, 'aprender-uno');
  assert.match(nuevo.pedido.datos.aprendizaje_instrucciones, /tres videos/);
  const pedido = ejecutar(code('FabOrquestador01', 'Pedir guion'), { 'Nuevo video': [nuevo] })[0].json;
  assert.deepEqual(pedido.datos.aprendizaje, nuevo.pedido.datos.aprendizaje);
  assert.equal(pedido.datos.tema, 'Una pregunta nueva');
});

test('e2e: aprendizaje toma las doce lecciones más recientes sin depender del orden de la tabla', () => {
  const jobs = Array.from({ length: 15 }, (_, i) => trabajo('l-' + i, 'aprender', { resumen: 'Observación ' + i }, { createdAt: new Date(Date.parse(fecha) + i * 1000).toISOString() })).reverse();
  const nodes = { Inicio: [{}], 'Buscar canal': [{ canal_id: 'c-uno' }], 'Buscar biblia': [{}], 'Aprendizaje del canal': jobs };
  const out = ejecutar(code('FabOrquestador01', 'Nuevo video'), nodes)[0].json.pedido.datos.aprendizaje;
  assert.equal(out.length, 12);
  assert.equal(out[0].id, 'l-3');
  assert.equal(out.at(-1).id, 'l-14');
});

test('e2e: las métricas conservan guion corregido y shotlist del video y canal medidos', () => {
  const jobs = [
    trabajo('guion-1', 'guion', { titulo: 'Original', guion: 'Texto anterior' }),
    trabajo('guion-2', 'corregir_guion', { titulo: 'Revisado', guion: 'Texto aprobado', ganchos: [{ texto: '¿Por qué?', formula: 'pregunta' }], gancho_elegido: 0 }, { updatedAt: '2026-11-21T13:00:00Z' }),
    trabajo('story-1', 'storyboard', { planos: [{ id: 'p01', tipo: 'imagen', texto_narrado: 'Texto aprobado', prompt_imagen: 'No necesita viajar al analista' }] }),
    trabajo('guion-ajeno', 'guion', { guion: 'AJENO' }, { canal_id: 'c-otro', updatedAt: '2026-11-21T14:00:00Z' }),
    trabajo('story-pendiente', 'storyboard', { planos: [{ id: 'pendiente' }] }, { estado: 'enviado', updatedAt: '2026-11-21T14:00:00Z' }),
  ];
  const video = { video_id: 'v-uno', canal_id: 'c-uno', dias: 2 };
  const nodes = {
    'Guiones y storyboards de aprendizaje': jobs,
    'Pedidos de retención': [video], Retención: [{ rows: [[0, 0.8], [1, 0.6]] }],
    'Toca medir en redes': [{ ...video, request_id: 'post-1', plataformas: 'tiktok' }],
    'Métricas en redes': [{ platforms: { tiktok: { success: true, post_metrics: { views: 300 } } } }],
  };
  const datos = ejecutar(code('FabAprendizaje01', 'Pedir lecciones'), nodes)[0].json.datos;
  for (const v of [...datos.videos, ...datos.redes]) {
    assert.equal(v.guion.texto, 'Texto aprobado');
    assert.equal(v.shotlist[0].id, 'p01');
    assert.equal(v.shotlist[0].texto_narrado, 'Texto aprobado');
    assert.equal(v.contexto_incompleto, false);
    assert.equal(v.tiempos_planos_disponibles, false);
    assert.doesNotMatch(JSON.stringify(v), /AJENO|prompt_imagen|pendiente/);
  }
  assert.deepEqual(datos.videos[0].retencion, [[0, 0.8], [1, 0.6]]);
  assert.equal(datos.redes[0].metricas.platforms.tiktok.post_metrics.views, 300);
});

test('e2e: ausencia o corrupción de trabajos no inventa guion ni tiempos', () => {
  const nodes = {
    'Guiones y storyboards de aprendizaje': [trabajo('roto', 'guion', {}, { resultado: '{incompleto' })],
    'Pedidos de retención': [{ video_id: 'v-uno', canal_id: 'c-uno', dias: 7 }],
    Retención: [{ rows: [] }],
  };
  const video = ejecutar(code('FabAprendizaje01', 'Pedir lecciones'), nodes)[0].json.datos.videos[0];
  assert.equal(video.contexto_incompleto, true);
  assert.equal(video.guion.texto, '');
  assert.deepEqual(video.shotlist, []);
  assert.equal(video.tiempos_planos_disponibles, false);
});

test('e2e: listas de aprendizaje con elementos nulos o inválidos conservan las lecciones válidas', () => {
  const resultado = {
    resumen: 'La pregunta aclara el gancho.',
    lecciones: [null, [], 3, false, { regla: 'Mostrar el cambio al inicio.' }, 'Una pregunta concreta mejora la apertura.'],
    ganchos: [null, {}, 2, { gancho: 'Pregunta concreta' }],
    temas: [null, [], { tema: 'Luz natural' }],
  };
  const jobs = [trabajo('aprender-con-nulos', 'aprender', resultado)];
  const proyectadas = ejecutar(observabilidad + "return leccionesCooper({canal_id:'c-uno'}, $input.all().map(i=>i.json));", {}, jobs);
  assert.equal(proyectadas.length, 1);
  assert.match(proyectadas[0].resumen, /Mostrar el cambio al inicio/);
  assert.ok(proyectadas[0].ganchos.includes('Pregunta concreta'));
  assert.deepEqual(proyectadas[0].temas, ['Luz natural']);
  const nodes = { Inicio: [{}], 'Buscar canal': [{ canal_id: 'c-uno' }], 'Buscar biblia': [{}], 'Aprendizaje del canal': jobs };
  const pedido = ejecutar(code('FabOrquestador01', 'Nuevo video'), nodes)[0].json.pedido;
  assert.equal(pedido.datos.aprendizaje[0].id, 'aprender-con-nulos');
});

test('e2e: shotlist con elementos nulos o inválidos conserva los planos válidos', () => {
  const nodes = {
    'Guiones y storyboards de aprendizaje': [
      trabajo('guion-valido', 'guion', { titulo: 'Luz', guion: 'Mira la luz.' }),
      trabajo('story-mixto', 'storyboard', { planos: [null, [], 'plano inválido', 2, false, { id: 'p01', tipo: 'imagen', texto_narrado: 'Mira la luz.' }] }),
    ],
    'Pedidos de retención': [{ video_id: 'v-uno', canal_id: 'c-uno', dias: 2 }],
    Retención: [{ rows: [[0, 0.8]] }],
  };
  const video = ejecutar(code('FabAprendizaje01', 'Pedir lecciones'), nodes)[0].json.datos.videos[0];
  assert.equal(video.shotlist.length, 1);
  assert.equal(video.shotlist[0].id, 'p01');
  assert.equal(video.contexto_incompleto, false);
  nodes['Guiones y storyboards de aprendizaje'][1].resultado = JSON.stringify({ resultado: { planos: [null] } });
  const incompleto = ejecutar(code('FabAprendizaje01', 'Pedir lecciones'), nodes)[0].json.datos.videos[0];
  assert.deepEqual(incompleto.shotlist, []);
  assert.equal(incompleto.contexto_incompleto, true);
});

test('e2e: las lecturas nuevas están conectadas antes del consumidor sin cambiar sus entradas', () => {
  const orq = workflow('FabOrquestador01'), aprende = workflow('FabAprendizaje01');
  const edges = (wf, from) => (wf.connections[from]?.main || []).flat().map(e => e.node);
  assert.ok(edges(orq, 'Aprendizaje del canal').includes('Temas recientes del canal'));
  assert.ok(edges(orq, 'Temas recientes del canal').includes('Nuevo video'));
  assert.ok(edges(aprende, 'Guiones y storyboards de aprendizaje').includes('Publicaciones'));
  const lectura = orq.nodes.find(n => n.name === 'Aprendizaje del canal');
  assert.ok(lectura.parameters.filters.conditions.some(c => c.keyName === 'canal_id'));
  assert.equal(lectura.alwaysOutputData, true);
});
