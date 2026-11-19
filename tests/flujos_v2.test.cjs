// Pruebas de la lógica de los nodos Code de los flujos v2 con datos ficticios.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'workflows', 'v2');
const wf = id => JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
const codeOf = (w, name) => w.nodes.find(n => n.name === name).parameters.jsCode;

function run(js, { nodes = {}, json = {}, all = {} } = {}) {
  const $ = name => ({
    first: () => ({ json: nodes[name] }), item: { json: nodes[name] },
    all: () => (all[name] || [nodes[name]]).map(j => ({ json: j })),
  });
  const $input = { all: () => (all.$input || []).map(j => ({ json: j })) };
  const fn = new Function('$', '$json', '$input', '$now', js);
  return fn($, json, $input, { toFormat: () => '2026-11-19' });
}

const ORQ = wf('FabOrquestador01'), CL = wf('FabLlamarClaude1'), RET = wf('FabRetornoClaud1');
const PROD = wf('FabProduccion001'), PUB = wf('FabPublicacion01'), AJ = wf('FabAjustes000001');
const aj = run(codeOf(AJ, 'Ajustes'))[0].json;

test('ajustes: todo lo que gasta empieza apagado', () => {
  for (const k of ['allowImagenes', 'allowRevisionVisual', 'allowVeo', 'allowAvatar', 'allowMontaje', 'allowDrive', 'allowYoutube', 'allowAnalytics'])
    assert.strictEqual(aj[k], false, k);
  assert.match(aj.routineUrl, /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]+\/fire$/);
});

test('llamar a Claude: job_id válido para el retorno y modo controlado', () => {
  const out = run(codeOf(CL, 'Preparar trabajo'), { nodes: { Inicio: { modo: 'guion', video_id: 'v-1', datos: { tema: 'x' } }, 'Leer ajustes': aj } })[0].json;
  assert.match(out.job_id, /^[a-z_]+-[a-z0-9]+-[a-z0-9]+$/);
  assert.strictEqual(out.payload.contrato, 'fabrica-v2');
  assert.strictEqual(out.fila.estado, 'enviado');
  assert.throws(() => run(codeOf(CL, 'Preparar trabajo'), { nodes: { Inicio: { modo: 'borrar_todo' }, 'Leer ajustes': aj } }));
});

test('retorno: rechaza cuerpos inválidos y acepta el contrato', () => {
  const ok = run(codeOf(RET, 'Validar'), { json: { body: { job_id: 'guion-abc12-xyz9', modo: 'guion', estado: 'ok', resultado: {} } } })[0].json;
  assert.strictEqual(ok.valido, true);
  const malo = run(codeOf(RET, 'Validar'), { json: { body: { job_id: '../x', modo: 'guion', estado: 'ok' } } })[0].json;
  assert.strictEqual(malo.valido, false);
});

test('orquestador: cada evento cae en su salida', () => {
  const rutas = (e) => run(codeOf(ORQ, 'Ruta'), { nodes: { Inicio: e } })[0].json;
  assert.strictEqual(rutas({ evento: 'nuevo_canal' }).salida, 0);
  assert.strictEqual(rutas({ evento: 'claude_ok', modo: 'corregir_guion' }).clave, 'claude_ok:guion');
  assert.strictEqual(rutas({ evento: 'aprobado', etapa: 'final' }).salida, 13);
  const sw = ORQ.nodes.find(n => n.name === 'Según evento').parameters.numberOutputs;
  assert.strictEqual(rutas({ evento: 'cualquier_cosa' }).salida, sw - 1);
});

test('orquestador: id de canal limpio a partir del nombre', () => {
  const out = run(codeOf(ORQ, 'Nuevo canal'), { json: { contexto: { canal: { nombre_propuesto: 'Misterios Ánimas & Co', formatos: ['short'] } } }, nodes: { 'Leer ajustes': aj } })[0].json;
  assert.match(out.canal_id, /^misterios-animas-co-[a-z0-9]{4}$/);
  assert.strictEqual(out.formato_defecto, 'short');
});

test('mensajes de Telegram nunca pasan el límite de 4096', () => {
  const largo = 'x'.repeat(10000);
  for (const [n, json] of [['Mensaje de canal', { resultado: { canal: { nombre_propuesto: largo }, evidencia: [], primeros_temas: [] } }],
    ['Mensaje de guion', { resultado: { titulo: largo, guion: largo, rubrica: { gancho: 9 } } }],
    ['Mensaje de storyboard', { resultado: { planos: Array.from({ length: 80 }, (_, i) => ({ id: 'p' + i, tipo: 'imagen', encuadre: 'medio', texto_narrado: largo })) } }]])
    assert.ok(run(codeOf(ORQ, n), { json })[0].json.mensaje.length <= 3900, n);
});

const storyboard = { planos: [
  { id: 'p01', tipo: 'imagen', texto_narrado: '[énfasis] Hola [pausa] mundo', prompt_imagen: 'un faro', encuadre: 'general', luz: 'dorada', personajes: ['ana'], escenario: 'faro', movimiento: 'zoom lento', transicion: 'corte' },
  { id: 'p02', tipo: 'clip', texto_narrado: 'Ola', prompt_imagen: 'ola', encuadre: 'detalle', luz: 'fría', personajes: [], escenario: 'faro', movimiento: 'paneo', transicion: 'fundido' }] };
const biblia = { estilo_visual: { descripcion: 'óleo', paleta_hex: ['#112233'] }, personajes: [{ id: 'ana', referencias_urls: ['https://r/ana.png'] }], escenarios: [{ id: 'faro', referencias_urls: ['https://r/faro.png'] }], voz: { eleven_voice_id: 'V1' } };

test('producción: con todo apagado no gasta y avisa qué falta', () => {
  const out = run(codeOf(PROD, 'Plan de producción'), { nodes: { Inicio: { video_id: 'v', storyboard, biblia, presupuesto_usd: 5 }, 'Leer ajustes': aj } })[0].json;
  assert.ok(out.faltan.length >= 3);
  assert.strictEqual(out.costo_estimado_usd, +(aj.costoImagenUsd + 8 * aj.costoClipSegUsd).toFixed(2));
});

test('producción: freno de presupuesto', () => {
  const caro = { planos: Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, tipo: 'clip' })) };
  const out = run(codeOf(PROD, 'Plan de producción'), { nodes: { Inicio: { storyboard: caro, presupuesto_usd: 5 }, 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(out.dentro, false);
});

test('producción: cada plano lleva sus referencias de la biblia', () => {
  const items = run(codeOf(PROD, 'Un ítem por plano'), { nodes: { 'Plan de producción': { video_id: 'v', planos: storyboard.planos, biblia } } });
  assert.deepStrictEqual(items[0].json.referencias, ['https://r/ana.png', 'https://r/faro.png']);
  assert.strictEqual(items[1].json.salida, 1);
  assert.match(items[0].json.prompt, /Sin texto ni logos/);
});

test('producción: composición en el orden del storyboard y con voz por escena', () => {
  const out = run(codeOf(PROD, 'Composición Creatomate'), {
    json: { planos: [{ plano_id: 'p02', url: 'https://x/clip.mp4', plano: storyboard.planos[1] }, { plano_id: 'p01', url: 'https://x/a.png', plano: storyboard.planos[0] }] },
    nodes: { 'Plan de producción': { video_id: 'v', planos: storyboard.planos, biblia, formato: 'largo' }, 'Leer ajustes': aj } })[0].json;
  assert.deepStrictEqual(out.source.elements.map(e => e.name), ['p01', 'p02']);
  assert.strictEqual(out.source.elements[1].elements[0].type, 'video');
  assert.match(out.source.elements[0].elements[1].provider, /voice_id=V1/);
  assert.strictEqual(out.source.width, 1920);
  assert.strictEqual(out.source.elements[0].elements[1].source, 'Hola … mundo');
});

test('calidad: detecta planos faltantes y duración corta', () => {
  const out = run(codeOf(PUB, 'Chequeos objetivos'), { nodes: { Inicio: { render_url: 'u', planos: 8, esperados: 10, duracion_s: 60, formato: 'largo' } } })[0].json;
  assert.strictEqual(out.aprobado_qc, false);
  assert.strictEqual(out.fallas.length, 2);
});
