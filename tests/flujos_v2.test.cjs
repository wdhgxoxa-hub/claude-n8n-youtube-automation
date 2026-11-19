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
  const bien = run(codeOf(ORQ, 'Veredicto del crítico'), { json: resp({ gancho: 9, promesa: 8, claridad: 9, emocion: 8, exactitud: 10 }) })[0].json;
  assert.strictEqual(bien.pasa, true);
  const flojo = run(codeOf(ORQ, 'Veredicto del crítico'), { json: resp({ gancho: 6, promesa: 8, claridad: 9, emocion: 8, exactitud: 9, instrucciones: 'abre con una pregunta' }) })[0].json;
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
