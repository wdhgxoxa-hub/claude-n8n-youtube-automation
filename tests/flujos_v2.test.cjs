// Pruebas de la lógica de los nodos Code de los flujos v2 con datos ficticios.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'workflows', 'v2');
const wf = id => JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
const codeOf = (w, name) => w.nodes.find(n => n.name === name).parameters.jsCode;

function run(js, { nodes = {}, json = {}, all = {}, binary = {} } = {}) {
  // Simula el entorno de un nodo Code de n8n: $('Nodo') con first/last/item/all/isExecuted, $json, $input.
  const $ = name => ({
    first: () => ({ json: nodes[name] }), last: () => ({ json: nodes[name] }), item: { json: nodes[name] },
    all: () => (all[name] || (nodes[name] === undefined ? [] : [nodes[name]])).map(j => ({ json: j })),
    isExecuted: nodes[name] !== undefined || all[name] !== undefined,
  });
  const $input = { all: () => (all.$input || [json]).map(j => ({ json: j })), item: { json, binary } };
  const fn = new Function('$', '$json', '$input', '$now', '$binary', js);
  const r = fn($, json, $input, { toFormat: () => '2026-11-19' }, binary);
  return Array.isArray(r) ? r : [r];
}

const ORQ = wf('FabOrquestador01'), CL = wf('FabLlamarClaude1'), RET = wf('FabRetornoClaud1');
const PROD = wf('FabProduccion001'), PUB = wf('FabPublicacion01'), AJ = wf('FabAjustes000001');
const aj = run(codeOf(AJ, 'Ajustes'))[0].json;

test('ajustes: todo lo que gasta empieza apagado', () => {
  for (const k of ['allowImagenes', 'allowRevisionVisual', 'allowClips', 'allowAvatar', 'allowMontaje', 'allowDrive', 'allowYoutube', 'allowAnalytics'])
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
    assert.ok(run(codeOf(ORQ, n), { json, nodes: { Inicio: json } })[0].json.mensaje.length <= 3900, n);
});

const storyboard = { planos: [
  { id: 'p01', tipo: 'imagen', texto_narrado: '[énfasis] Hola [pausa] mundo', prompt_imagen: 'un faro', encuadre: 'general', luz: 'dorada', personajes: ['ana'], escenario: 'faro', movimiento: 'zoom lento', transicion: 'corte' },
  { id: 'p02', tipo: 'clip', texto_narrado: 'Ola', prompt_imagen: 'ola', encuadre: 'detalle', luz: 'fría', personajes: [], escenario: 'faro', movimiento: 'paneo', transicion: 'fundido' }] };
const biblia = { estilo_visual: { descripcion: 'óleo', paleta_hex: ['#112233'] }, personajes: [{ id: 'ana', referencias_urls: ['https://r/ana.png'] }], escenarios: [{ id: 'faro', referencias_urls: ['https://r/faro.png'] }], voz: { eleven_voice_id: 'V1' } };

test('producción: con todo apagado no gasta y avisa qué falta', () => {
  const out = run(codeOf(PROD, 'Plan de producción'), { nodes: { Inicio: { video_id: 'v', storyboard, biblia, presupuesto_usd: 5 }, 'Leer ajustes': aj } })[0].json;
  assert.ok(out.faltan.length >= 3);
  assert.strictEqual(out.costo_estimado_usd, +(2 * aj.costoImagenUsd + 8 * aj.costoClipSegUsd).toFixed(2)); // el clip parte de una imagen
});

test('producción: freno de presupuesto', () => {
  const caro = { planos: Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, tipo: 'clip' })) };
  const out = run(codeOf(PROD, 'Plan de producción'), { nodes: { Inicio: { storyboard: caro, presupuesto_usd: 5 }, 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(out.dentro, false);
});

test('producción: cada plano lleva sus referencias de la biblia', () => {
  const items = run(codeOf(PROD, 'Un ítem por plano'), { nodes: { 'Plan de producción': { video_id: 'v', planos: storyboard.planos, biblia } } });
  assert.deepStrictEqual(items[0].json.referencias, ['https://r/ana.png', 'https://r/faro.png']);
  assert.strictEqual(items[1].json.salida, 0); // el clip parte de una imagen
  assert.match(items[0].json.prompt, /Sin texto ni logos/);
});

test('producción: composición sigue el storyboard, dura lo que la voz y pone la música debajo', () => {
  const planos = [{ plano_id: 'p02', url: 'https://x/clip', plano: storyboard.planos[1] }, { plano_id: 'p01', url: 'https://x/a.png', plano: storyboard.planos[0] },
    { plano_id: 'p03', url: 'https://pexels/v.mp4', plano: { id: 'p03', tipo: 'archivo' }, fuente: { banco: 'Pexels', autor: 'Ana', pagina: 'https://pexels/1' } }];
  const out = run(codeOf(PROD, 'Composición Creatomate'), {
    json: { voces: [{ plano_id: 'p01', url: 'https://d/v1', duracion_s: 3 }, { plano_id: 'p02', url: 'https://d/v2', duracion_s: 4.5 }, { plano_id: 'p03', url: 'https://d/v3', duracion_s: 2 }],
      musica: { url: 'https://epi/m.mp3', credito: 'Música: X' } },
    nodes: { 'Plan de producción': { video_id: 'v', planos: [...storyboard.planos, { id: 'p03', tipo: 'archivo' }], biblia, formato: 'short' }, 'Juntar planos': { planos } } })[0].json;
  const els = out.source.elements;
  assert.deepStrictEqual(els.filter(e => e.type === 'composition').map(e => e.name), ['p01', 'p02', 'p03']);
  assert.strictEqual(els[0].duration, 3.35);
  assert.strictEqual(els[1].elements[0].type, 'video');
  assert.strictEqual(els[2].elements[0].type, 'video');
  assert.strictEqual(els[0].elements[1].source, 'https://d/v1');
  const musica = els.find(e => e.track === 2);
  assert.strictEqual(musica.duration, Math.round((3.35 + 4.85 + 2.35) * 100) / 100);
  assert.strictEqual(out.source.width, 1080);
  assert.deepStrictEqual(out.creditos, ['Música: X', 'Pexels: Ana (https://pexels/1)']);
});

const SON = wf('FabSonido0000001');
test('sonido: la actuación va en «style» y en etiquetas; el texto no lleva instrucciones', () => {
  const items = run(codeOf(SON, 'Textos de voz'), { nodes: { Inicio: { video_id: 'v', biblia: { voz: { descripcion: 'grave' } },
    planos: [{ plano_id: 'p01', plano: { texto_narrado: '[énfasis] 1901. [pausa] Abramos el [énfasis] expediente. [susurro]', emocion: 'intriga' } }] }, 'Leer ajustes': aj } });
  const j = items[0].json;
  assert.strictEqual(j.texto, '1901. <short pause> Abramos el EXPEDIENTE.');
  assert.match(j.estilo, /grave, con intriga, en voz baja, casi un susurro, en español latino neutro/);
  assert.strictEqual(j.voz, aj.vozGemini);
});

function wavDe(muestras, rate = 24000) {
  const pcm = Buffer.alloc(muestras.length * 2); muestras.forEach((m, i) => pcm.writeInt16LE(m, i * 2));
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]);
}
test('sonido: el WAV de Gemini se lee, se recortan silencios y se mide la duración', () => {
  // 1 s de silencio + 2 s de voz + 1 s de silencio, a 24 kHz
  const m = [...Array(24000).fill(0), ...Array(48000).fill(3000), ...Array(24000).fill(0)];
  const out = run(codeOf(SON, 'WAV'), { json: { steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wavDe(m).toString('base64') }] }] },
    nodes: { 'Textos de voz': { plano_id: 'p01', video_id: 'v', texto: 'uno dos tres cuatro cinco seis' } } })[0];
  assert.ok(Math.abs(out.json.duracion_s - 2.24) < 0.02, String(out.json.duracion_s)); // 2 s + márgenes de 0,12 s
  const wav = Buffer.from(out.binary.archivo.data, 'base64');
  assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(wav.readUInt32LE(24), 24000);
  assert.strictEqual(wav.readUInt32LE(40), wav.length - 44);
});
test('sonido: también acepta PCM crudo', () => {
  const pcm = Buffer.alloc(24000 * 2); for (let i = 0; i < 24000; i++) pcm.writeInt16LE(2000, i * 2);
  const out = run(codeOf(SON, 'WAV'), { json: { steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/l16;rate=24000', data: pcm.toString('base64') }] }] },
    nodes: { 'Textos de voz': { plano_id: 'p01', video_id: 'v', texto: 'hola' } } })[0];
  assert.ok(Math.abs(out.json.duracion_s - 1) < 0.01);
});

test('producción: de Pexels elige un video en la orientación del formato', () => {
  const resp = { videos: [{ duration: 10, user: { name: 'Ana' }, url: 'https://pexels/1', video_files: [
    { link: 'https://h.mp4', width: 1920, height: 1080 }, { link: 'https://v.mp4', width: 1080, height: 1920 }] }] };
  const corto = run(codeOf(PROD, 'Elegir de Pexels'), { json: resp, nodes: { 'Un ítem por plano': { plano: { id: 'p1' } }, 'Plan de producción': { formato: 'short' } } })[0].json;
  assert.strictEqual(corto.url, 'https://v.mp4');
  const largo = run(codeOf(PROD, 'Elegir de Pexels'), { json: resp, nodes: { 'Un ítem por plano': { plano: { id: 'p1' } }, 'Plan de producción': { formato: 'largo' } } })[0].json;
  assert.strictEqual(largo.url, 'https://h.mp4');
  const nada = run(codeOf(PROD, 'Elegir de Pexels'), { json: { videos: [] }, nodes: { 'Un ítem por plano': { plano: { id: 'p1' } }, 'Plan de producción': { formato: 'largo' } } })[0].json;
  assert.strictEqual(nada.url, '');
});

test('calidad: detecta planos faltantes y duración corta', () => {
  const out = run(codeOf(PUB, 'Chequeos objetivos'), { nodes: { Inicio: { render_url: 'u', planos: 8, esperados: 10, duracion_s: 60, formato: 'largo' } } })[0].json;
  assert.strictEqual(out.aprobado_qc, false);
  assert.strictEqual(out.fallas.length, 2);
});

// ---------------------------------------------------------------------------------------
// Pruebas de las piezas nuevas (subtítulos, costos, crítico, correcciones, biblia, referencias…)
// ---------------------------------------------------------------------------------------
const REF = wf('FabReferencias01'), EST = wf('FabEstado0000001'), APR = wf('FabAprendizaje01');
const sse = obj => 'event: message\ndata: ' + JSON.stringify({ result: { content: [{ type: 'text', text: JSON.stringify(obj) }] } });

test('montaje: Short con subtítulos repartidos en la voz; largo con título de capítulo; efectos y estilo de la biblia', () => {
  const plano = { id: 'p01', tipo: 'imagen', texto_narrado: '[énfasis] Uno dos tres cuatro cinco seis siete ocho.', capitulo: 'El hallazgo', movimiento: 'zoom lento' };
  const base = { video_id: 'v', planos: [plano], biblia: { montaje: { musica_volumen: '12%', fuente: 'Inter' } } };
  const son = { voces: [{ plano_id: 'p01', url: 'https://d/v1', duracion_s: 4 }], musica: { url: 'https://m', credito: 'Música: X' },
    efectos: [{ plano: 'p01', url: 'https://fx', duracion_s: 2, credito: 'Efectos: E' }, { plano: 'p01', url: 'https://fx2', duracion_s: 9, credito: 'Efectos: E' }] };
  const corto = run(codeOf(PROD, 'Composición Creatomate'), { json: son, nodes: { 'Plan de producción': { ...base, formato: 'short' }, 'Juntar planos': { planos: [{ plano_id: 'p01', url: 'https://i', plano }] } } })[0].json;
  const esc = corto.source.elements[0].elements;
  const subs = esc.filter(e => e.type === 'text');
  assert.strictEqual(subs.length, 2);                                   // 8 palabras en trozos de 4
  assert.strictEqual(subs[0].text, 'Uno dos tres cuatro');                // sin marcas
  assert.ok(Math.abs(subs.reduce((a, x) => a + x.duration, 0) - 4) < 0.05); // cubren la voz
  assert.strictEqual(subs[0].font_family, 'Inter');
  assert.ok(!esc.some(e => e.text === 'El hallazgo'));                   // sin capítulo en Shorts
  const fx = esc.filter(e => e.type === 'audio' && e.source.startsWith('https://fx'));
  assert.strictEqual(fx.length, 2); assert.strictEqual(fx[1].duration, 4.35); // un efecto largo no pasa la escena
  assert.strictEqual(corto.source.elements.find(e => e.track === 2).volume, '12%');
  assert.deepStrictEqual(corto.creditos, ['Música: X', 'Efectos: E']);
  const largo = run(codeOf(PROD, 'Composición Creatomate'), { json: son, nodes: { 'Plan de producción': { ...base, formato: 'largo' }, 'Juntar planos': { planos: [{ plano_id: 'p01', url: 'https://i', plano }] } } })[0].json;
  const el = largo.source.elements[0].elements;
  assert.ok(el.some(e => e.text === 'El hallazgo'));
  assert.strictEqual(el.filter(e => e.type === 'text').length, 1);       // largo: sin subtítulos por defecto
  assert.strictEqual(largo.subtitulos, false);
});

test('producción: gasto real por planos (repeticiones y revisiones) y aviso al 80 %', () => {
  const planos = [{ plano: { tipo: 'imagen' }, intento: 2, revisiones: 2 }, { plano: { tipo: 'clip' }, intento: 1 }, { plano: { tipo: 'archivo' }, intento: 0 }];
  const g = run(codeOf(PROD, 'Gasto de planos'), { nodes: { 'Leer ajustes': aj, 'Plan de producción': { presupuesto: 1.5 }, 'Juntar planos': { planos } } })[0].json;
  assert.strictEqual(g.imagenes, 3); assert.strictEqual(g.clips, 1); assert.strictEqual(g.revisiones, 2);
  assert.strictEqual(g.usd, Math.round((3 * aj.costoImagenUsd + 8 * aj.costoClipSegUsd + 2 * aj.costoRevisionUsd) * 100) / 100);
  assert.strictEqual(g.aviso, false);                                       // 1,16 de 1,5 = 77 % < 80 %
  assert.strictEqual(run(codeOf(PROD, 'Gasto de planos'), { nodes: { 'Leer ajustes': aj, 'Plan de producción': { presupuesto: 1.4 }, 'Juntar planos': { planos } } })[0].json.aviso, true);
  const barato = run(codeOf(PROD, 'Gasto de planos'), { nodes: { 'Leer ajustes': aj, 'Plan de producción': { presupuesto: 5 }, 'Juntar planos': { planos } } })[0].json;
  assert.strictEqual(barato.aviso, false);
});

test('producción: una fila por plano y una por concepto de costo', () => {
  const planos = [{ video_id: 'v', plano_id: 'p1', url: 'u', plano: { tipo: 'imagen' }, intento: 1 }, { video_id: 'v', plano_id: 'p2', url: '', plano: { tipo: 'avatar' }, intento: 0 }];
  const filas = run(codeOf(PROD, 'Filas de planos'), { nodes: { 'Leer ajustes': aj, 'Juntar planos': { planos } } });
  assert.strictEqual(filas.length, 2); assert.strictEqual(filas[1].json.estado, 'pendiente'); assert.strictEqual(filas[0].json.costo_usd, aj.costoImagenUsd);
  const costos = run(codeOf(PROD, 'Costos del video'), { nodes: { 'Leer ajustes': aj, 'Gasto de planos': { imagenes: 3, clips: 0, revisiones: 0 },
    'Sonido y emoción': { voces: [1, 2, 3] }, 'Plan de producción': { video_id: 'v' } } }).map(i => i.json);
  assert.deepStrictEqual(costos.map(c => c.concepto), ['imágenes', 'voz', 'música', 'efectos', 'montaje']);
  assert.ok(costos.every(c => c.video_id === 'v'));
});

test('calidad: sincronía, subtítulos de Short y ritmo de voz', () => {
  const base = { render_url: 'u', planos: 5, esperados: 5, duracion_s: 50, duracion_estimada_s: 50.4, formato: 'short', subtitulos: true, ancho: 1080, alto: 1920,
    voces: [{ plano_id: 'p1', ppm: 140 }, { plano_id: 'p2', ppm: 80 }], usa_musica: true, creditos: ['Música: «X», cortesía de Epidemic Sound'], costo_usd: 1, presupuesto: 1.5 };
  const ok = run(codeOf(PUB, 'Chequeos objetivos'), { nodes: { Inicio: base } })[0].json;
  assert.strictEqual(ok.aprobado_qc, true); assert.match(ok.avisos[0], /lenta.*p2/);
  const malo = run(codeOf(PUB, 'Chequeos objetivos'), { nodes: { Inicio: { ...base, duracion_s: 55, subtitulos: false, creditos: [], ancho: 1920, alto: 1080 } } })[0].json;
  assert.strictEqual(malo.aprobado_qc, false);
  assert.ok(malo.fallas.some(f => /sincronía/.test(f)) && malo.fallas.some(f => /subtítulos/.test(f)) && malo.fallas.some(f => /crédito/.test(f)) && malo.fallas.some(f => /resolución/.test(f)));
});

test('crítico: pasa con ≥8 en todo, pide reescritura si no, y no bloquea si responde mal', () => {
  const resp = k => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(k) }] }] });
  const bien = run(codeOf(ORQ, 'Veredicto del crítico'), { json: resp({ gancho: 9, promesa: 8, claridad: 9, emocion: 8, exactitud: 10, originalidad: 9 }) })[0].json;
  assert.strictEqual(bien.pasa, true);
  const flojo = run(codeOf(ORQ, 'Veredicto del crítico'), { json: resp({ gancho: 6, promesa: 8, claridad: 9, emocion: 8, exactitud: 9, originalidad: 9, instrucciones: 'abre con una pregunta' }) })[0].json;
  assert.strictEqual(flojo.pasa, false); assert.match(flojo.instrucciones, /pregunta/);
  const roto = run(codeOf(ORQ, 'Veredicto del crítico'), { json: { error: 'x' } })[0].json;
  assert.strictEqual(roto.pasa, true); assert.strictEqual(roto.leido, false);
});

test('corregir: toma la última versión lista del guion (incluidas correcciones) y la manda a cambios', () => {
  const trabajos = [
    { job_id: 'a', modo: 'guion', estado: 'listo', createdAt: '2026-11-19T10:00:00Z', canal_id: 'c', resultado: JSON.stringify({ resultado: { titulo: 'v1' } }) },
    { job_id: 'b', modo: 'corregir_guion', estado: 'listo', createdAt: '2026-11-19T11:00:00Z', canal_id: 'c', resultado: JSON.stringify({ resultado: { titulo: 'v2' } }) },
    { job_id: 'c', modo: 'storyboard', estado: 'enviado', createdAt: '2026-11-19T12:00:00Z', canal_id: 'c', resultado: '' }];
  const out = run(codeOf(ORQ, 'Última versión'), { nodes: { Inicio: { video_id: 'v', etapa: 'guion', instruccion: 'más corto' } }, all: { $input: trabajos } })[0].json;
  assert.strictEqual(out.hay, true); assert.strictEqual(out.contexto.titulo, 'v2'); assert.strictEqual(out.evento, 'cambios'); assert.strictEqual(out.cambios, 'más corto');
  const sb = run(codeOf(ORQ, 'Última versión'), { nodes: { Inicio: { video_id: 'v', etapa: 'storyboard' } }, all: { $input: trabajos } })[0].json;
  assert.strictEqual(sb.hay, false);
});

test('ajustar_biblia: campos anidados, listas y rechazo de campos peligrosos', () => {
  const fila = { job_id: 'j', resultado: JSON.stringify({ resultado: { voz: { descripcion: 'grave' }, lecciones: ['a'] } }) };
  const r1 = run(codeOf(ORQ, 'Aplicar ajuste'), { json: fila, nodes: { Inicio: { campo: 'voz.descripcion', valor: 'cálida y lenta' } } })[0].json;
  assert.strictEqual(JSON.parse(r1.resultado).resultado.voz.descripcion, 'cálida y lenta');
  const r2 = run(codeOf(ORQ, 'Aplicar ajuste'), { json: fila, nodes: { Inicio: { campo: 'lecciones', valor: 'b' } } })[0].json;
  assert.deepStrictEqual(JSON.parse(r2.resultado).resultado.lecciones, ['a', 'b']);
  const r3 = run(codeOf(ORQ, 'Aplicar ajuste'), { json: fila, nodes: { Inicio: { campo: 'montaje.musica_volumen', valor: '"10%"' } } })[0].json;
  assert.strictEqual(JSON.parse(r3.resultado).resultado.montaje.musica_volumen, '10%');
  assert.strictEqual(run(codeOf(ORQ, 'Aplicar ajuste'), { json: fila, nodes: { Inicio: { campo: 'canal_id', valor: 'x' } } })[0].json.ok, false);
  assert.strictEqual(run(codeOf(ORQ, 'Aplicar ajuste'), { json: fila, nodes: { Inicio: { campo: '__proto__.x', valor: 'x' } } })[0].json.ok, false);
});

test('programar: solo fechas entre 1 hora y 6 meses', () => {
  const en = h => new Date(Date.now() + h * 3600000).toISOString();
  assert.strictEqual(run(codeOf(ORQ, 'Validar fecha'), { nodes: { Inicio: { fecha: en(48) } } })[0].json.ok, true);
  assert.strictEqual(run(codeOf(ORQ, 'Validar fecha'), { nodes: { Inicio: { fecha: en(0.5) } } })[0].json.ok, false);
  assert.strictEqual(run(codeOf(ORQ, 'Validar fecha'), { nodes: { Inicio: { fecha: 'el viernes' } } })[0].json.ok, false);
});

test('sonido: efectos pedidos, elegidos y descargados; los que fallan se omiten', () => {
  const pedidos = run(codeOf(SON, 'Efectos pedidos'), { nodes: { 'Leer ajustes': aj, Inicio: { efectos: [{ plano: 'p1', efecto: 'bubbles' }, { plano: 'p2' }] } } });
  assert.strictEqual(pedidos.length, 1); assert.strictEqual(pedidos[0].json.termino, 'bubbles');
  assert.strictEqual(run(codeOf(SON, 'Efectos pedidos'), { nodes: { 'Leer ajustes': { ...aj, allowEfectos: false }, Inicio: { efectos: [{ plano: 'p1', efecto: 'x' }] } } })[0].json.ninguno, true);
  const busq = sse({ data: { soundEffects: { nodes: [{ soundEffect: { id: 'largo', audioFile: { durationInMilliseconds: 40000 } } }, { soundEffect: { id: 'ok', title: 'B', audioFile: { durationInMilliseconds: 3000 } } }] } } });
  const elegidos = run(codeOf(SON, 'Elegir efecto'), { all: { $input: [{ data: busq }, { data: 'roto' }], 'Efectos pedidos': [{ plano: 'p1', termino: 'b' }, { plano: 'p2', termino: 'c' }] } });
  assert.strictEqual(elegidos[0].json.id, 'ok'); assert.strictEqual(elegidos[0].json.duracion_s, 3); assert.strictEqual(elegidos[1].json.id, '');
  const listos = run(codeOf(SON, 'Efecto listo'), { all: { $input: [{ data: sse({ data: { downloadSoundEffect: { assetUrl: 'https://fx' } } }) }, { error: 'x' }], 'Elegir efecto': elegidos.map(e => e.json) } });
  assert.strictEqual(listos.length, 1); assert.strictEqual(listos[0].json.url, 'https://fx');
  const vacio = run(codeOf(SON, 'Efecto listo'), { all: { $input: [{ error: 'x' }], 'Elegir efecto': [{ plano: 'p', id: '' }] } });
  assert.strictEqual(vacio[0].json.vacio, true);
  const res = run(codeOf(SON, 'Resultado sonido'), { nodes: { 'Juntar voces': { voces: [1] }, 'Juntar efectos': { efectos: [{ vacio: true }, { url: 'https://fx' }] } } })[0].json;
  assert.strictEqual(res.musica, null); assert.deepStrictEqual(res.efectos, [{ url: 'https://fx' }]);
});

test('referencias: pasada principal solo para lo que falta, apagado avisa el costo, y las URL vuelven a la biblia', () => {
  const biblia = { estilo_visual: { descripcion: 'óleo' }, personajes: [{ id: 'ana', nombre: 'Ana', descripcion: 'buza' }, { id: 'luis', referencias_urls: ['x'] }], escenarios: [{ id: 'mar', descripcion: 'Egeo' }] };
  const fila = { job_id: 'j', resultado: JSON.stringify({ resultado: biblia }) };
  const off = run(codeOf(REF, 'Pedidos principales'), { json: fila, nodes: { 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(off.nada, true); assert.strictEqual(off.pendientes, 2); assert.strictEqual(off.costo, Math.round(4 * aj.costoImagenUsd * 100) / 100);
  const on = run(codeOf(REF, 'Pedidos principales'), { json: fila, nodes: { 'Leer ajustes': { ...aj, allowReferencias: true } } }).map(i => i.json);
  assert.deepStrictEqual(on.map(p => p.id + ':' + p.vista), ['ana:frente', 'mar:general']); assert.match(on[0].prompt, /óleo/);
  const vistas = run(codeOf(REF, 'Pedidos de vistas'), { nodes: { 'Juntar principal': { refs: [{ id: 'ana', clase: 'personaje', url: 'U1' }, { id: 'mar', clase: 'escenario', url: 'U2' }] } } }).map(i => i.json);
  assert.deepStrictEqual(vistas.map(v => v.vista), ['perfil', 'cuerpo entero']); assert.ok(vistas.every(v => v.referencia === 'U1'));
  const fin = run(codeOf(REF, 'Biblia con referencias'), { nodes: { Biblia: fila, 'Juntar principal': { refs: [{ id: 'ana', url: 'U1' }, { id: 'mar', url: 'U2' }] }, 'Juntar vista': { refs: [{ id: 'ana', url: 'U3' }] } } })[0].json;
  const b = JSON.parse(fin.resultado).resultado;
  assert.deepStrictEqual(b.personajes[0].referencias_urls, ['U1', 'U3']); assert.deepStrictEqual(b.escenarios[0].referencias_urls, ['U2']); assert.strictEqual(fin.total, 3);
});

test('reporte: por canal, con publicados y gasto real', () => {
  const vids = [{ video_id: 'a', canal_id: 'c1', etapa: 'publicado', estado: 'publicado', createdAt: new Date().toISOString() },
    { video_id: 'b', canal_id: 'c1', etapa: 'guion', estado: 'en_proceso', createdAt: new Date().toISOString() },
    { video_id: 'z', canal_id: 'c2', etapa: 'guion', estado: 'en_proceso', createdAt: '2020-01-01T00:00:00Z' }];
  const costos = [{ video_id: 'a', usd: 1.2 }, { video_id: 'a', usd: 0.1 }, { video_id: 'b', usd: 0.2 }];
  const r = run(codeOf(EST, 'Resumen'), { nodes: { Inicio: { tipo: 'reporte', dias: 30 } }, all: { Videos: vids, Costos: costos } })[0].json.resumen;
  assert.match(r, /c1: 2 videos, 1 publicados, US\$1\.5/); assert.doesNotMatch(r, /c2/);
  const e = run(codeOf(EST, 'Resumen'), { nodes: { Inicio: {} }, all: { Videos: vids, Costos: costos } })[0].json.resumen;
  assert.match(e, /^a · c1|^b · c1/);
});

test('producción: el encargo lleva el último guion listo para guardarlo en la carpeta del video', () => {
  const t = [{ modo: 'guion', estado: 'listo', createdAt: '1', resultado: JSON.stringify({ resultado: { titulo: 'v1' } }) },
    { modo: 'corregir_guion', estado: 'listo', createdAt: '2', resultado: JSON.stringify({ resultado: { titulo: 'v2' } }) }];
  const out = run(codeOf(ORQ, 'Encargo de producción'), { nodes: { Inicio: { video_id: 'v', canal_id: 'c', contexto: { planos: [] } }, 'Video (producción)': { formato: 'short', tema: 'T', presupuesto_usd: 1.5 },
    'Biblia (producción)': { resultado: '{}' } }, all: { 'Trabajos (producción)': t } })[0].json;
  assert.strictEqual(out.guion.titulo, 'v2'); assert.strictEqual(out.tema, 'T');
});

test('aprendizaje: solo mide los videos que cumplen 2 o 7 días', () => {
  const hace = d => new Date(Date.now() - d * 86400000 - 3600000).toISOString();
  const out = run(codeOf(APR, 'Toca medir'), { all: { $input: [{ video_id: 'a', youtube_id: 'y', publicado_en: hace(2) }, { video_id: 'b', youtube_id: 'y', publicado_en: hace(3) }, { video_id: 'c', youtube_id: 'y', publicado_en: hace(7) }] } });
  assert.deepStrictEqual(out.map(i => i.json.video_id), ['a', 'c']);
  assert.strictEqual(run(codeOf(APR, 'Toca medir'), { all: { $input: [] } })[0].json.nada, true);
});

// ---------------------------------------------------------------------------------------
// Varios canales de YouTube: cada canal de la fábrica con su propio permiso
// ---------------------------------------------------------------------------------------
const YT = wf('FabYouTube000001');
const ajYT = { ...aj, baseUrl: 'https://n8n.test', googleClientId: 'cli.apps.googleusercontent.com' };

test('youtube: el enlace lleva cliente, retorno, permisos, estado único y valida el id', () => {
  const a = run(codeOf(YT, 'Preparar enlace'), { json: {}, nodes: { Inicio: { canal_id: 'Expediente-Abierto-cjhz' }, 'Leer ajustes': ajYT } })[0].json;
  assert.strictEqual(a.valido, true); assert.strictEqual(a.canal_id, 'expediente-abierto-cjhz'); assert.strictEqual(a.existe, false);
  const u = new URL(a.url);
  assert.strictEqual(u.searchParams.get('client_id'), 'cli.apps.googleusercontent.com');
  assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://n8n.test/webhook/youtube-callback');
  assert.strictEqual(u.searchParams.get('access_type'), 'offline');
  assert.match(u.searchParams.get('scope'), /youtube\.upload.*yt-analytics\.readonly/);
  assert.strictEqual(u.searchParams.get('state'), 'expediente-abierto-cjhz.' + a.nonce); assert.strictEqual(a.nonce.length, 32);
  const b = run(codeOf(YT, 'Preparar enlace'), { json: { canal_id: 'x' }, nodes: { Inicio: { canal_id: 'expediente-abierto-cjhz' }, 'Leer ajustes': ajYT } })[0].json;
  assert.notStrictEqual(a.nonce, b.nonce); assert.strictEqual(b.existe, true);
  assert.strictEqual(run(codeOf(YT, 'Preparar enlace'), { json: {}, nodes: { Inicio: { canal_id: 'a b<script>' }, 'Leer ajustes': ajYT } })[0].json.valido, false);
});

test('youtube: la vuelta de Google solo vale con el estado pendiente y el nonce exacto (una vez)', () => {
  const vuelta = q => run(codeOf(YT, 'Leer vuelta'), { nodes: { 'Vuelta de Google': { query: q } } })[0].json;
  const v = vuelta({ state: 'canal-1.abc', code: 'C' });
  assert.deepStrictEqual([v.canal_id, v.nonce, v.code], ['canal-1', 'abc', 'C']);
  const val = (fila, vv = v) => run(codeOf(YT, 'Validar vuelta'), { json: fila, nodes: { 'Leer vuelta': vv } })[0].json;
  assert.strictEqual(val({ canal_id: 'canal-1', estado: 'pendiente', nonce: 'abc' }).ok, true);
  assert.strictEqual(val({ canal_id: 'canal-1', estado: 'pendiente', nonce: 'otro' }).ok, false);
  assert.strictEqual(val({ canal_id: 'canal-1', estado: 'conectado', nonce: '' }).ok, false);      // enlace ya usado
  assert.strictEqual(val({ canal_id: 'canal-1', estado: 'pendiente', nonce: '' }, { ...v, nonce: '' }).ok, false); // nonce vacío nunca vale
  assert.strictEqual(val({}).ok, false);
  assert.match(val({ canal_id: 'canal-1', estado: 'pendiente', nonce: 'abc' }, vuelta({ state: 'canal-1.abc', error: 'access_denied' })).motivo, /access_denied/);
});

test('youtube: guarda permiso duradero y canal; sin refresh_token o sin canal no conecta', () => {
  const fila = (tok, ch) => run(codeOf(YT, 'Fila conectada'), { json: ch, nodes: { 'Canjear código': tok } })[0].json;
  const ok = fila({ access_token: 'a', refresh_token: 'r' }, { items: [{ id: 'UC1', snippet: { title: 'Margen Real' } }] });
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.refresh_token, 'r'); assert.strictEqual(ok.canal_youtube_id, 'UC1'); assert.strictEqual(ok.estado, 'conectado'); assert.strictEqual(ok.nonce, '');
  assert.strictEqual(fila({ access_token: 'a' }, { items: [{ id: 'UC1' }] }).ok, false);
  assert.match(fila({ access_token: 'a', refresh_token: 'r' }, { items: [] }).motivo, /no tiene canal/);
});

test('youtube: token renovado o error claro con el comando para reconectar', () => {
  const con = { canal_id: 'c1', canal_youtube: 'Margen Real', canal_youtube_id: 'UC1' };
  const ok = run(codeOf(YT, 'Token'), { json: { access_token: 'T' }, nodes: { 'Conexión': con } })[0].json;
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.access_token, 'T'); assert.strictEqual(ok.canal_youtube, 'Margen Real');
  const no = run(codeOf(YT, 'Token'), { json: { error: 'invalid_grant' }, nodes: { 'Conexión': con } })[0].json;
  assert.strictEqual(no.ok, false); assert.match(no.error, /conectar c1/); assert.ok(!('access_token' in no));
  const est = run(codeOf(YT, 'Estadísticas'), { json: { items: [{ snippet: { title: 'MR' }, statistics: { subscriberCount: '12', viewCount: '300', videoCount: '4' } }] }, nodes: { Token: ok } })[0].json;
  assert.deepStrictEqual([est.suscriptores, est.vistas, est.videos], [12, 300, 4]);
});

test('aprendizaje: cada video se mide con el token de su canal; los no conectados se saltan', () => {
  const vids = [{ video_id: 'a', canal_id: 'c1', youtube_id: 'y1' }, { video_id: 'b', canal_id: 'c2', youtube_id: 'y2' }];
  const out = run(codeOf(APR, 'Pedidos de retención'), { all: { 'Toca medir': vids, $input: [{ ok: true, access_token: 'T1' }, { ok: false, error: 'x' }] } });
  assert.strictEqual(out.length, 1); assert.strictEqual(out[0].json.video_id, 'a'); assert.strictEqual(out[0].json.token, 'T1');
  assert.strictEqual(run(codeOf(APR, 'Pedidos de retención'), { all: { 'Toca medir': vids, $input: [{ ok: false }, { ok: false }] } })[0].json.nada, true);
});

test('reporte: incluye suscriptores y vistas de cada canal conectado, aunque no tenga videos en el periodo', () => {
  const vids = [{ video_id: 'a', canal_id: 'c1', etapa: 'publicado', estado: 'publicado', createdAt: new Date().toISOString() }];
  const r = run(codeOf(EST, 'Resumen'), { nodes: { Inicio: { tipo: 'reporte', dias: 30 } },
    all: { Videos: vids, Costos: [], 'Estadísticas de YouTube': [{ ok: true, canal_id: 'c1', canal_youtube: 'Margen Real', suscriptores: 5, vistas: 99, videos: 1 }, { ok: true, canal_id: 'c9', canal_youtube: 'Otro', suscriptores: 0, vistas: 0, videos: 0, ocultos: true }] } })[0].json.resumen;
  assert.match(r, /c1 \(YouTube «Margen Real»: 5 suscriptores, 99 vistas, 1 videos\) — 1 videos, 1 publicados/);
  assert.match(r, /c9 \(YouTube «Otro»: suscriptores ocultos/);
});

// ---------------------------------------------------------------------------------------
// Redes, cortes, miniatura y vidIQ
// ---------------------------------------------------------------------------------------
const VQ = wf('FabVidiq00000001'), DER = wf('FabDerivados0001'), RED = wf('FabRedes00000001');
const mcpTexto = (txt, extra = {}) => ({ data: 'event: message\ndata: ' + JSON.stringify({ result: { content: [{ type: 'text', text: txt }], ...extra } }) });

test('ajustes: todo lo nuevo que gasta empieza apagado', () => {
  for (const k of ['allowVidiq', 'allowMiniaturas', 'allowCortes', 'allowRedes']) assert.strictEqual(aj[k], false, k);
  assert.strictEqual(aj.idioma, 'es');
});

test('vidIQ: elige el título con mejor puntaje y sobrevive a errores', () => {
  const titulos = [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }];
  const r = run(codeOf(VQ, 'Mejor título'), { all: { 'Un ítem por título': titulos, $input: [mcpTexto('{"score": 61}'), mcpTexto('Score: 78/100'), { data: 'event: message\ndata: {"error":{"message":"sin créditos"}}' }] } })[0].json;
  assert.strictEqual(r.ok, true); assert.strictEqual(r.mejor, 'B'); assert.strictEqual(r.puntaje, 78);
  assert.match(r.notas[2].error, /créditos/); assert.strictEqual(r.creditos, 10);
  const nada = run(codeOf(VQ, 'Mejor título'), { all: { 'Un ítem por título': titulos, $input: [{ data: 'x' }, { data: 'x' }, { data: 'x' }] } })[0].json;
  assert.strictEqual(nada.ok, false); assert.strictEqual(nada.mejor, 'A');
  const inv = run(codeOf(VQ, 'Resumen de investigación'), { json: mcpTexto('videos…'), nodes: { 'Palabras clave': mcpTexto('kw…') } })[0].json;
  assert.strictEqual(inv.ok, true); assert.strictEqual(inv.palabras_clave, 'kw…'); assert.strictEqual(inv.creditos, 10);
  const err = run(codeOf(VQ, 'Resumen de investigación'), { json: mcpTexto('x', { isError: true }), nodes: { 'Palabras clave': { data: 'roto' } } })[0].json;
  assert.strictEqual(err.ok, false);
});

test('derivados: cortes verticales con los planos elegidos, subtítulos y máximo 60 s', () => {
  const pl = id => ({ id, tipo: 'imagen', texto_narrado: 'uno dos tres cuatro cinco' });
  const plan = { formato: 'largo', planos: ['p1', 'p2', 'p3'].map(pl), biblia: {}, storyboard: { cortes: [{ titulo: 'El hallazgo', planos: ['p2', 'p3', 'zz'] }, { titulo: 'Largo', planos: ['p1'] }, { titulo: 'Vacío', planos: ['zz'] }] } };
  const planos = ['p1', 'p2', 'p3'].map(id => ({ plano_id: id, url: 'https://i/' + id, plano: pl(id) }));
  const son = { voces: [{ plano_id: 'p1', url: 'v1', duracion_s: 70 }, { plano_id: 'p2', url: 'v2', duracion_s: 10 }, { plano_id: 'p3', url: 'v3', duracion_s: 12 }], musica: { url: 'm' } };
  const out = run(codeOf(DER, 'Composiciones de cortes'), { nodes: { Inicio: { plan, planos, son } } }).map(i => i.json);
  assert.strictEqual(out.length, 1);                                  // el de 70 s y el vacío se descartan
  assert.strictEqual(out[0].titulo, 'El hallazgo'); assert.strictEqual(out[0].source.width, 1080); assert.strictEqual(out[0].source.height, 1920);
  const escenas = out[0].source.elements.filter(e => e.type === 'composition');
  assert.deepStrictEqual(escenas.map(e => e.name), ['p2', 'p3']);
  assert.ok(escenas[0].elements.some(e => e.type === 'text'));         // subtítulos forzados
  assert.strictEqual(out[0].source.elements.find(e => e.track === 2).duration, out[0].duracion_s); // música cortada al corte
});

test('derivados: estado de los renders y resultado final con miniatura', () => {
  const pedidos = [{ corte: 1, titulo: 'a', duracion_s: 30, source: {} }, { corte: 2, titulo: 'b', duracion_s: 40, source: {} }];
  const est = run(codeOf(DER, 'Estado de cortes'), { all: { 'Composiciones de cortes': pedidos, 'Renderizar corte': [{ id: 'r1' }, { id: 'r2' }], $input: [{ id: 'r1', status: 'succeeded', url: 'u1' }, { id: 'r2', status: 'rendering' }] } }).map(i => i.json);
  assert.strictEqual(est[0].pendientes, true); assert.strictEqual(est[1].id, 'r2'); assert.strictEqual(est[0].source, undefined);
  const fin = run(codeOf(DER, 'Cortes listos'), { all: { 'Estado de cortes': est, 'Consultar otra vez': [{ status: 'succeeded', url: 'u1' }, { status: 'failed' }] } })[0].json;
  assert.deepStrictEqual(fin.cortes.map(c => c.url), ['u1']); assert.match(fin.fallidos[0], /corte 2: failed/);
  const res = run(codeOf(DER, 'Resultado'), { nodes: { 'Leer ajustes': aj, 'Cortes listos': fin, 'Imagen de miniatura': {}, 'Consultar miniatura': { status: 'succeeded', url: 'mini.jpg' }, 'Composición de miniatura': { base_url: 'base.png' } } })[0].json;
  assert.strictEqual(res.miniatura_url, 'mini.jpg'); assert.strictEqual(res.costo_usd, aj.costoMiniaturaUsd); assert.strictEqual(res.cortes.length, 1);
  const sinTexto = run(codeOf(DER, 'Resultado'), { nodes: { 'Leer ajustes': aj, 'Imagen de miniatura': {}, 'Consultar miniatura': { status: 'failed' }, 'Composición de miniatura': { base_url: 'base.png' } } })[0].json;
  assert.strictEqual(sinTexto.miniatura_url, 'base.png'); assert.match(sinTexto.avisos.join(), /sin texto/);
  const nada = run(codeOf(DER, 'Resultado'), { nodes: { 'Leer ajustes': aj } })[0].json;
  assert.deepStrictEqual([nada.cortes, nada.miniatura_url, nada.costo_usd], [[], '', 0]);
});

test('redes: un Short va igual a todas las redes del canal, con su texto y la etiqueta de IA', () => {
  const pub = { youtube: { titulos: ['T1', 'T2'], descripcion: 'desc', tags: ['#historia', 'misterio'] }, tiktok: { texto: 'tt', hashtags: ['fyp', 'historia'] }, instagram: { texto: 'ig' } };
  const inicio = { video_id: 'v', canal_id: 'c', tema: 'Tema', formato: 'short', perfil: 'expediente', redes: 'tiktok, youtube,instagram', contexto: { render_url: 'https://r.mp4', creditos: ['Música: X'], publicacion: pub } };
  const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj, 'vidIQ: títulos': { ok: true, mejor: 'T2' } } }).map(i => i.json);
  assert.strictEqual(out.length, 1); assert.strictEqual(out[0].plataformas, 'tiktok,youtube,instagram');
  const c = out[0].cuerpo;
  assert.match(c, new RegExp('boundary|' + out[0].limite)); assert.ok(c.endsWith(`--${out[0].limite}--\r\n`));
  assert.ok(c.includes('name="video"\r\n\r\nhttps://r.mp4')); assert.strictEqual((c.match(/name="platform\[\]"/g) || []).length, 3);
  assert.ok(c.includes('name="youtube_title"\r\n\r\nT2'));                         // ganó el título de vidIQ
  assert.ok(c.includes('name="is_ai_generated"\r\n\r\ntrue') && c.includes('name="containsSyntheticMedia"\r\n\r\ntrue'));
  assert.ok(c.includes('tt\n\n#fyp #historia')); assert.ok(c.includes('Música: X')); assert.ok(!c.includes('scheduled_date'));
  assert.ok(c.includes('name="privacyStatus"\r\n\r\npublic'));
});

test('redes: un largo va a YouTube con miniatura y cada corte a TikTok/Reels/Shorts; programado si hay fecha', () => {
  const futuro = new Date(Date.now() + 5 * 86400000).toISOString();
  const inicio = { video_id: 'v', canal_id: 'c', tema: 'Tema', formato: 'largo', perfil: 'p', redes: 'youtube,tiktok,instagram,facebook', publicar_en: futuro,
    contexto: { render_url: 'https://largo.mp4', miniatura_url: 'https://mini.jpg', cortes: [{ corte: 1, titulo: 'Corte uno', url: 'https://c1.mp4' }, { corte: 2, titulo: 'x', url: '' }], publicacion: { youtube: { titulos: ['Título largo'] } } } };
  const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj } }).map(i => i.json);
  assert.deepStrictEqual(out.map(o => o.tipo + ':' + o.plataformas), ['principal:youtube,facebook', 'corte 1:youtube,tiktok,instagram,facebook']);
  assert.ok(out[0].cuerpo.includes('name="thumbnail_url"\r\n\r\nhttps://mini.jpg')); assert.ok(out[0].cuerpo.includes('name="facebook_media_type"\r\n\r\nVIDEO'));
  assert.ok(out[1].cuerpo.includes('Corte uno #Shorts')); assert.ok(!out[1].cuerpo.includes('thumbnail_url'));
  assert.ok(out[0].cuerpo.includes('name="scheduled_date"')); assert.ok(out[0].programado);
  const sinPerfil = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: { ...inicio, perfil: '' }, 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(sinPerfil.nada, true); assert.match(sinPerfil.motivo, /perfil/);
});

test('redes: filas por envío, estado del video y resumen por red', () => {
  const pedidos = [{ tipo: 'principal', plataformas: 'youtube', titulo: 'T', url_video: 'u', programado: '' }, { tipo: 'corte 1', plataformas: 'tiktok', titulo: 'C', url_video: 'u2', programado: '' }];
  const filas = run(codeOf(RED, 'Filas de publicación'), { nodes: { Inicio: { video_id: 'v', canal_id: 'c' } }, all: { 'Plan de publicación': pedidos, $input: [{ request_id: 'r1', status: 'processing' }, { error: { message: 'cuota' } }] } }).map(i => i.json);
  assert.strictEqual(filas[0].estado, 'enviado'); assert.strictEqual(filas[1].estado, 'error'); assert.match(filas[1].resultado, /cuota/);
  const v = run(codeOf(RED, 'Video publicado'), { all: { 'Filas de publicación': filas } })[0].json;
  assert.strictEqual(v.estado, 'publicado'); assert.match(v.error, /corte 1/);
  const r = run(codeOf(RED, 'Resumen de publicación'), { nodes: { Inicio: { video_id: 'v' } }, all: { 'Filas de publicación': filas, 'Estado en redes': [{ status: 'completed', results: [{ platform: 'youtube', success: true, url: 'https://youtu.be/x' }] }] } })[0].json.texto;
  assert.match(r, /✓ principal → youtube \(completed\)\n   youtube: https:\/\/youtu\.be\/x/); assert.match(r, /✗ corte 1: cuota/);
});

test('orquestador: configurar redes valida perfil y lista', () => {
  const v = x => run(codeOf(ORQ, 'Validar redes'), { nodes: { Inicio: x } })[0].json;
  const ok = v({ canal_id: 'c', perfil: 'expediente', redes: 'TikTok, youtube youtube' });
  assert.strictEqual(ok.ok, true); assert.deepStrictEqual(ok.fila, { uploadpost_perfil: 'expediente', redes: 'tiktok,youtube' });
  assert.match(v({ perfil: 'pp', redes: 'myspace' }).motivo, /myspace/);
  assert.strictEqual(v({ perfil: 'a b', redes: 'tiktok' }).ok, false);
});

test('orquestador: el guion recibe la investigación de vidIQ solo si se usó', () => {
  const pedido = { modo: 'guion', datos: { tema: 'x', formato: 'largo' } };
  const con = run(codeOf(ORQ, 'Pedir guion'), { nodes: { 'Nuevo video': { pedido }, 'vidIQ: investigar': { ok: true, palabras_clave: 'kw', videos_destacados: 'vd' } } })[0].json;
  assert.deepStrictEqual(con.datos.investigacion_vidiq, { palabras_clave: 'kw', videos_destacados: 'vd' });
  const sin = run(codeOf(ORQ, 'Pedir guion'), { nodes: { 'Nuevo video': { pedido } } })[0].json;
  assert.strictEqual(sin.datos.investigacion_vidiq, undefined);
});

test('aprendizaje: también mide los envíos a redes a los 2 y 7 días', () => {
  const hace = d => new Date(Date.now() - d * 86400000 - 3600000).toISOString();
  const pubs = [{ request_id: 'a', publicado_en: hace(2), canal_id: 'c', video_id: 'v' }, { request_id: 'b', publicado_en: hace(4) }, { request_id: '', publicado_en: hace(2) }, { request_id: 'e', estado: 'error', publicado_en: hace(7) }];
  const t = run(codeOf(APR, 'Toca medir en redes'), { all: { $input: pubs } });
  assert.deepStrictEqual(t.map(i => i.json.request_id), ['a']);
  const lec = run(codeOf(APR, 'Pedir lecciones'), { all: { 'Toca medir en redes': [{ request_id: 'a', canal_id: 'c', video_id: 'v', tipo: 'principal', dias: 2 }], 'Métricas en redes': [{ tiktok: { views: 900 } }] } }).map(i => i.json);
  assert.strictEqual(lec.length, 1); assert.deepStrictEqual(lec[0].datos.redes[0].metricas, { tiktok: { views: 900 } }); assert.deepStrictEqual(lec[0].datos.videos, []);
});

test('producción y calidad: el costo de la miniatura se suma y la aprobación final muestra cortes, miniatura y títulos', () => {
  const filas = run(codeOf(PROD, 'Costo de derivados'), { json: { costo_usd: 0.06, cortes: [{}, {}] }, nodes: { 'Plan de producción': { video_id: 'v' } } }).map(i => i.json);
  assert.deepStrictEqual(filas.map(f => f.concepto), ['miniatura', 'cortes verticales (2)']);
  assert.strictEqual(run(codeOf(PROD, 'Costo de derivados'), { json: { costo_usd: 0, cortes: [] }, nodes: { 'Plan de producción': { video_id: 'v' } } })[0].json.nada, true);
  const m = run(codeOf(PUB, 'Mensaje final'), { json: { video_id: 'v', canal_id: 'c', render_url: 'r', duracion_s: 300, costo_usd: 2, carpeta: 'k', avisos: [],
    cortes: [{ corte: 1, duracion_s: 40, url: 'c1' }], miniatura_url: 'm', publicacion: { youtube: { titulos: ['A', 'B'] } }, formato: 'largo' } })[0].json;
  assert.match(m.mensaje, /Miniatura: m/); assert.match(m.mensaje, /Corte 1 \(40 s\): c1/); assert.match(m.mensaje, /1\. A\n2\. B/); assert.match(m.mensaje, /publicarlo/);
  assert.deepStrictEqual(m.contexto.cortes.length, 1); assert.strictEqual(m.contexto.miniatura_url, 'm');
});
