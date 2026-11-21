// Pruebas de la lógica de los nodos Code de los flujos v2 con datos ficticios.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'workflows', 'v2');
const wf = id => JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
const codeOf = (w, name) => w.nodes.find(n => n.name === name).parameters.jsCode;

function run(js, { nodes = {}, json = {}, all = {}, binary = {}, pasadas = {}, env = {}, runIndex = 0, clock = Date } = {}) {
  // Simula el entorno de un nodo Code de n8n: $('Nodo') con first/last/item/all/isExecuted, $json, $input.
  const $ = name => ({
    first: () => ({ json: nodes[name] }), last: () => ({ json: nodes[name] }), item: { json: nodes[name] },
    all: (o, k) => { if (k !== undefined && pasadas[name]) { if (k >= pasadas[name].length) throw new Error('sin pasada'); return pasadas[name][k].map(j => ({ json: j })); }
      if (k > 0) throw new Error('sin pasada');
      return (all[name] || (nodes[name] === undefined ? [] : [nodes[name]])).map(j => ({ json: j })); },
    itemMatching: i => ({ json: (all[name] || [])[i] }),
    isExecuted: nodes[name] !== undefined || all[name] !== undefined || pasadas[name] !== undefined,
  });
  const $input = { all: () => (all.$input || [json]).map(j => ({ json: j })), item: { json, binary } };
  const fn = new Function('$', '$json', '$input', '$now', '$binary', '$execution', '$env', 'require', '$runIndex', 'Date', js);
  const r = fn($, json, $input, { toFormat: () => '2026-11-19' }, binary, { id:'ejecucion-prueba', resumeFormUrl: 'https://n8n/form-waiting/1?signature=x' }, env, require, runIndex, clock);
  return Array.isArray(r) ? r : [r];
}

const ORQ = wf('FabOrquestador01'), CL = wf('FabLlamarClaude1'), RET = wf('FabRetornoClaud1');
const PROD = wf('FabProduccion001'), PUB = wf('FabPublicacion01'), AJ = wf('FabAjustes000001');
const aj = run(codeOf(AJ, 'Ajustes'))[0].json;

test('analytics y renovación no conservan tokens en ejecuciones automáticas ni manuales', () => {
  for (const id of ['FabAprendizaje01', 'FabYouTube000001']) {
    const s = wf(id).settings;
    assert.strictEqual(s.saveDataSuccessExecution, 'none');
    assert.strictEqual(s.saveDataErrorExecution, 'none');
    assert.strictEqual(s.saveManualExecutions, false);
    assert.strictEqual(s.saveExecutionProgress, false);
  }
});

test('ensayo de aprendizaje solo captura IDs explícitos y registra lecciones contra evidencia real', () => {
  const { execFileSync } = require('node:child_process');
  const carpeta = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cooper-aprendizaje-'));
  const script = path.join(__dirname, '..', 'tools/cooper/preparar_ensayo_aprendizaje.py');
  try {
    execFileSync('python3', [script, '--salida', carpeta, '--video-id', 'video-permitido']);
    const captura = JSON.parse(fs.readFileSync(path.join(carpeta, 'CoopEnsayoApr01.json')));
    const token = JSON.parse(fs.readFileSync(path.join(carpeta, 'CoopEnsayoTok01.json')));
    for (const f of [captura, token]) {
      assert.strictEqual(f.active, false);
      assert.strictEqual(f.settings.saveManualExecutions, false);
      assert.strictEqual(f.settings.saveDataSuccessExecution, 'none');
      assert.strictEqual(f.settings.saveDataErrorExecution, 'none');
      assert.ok(!f.settings.errorWorkflow);
      assert.ok(!f.nodes.some(n => /telegram|webhook|scheduleTrigger/.test(n.type)));
      for (const n of f.nodes.filter(n => n.type.endsWith('.executeWorkflow')))
        assert.strictEqual(n.parameters.workflowId.value, token.id);
      for (const n of f.nodes.filter(n => n.type.endsWith('.httpRequest'))) {
        assert.match(n.parameters.url, /youtubeanalytics.googleapis.com|api.upload-post.com\/api\/uploadposts\/post-analytics\/|oauth2.googleapis.com\/token/);
        if (n.parameters.method === 'POST') assert.strictEqual(n.parameters.url, 'https://oauth2.googleapis.com/token');
      }
    }
    assert.deepStrictEqual(run(codeOf(captura, 'Leer ajustes'))[0].json, { allowAnalytics: true });
    const fecha = new Date(Date.now() - 3 * 86400000).toISOString();
    const candidatos = ['video-permitido', 'video-ajeno'].map(video_id => ({ video_id, youtube_id: 'id', publicado_en: fecha }));
    assert.deepStrictEqual(run(codeOf(captura, 'Toca medir'), { all: { $input: candidatos } }).map(x => x.json.video_id), ['video-permitido']);
    assert.deepStrictEqual(token.nodes.filter(n => n.type.endsWith('.dataTable')).map(n => n.parameters.operation), ['get']);
    const observada = { video_id: 'video-permitido', canal_id: 'canal-a', red: 'youtube', ventana: '72h', fecha, metricas: { vistas: 123 }, creativo: {} };
    const tarea = run(codeOf(captura, 'Preparar trabajo de aprendizaje'), { json: { canal_id: 'canal-a', datos: { evidencias: [observada] } } })[0].json;
    assert.strictEqual(tarea.estado, 'bloqueado');
    assert.strictEqual(JSON.parse(tarea.resultado)._aprendizaje.evidencias[0].metricas.vistas, 123);
    const publico={video_id:'video-permitido',canal_id:'canal-a',request_id:'req',estado:'publicado'};
    const medir=r=>JSON.parse(run(codeOf(captura,'Diagnóstico del ensayo'),{all:{'Toca medir en redes':[publico],'Métricas en redes':[r]}})[0].json.resultado);
    assert.equal(medir({request_id:'req',platforms:{youtube:{success:true,platform_post_id:'abcdefghijk',post_metrics:{views:3}}}}).redes[0].youtube_id_confirmado,'abcdefghijk');
    assert.equal(medir({request_id:'ajeno',platforms:{youtube:{success:true,platform_post_id:'abcdefghijk'}}}).redes[0].youtube_id_confirmado,null);
    assert.ok(!JSON.stringify(medir({error:{message:'texto-reservado'}})).includes('texto-reservado'));
    const propuesta = { lecciones: [{ regla: 'Probar un gancho concreto', causa: 'Hipótesis pendiente de contraste', correccion: 'Acortar la introducción', origenes: [{ video_id: observada.video_id, red: 'youtube', ventana: '72h', metrica: 'vistas', valor: 99999 }] }] };
    const archivo = path.join(carpeta, 'propuesta.json');
    fs.writeFileSync(archivo, JSON.stringify(propuesta));
    execFileSync('python3', [script, '--salida', carpeta, '--job-id', tarea.job_id, '--lecciones', archivo]);
    const guardar = JSON.parse(fs.readFileSync(path.join(carpeta, 'CoopEnsayoLec01.json')));
    assert.ok(!guardar.nodes.some(n => /httpRequest|executeWorkflow$/.test(n.type)));
    const res = run(codeOf(guardar, 'Validar evidencia'), { all: { $input: [tarea] } })[0].json;
    assert.strictEqual(res.estado, 'listo');
    const leccion = JSON.parse(res.resultado).resultado.lecciones[0];
    assert.strictEqual(leccion.origenes[0].valor, 123);
    assert.strictEqual(leccion.nivel, 'hipotesis');
    assert.throws(() => run(codeOf(guardar, 'Validar evidencia'), { all: { $input: [{ ...tarea, canal_id: 'canal-ajeno' }] } }), /otro canal/);
    assert.throws(() => run(codeOf(guardar, 'Validar evidencia'), { all: { $input: [{ ...tarea, estado: 'listo' }] } }), /pendiente/);
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
});

test('competencia: cada idea consulta radar público antes del guion y nunca permite respaldo pago', () => {
  const ra=wf('FabRadar00000001'), texto=wf('FabTextoGPT0001');
  const destinos=(w,n)=>(w.connections[n]?.main||[]).flat().map(x=>x.node);
  const alcanza=(origen,fin,saltar)=>{const pendientes=[origen],vistos=new Set();while(pendientes.length){const n=pendientes.shift();if(n===saltar||vistos.has(n))continue;if(n===fin)return true;vistos.add(n);pendientes.push(...destinos(ORQ,n));}return false;};
  assert.strictEqual(alcanza('Temas recientes del canal','Nuevo video'),true);
  // Otras puertas obligatorias (aprendizaje) pueden componerse en la misma ruta.
  for(const obligatorio of ['Pedido de competencia previa','Radar antes de la idea','Canal con competencia','Exigir competencia previa'])
    assert.strictEqual(alcanza('Temas recientes del canal','Nuevo video',obligatorio),false,obligatorio);
  assert.deepStrictEqual(destinos(ra,'¿Hay canales?'),['Encargo público de competencia']);
  const condicion=(nombre,nodes)=>run('return '+ra.nodes.find(n=>n.name===nombre).parameters.conditions.conditions[0].leftValue.replace(/^=\{\{\s*|\s*\}\}$/g,''),{nodes})[0];
  for(const accion of ['correr','antes_idea']) assert.strictEqual(condicion('¿Solo ver?',{Inicio:{accion}}),false);
  assert.strictEqual(condicion('¿Solo ver?',{Inicio:{accion:'ver'}}),true);
  assert.strictEqual(condicion('¿Avisar radar público?',{Inicio:{accion:'antes_idea'}}),false);
  assert.strictEqual(condicion('¿Avisar radar público?',{Inicio:{accion:'correr'}}),true);
  assert.strictEqual(condicion('¿Avisar radar público?',{}),true);
  const p=run(codeOf(ra,'Encargo público de competencia'),{all:{'Pedidos de radar':[{canal_id:'mr',nombre:'Margen Real',nicho:'negocios'}]}})[0].json;
  assert.strictEqual(p.sin_api,true);assert.strictEqual(p.costo_estimado_usd,0);assert.match(p.body.input[0].content[0].text,/Perú/);
  const t=run(codeOf(texto,'Pedido de texto'),{nodes:{Inicio:p,'Leer ajustes':{...aj,allowTextoApi:true}}})[0].json;
  assert.strictEqual(t.api_permitida,false);assert.strictEqual(t.local.buscar_web,true);
  assert.throws(()=>run(codeOf(ORQ,'Exigir competencia previa'),{nodes:{'Canal con competencia':{tendencias:'{}'}}}),/Radar pendiente/);
});
test('competencia: fallo público se persiste sin ideas ni métricas ficticias y el contexto viaja al guion', () => {
  const ra=wf('FabRadar00000001');
  const r=run(codeOf(ra,'Competencia comprobada'),{all:{'Pedidos de radar':[{canal_id:'mr',nombre:'Margen Real'}],$input:[{error:'falla privada'}]}})[0].json;
  const tendencias=JSON.parse(r.tendencias);assert.strictEqual(tendencias.competencia.estado,'sin_datos');assert.deepStrictEqual(tendencias.ideas,[]);assert.ok(!r.tendencias.includes('falla privada'));
  const c={version:1,estado:'listo',fecha:new Date().toISOString(),diferenciacion:'Perú'};
  const v=run(codeOf(ORQ,'Nuevo video'),{nodes:{Inicio:{tema:'Ejemplo',canal_id:'mr'},'Buscar canal':{canal_id:'mr'},'Canal con competencia':{canal_id:'mr',tendencias:JSON.stringify({competencia:c})},'Buscar biblia':{resultado:'{}'},'Leer ajustes':aj},all:{$input:[]}})[0].json;
  const guion=run(codeOf(ORQ,'Pedir guion'),{nodes:{'Nuevo video':v}})[0].json;
  assert.deepStrictEqual(guion.datos.competencia,c);
});

// Formulario tal como lo arma n8n en «Subir a redes» (mismo texto que un multipart, para comprobar campos).
const cuerpoDe = o => o.pares.map(([k, x]) => `name="${k}"\r\n\r\n${x}\r\n`).join('');

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
  assert.match(items[0].json.prompt, /Sin texto, letras, cifras ni logos/);
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
  assert.strictEqual(els[0].duration, 3.15);                                  // Short: respiro de 0,15 s
  assert.strictEqual(els[1].elements[0].type, 'video');
  assert.strictEqual(els[2].elements[0].type, 'video');
  assert.strictEqual(els[0].elements[1].source, 'https://d/v1');
  const musica = els.find(e => e.track === 2);
  assert.strictEqual(musica.duration, Math.round((3.15 + 4.65 + 2.15) * 100) / 100);
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
  const resp = { videos: [{ duration: 10, user: { name: 'Ana' }, url: 'https://pexels/1', image: 'https://pexels/1.jpg', video_files: [
    { link: 'https://h.mp4', width: 1920, height: 1080 }, { link: 'https://v.mp4', width: 1080, height: 1920 }] },
    { duration: 2, image: 'https://pexels/corto.jpg', video_files: [{ link: 'https://c.mp4', width: 1080, height: 1920 }] }] };
  const corto = run(codeOf(PROD, 'Elegir de Pexels'), { json: resp, nodes: { 'Un ítem por plano': { plano: { id: 'p1' } }, 'Plan de producción': { formato: 'short' } } })[0].json;
  assert.deepStrictEqual(corto.candidatos.map(c => [c.url, c.thumb]), [['https://v.mp4', 'https://pexels/1.jpg']]);   // el de 2 s no sirve
  const largo = run(codeOf(PROD, 'Elegir de Pexels'), { json: resp, nodes: { 'Un ítem por plano': { plano: { id: 'p1' } }, 'Plan de producción': { formato: 'largo' } } })[0].json;
  assert.strictEqual(largo.candidatos[0].url, 'https://h.mp4');
  const nada = run(codeOf(PROD, 'Elegir de Pexels'), { json: { videos: [] }, nodes: { 'Un ítem por plano': { plano: { id: 'p1' } }, 'Plan de producción': { formato: 'largo' } } })[0].json;
  assert.deepStrictEqual(nada.candidatos, []);
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
  assert.strictEqual(fx.length, 2); assert.strictEqual(fx[1].duration, 4.15); // un efecto largo no pasa la escena (Short: respiro 0,15 s)
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
  assert.strictEqual(g.aviso, false);                                       // 0,76 de 1,5 = 51 % < 80 %
  assert.strictEqual(run(codeOf(PROD, 'Gasto de planos'), { nodes: { 'Leer ajustes': aj, 'Plan de producción': { presupuesto: 0.9 }, 'Juntar planos': { planos } } })[0].json.aviso, true);
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

test('aprendizaje: captura métricas diariamente sin esperar los días de lecciones', () => {
  const hace = d => new Date(Date.now() - d * 86400000 - 3600000).toISOString();
  const out = run(codeOf(APR, 'Toca medir'), { all: { $input: [{ video_id: 'a', youtube_id: 'y', publicado_en: hace(2) }, { video_id: 'b', youtube_id: 'y', publicado_en: hace(3) }, { video_id: 'c', youtube_id: 'y', publicado_en: hace(7) }] } });
  assert.deepStrictEqual(out.map(i => i.json.video_id), ['a', 'b', 'c']);
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

const hl = (iso, zona = 'America/Lima') => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const dias = (a, b) => Math.round((Date.parse(hl(b).slice(0, 10)) - Date.parse(hl(a).slice(0, 10))) / 86400000);

test('redes: un Short sale a cada red por separado, a la hora fuerte de cada una, con su texto y etiqueta de IA', () => {
  const pub = { youtube: { titulos: ['T1', 'T2'], descripcion: 'desc', tags: ['#historia', 'misterio'] }, tiktok: { texto: 'tt', hashtags: ['fyp', 'historia'] }, instagram: { texto: 'ig' } };
  const inicio = { video_id: 'v', canal_id: 'c', tema: 'Tema', formato: 'short', perfil: 'expediente', redes: 'tiktok, youtube,instagram', contexto: { render_url: 'https://r.mp4', creditos: ['Música: X'], publicacion: pub } };
  const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj, 'vidIQ: títulos': { ok: true, mejor: 'T2' } }, all: { 'Agenda del canal': [] } }).map(i => i.json);
  assert.deepStrictEqual(out.map(o => o.plataformas), ['tiktok', 'youtube', 'instagram']);   // un envío por red
  const por = Object.fromEntries(out.map(o => [o.plataformas, o]));
  assert.ok(por.tiktok.programado && hl(por.tiktok.programado).endsWith(', 19:00'));          // TikTok 19:00 hora de Lima
  assert.ok(hl(por.youtube.programado).endsWith(', 16:00')); assert.ok(hl(por.instagram.programado).endsWith(', 20:00'));
  for (const o of out) { assert.ok(Date.parse(o.programado) > Date.now()); assert.strictEqual(o.pares.length, 24); assert.ok(o.pares.every(([k, x]) => typeof k === 'string' && k && typeof x === 'string'));
    assert.strictEqual((cuerpoDe(o).match(/name="platform\[\]"/g) || []).length, 1); assert.ok(cuerpoDe(o).includes('name="timezone"\r\n\r\nAmerica/Lima')); }
  const t = cuerpoDe(por.tiktok), y = cuerpoDe(por.youtube);
  assert.ok(t.includes('tt\n\n#fyp #historia') && t.includes('name="is_aigc"\r\n\r\ntrue') && !t.includes('youtube_title'));
  assert.ok(y.includes('name="youtube_title"\r\n\r\nT2 #Shorts') && y.includes('name="containsSyntheticMedia"\r\n\r\ntrue') && y.includes('name="tags"\r\n\r\nhistoria,misterio'));
  assert.ok(y.includes('name="video"\r\n\r\nhttps://r.mp4'));
});

test('redes: un largo sale de mañana a YouTube con miniatura y los cortes en días distintos (1, 3, 5) por red', () => {
  const inicio = { video_id: 'v', canal_id: 'c', tema: 'Tema', formato: 'largo', perfil: 'p', redes: 'youtube,tiktok,instagram,facebook',
    contexto: { render_url: 'https://largo.mp4', miniatura_url: 'https://mini.jpg', cortes: [{ corte: 1, titulo: 'Corte uno', url: 'https://c1.mp4' }, { corte: 2, titulo: 'Dos', url: 'https://c2.mp4' }, { corte: 3, titulo: 'x', url: '' }], publicacion: { youtube: { titulos: ['Título largo'] } } } };
  const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj }, all: { 'Agenda del canal': [] } }).map(i => i.json);
  assert.deepStrictEqual(out.map(o => o.tipo + ':' + o.plataformas), ['principal:youtube', 'principal:facebook',
    'corte 1:youtube', 'corte 1:tiktok', 'corte 1:instagram', 'corte 1:facebook', 'corte 2:youtube', 'corte 2:tiktok', 'corte 2:instagram', 'corte 2:facebook']);
  const p = out[0];
  assert.ok(cuerpoDe(p).includes('name="thumbnail_url"\r\n\r\nhttps://mini.jpg') && hl(p.programado).endsWith(', 11:00'));
  assert.ok(cuerpoDe(out[1]).includes('name="facebook_media_type"\r\n\r\nVIDEO') && !cuerpoDe(out[1]).includes('thumbnail_url'));
  const c1 = out.find(o => o.tipo === 'corte 1' && o.plataformas === 'tiktok'), c2 = out.find(o => o.tipo === 'corte 2' && o.plataformas === 'tiktok');
  assert.strictEqual(dias(p.programado, c1.programado), 1); assert.strictEqual(dias(p.programado, c2.programado), 3);
  assert.ok(cuerpoDe(out.find(o => o.tipo === 'corte 1' && o.plataformas === 'youtube')).includes('Corte uno #Shorts'));
  const sinPerfil = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: { ...inicio, perfil: '' }, 'Leer ajustes': aj }, all: { 'Agenda del canal': [] } })[0].json;
  assert.strictEqual(sinPerfil.nada, true); assert.match(sinPerfil.motivo, /perfil/);
});

test('redes: respeta la fecha que programaste y la separación entre largos; no pasa del tope por red y día', () => {
  const futuro = new Date(Date.now() + 6 * 86400000); futuro.setUTCHours(23, 30, 0, 0);   // 18:30 en Lima
  const base = { video_id: 'v', canal_id: 'c', tema: 'T', perfil: 'p', redes: 'youtube,tiktok', contexto: { render_url: 'r', cortes: [] } };
  const prog = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: { ...base, formato: 'largo', publicar_en: futuro.toISOString() }, 'Leer ajustes': aj }, all: { 'Agenda del canal': [] } })[0].json;
  assert.strictEqual(prog.programado, futuro.toISOString());                                  // tu fecha y hora exactas
  // ya hubo un largo hace unas horas: el siguiente espera 2 días
  const ayer = [{ request_id: 'x', tipo: 'principal', plataformas: 'youtube', publicado_en: new Date(Date.now() - 3600000).toISOString(), estado: 'enviado' }];
  const sep = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: { ...base, formato: 'largo' }, 'Leer ajustes': aj }, all: { 'Agenda del canal': ayer } })[0].json;
  assert.ok(dias(new Date().toISOString(), sep.programado) >= 2);
  // TikTok lleno los próximos 2 días (2 por día): el Short pasa al tercer día
  const lleno = [0, 1].flatMap(d => [0, 1].map(k => ({ request_id: 'r' + d + k, tipo: 'principal', plataformas: 'tiktok', estado: 'programado',
    publicado_en: new Date(Date.now() + (d * 24 + 2) * 3600000).toISOString() })));
  const corto = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: { ...base, formato: 'short', redes: 'tiktok' }, 'Leer ajustes': aj }, all: { 'Agenda del canal': lleno } })[0].json;
  const ocupados = new Set(lleno.map(r => hl(r.publicado_en).slice(0, 10)));
  assert.ok(!ocupados.has(hl(corto.programado).slice(0, 10)));
});

test('redes: la separación mínima entre largos conserva las horas al cruzar medianoche', () => {
  for (const instant of ['2026-11-21T05:20:00Z', '2026-11-21T17:20:00Z']) {
    const now = Date.parse(instant), previous = now - 3600000;
    class Reloj extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    }
    const inicio = { video_id: 'v', canal_id: 'c', tema: 'T', perfil: 'p', redes: 'youtube', formato: 'largo', contexto: { render_url: 'r', cortes: [] } };
    const agenda = [{ request_id: 'anterior', tipo: 'principal', plataformas: 'youtube', publicado_en: new Date(previous).toISOString(), estado: 'enviado' }];
    const next = run(codeOf(RED, 'Plan de publicación'), { clock: Reloj, nodes: { Inicio: inicio, 'Leer ajustes': aj }, all: { 'Agenda del canal': agenda } })[0].json;
    assert.ok(Date.parse(next.programado) - previous >= aj.calendario.diasEntreLargos * 86400000, instant);
    assert.ok(hl(next.programado).endsWith(', 11:00'));
  }
});

test('redes: escala — 60 canales con 3 largos cada uno se agendan sin pasar topes ni chocar', () => {
  const t0 = Date.now(); let total = 0;
  for (let c = 0; c < 60; c++) {
    const agenda = [];
    for (let v = 0; v < 3; v++) {
      const inicio = { video_id: 'v' + v, canal_id: 'c' + c, tema: 'T', formato: 'largo', perfil: 'p' + c, redes: 'youtube,tiktok,instagram,facebook',
        contexto: { render_url: 'r', cortes: [1, 2, 3].map(k => ({ corte: k, titulo: 'k' + k, url: 'u' + k })) } };
      const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj }, all: { 'Agenda del canal': agenda } }).map(i => i.json);
      assert.strictEqual(out.length, 14);
      for (const o of out) agenda.push({ request_id: 'x', tipo: o.tipo, plataformas: o.plataformas, publicado_en: o.programado, estado: 'programado' });
      total += out.length;
    }
    const cuenta = {}; for (const r of agenda) { const k = r.plataformas + '|' + hl(r.publicado_en).slice(0, 10); cuenta[k] = (cuenta[k] || 0) + 1; }
    assert.ok(Object.values(cuenta).every(n => n <= aj.calendario.maxPorRedDia), 'tope por red y día');
    const largos = agenda.filter(r => r.tipo === 'principal' && r.plataformas === 'youtube').map(r => Date.parse(r.publicado_en)).sort();
    for (let i = 1; i < largos.length; i++) assert.ok(largos[i] - largos[i - 1] >= 2 * 86400000 - 3600000, 'separación entre largos');
  }
  assert.strictEqual(total, 60 * 3 * 14); assert.ok(Date.now() - t0 < 5000);
});

test('redes: filas por envío, estado del video y resumen por red', () => {
  const pedidos = [{ tipo: 'principal', plataformas: 'youtube', titulo: 'T', url_video: 'u', programado: '' }, { tipo: 'corte 1', plataformas: 'tiktok', titulo: 'C', url_video: 'u2', programado: '' }];
  const filas = run(codeOf(RED, 'Filas de publicación'), { nodes: { Inicio: { video_id: 'v', canal_id: 'c' } }, all: { 'Plan de publicación': pedidos, $input: [{ request_id: 'r1', status: 'processing' }, { error: { message: 'cuota' } }] } }).map(i => i.json);
  assert.strictEqual(filas[0].estado, 'enviado'); assert.strictEqual(filas[1].estado, 'error'); assert.match(filas[1].resultado, /cuota/);
  const v = run(codeOf(RED, 'Video publicado'), { all: { 'Filas de publicación': filas } })[0].json;
  assert.strictEqual(v.estado, 'publicado'); assert.match(v.error, /corte 1/);
  const r = run(codeOf(RED, 'Resumen de publicación'), { nodes: { Inicio: { video_id: 'v' } }, all: { 'Plan de publicación': pedidos, 'Filas de publicación': filas, 'Estado en redes': [{ status: 'completed', results: [{ platform: 'youtube', success: true, url: 'https://youtu.be/x' }] }] } })[0].json.texto;
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

test('aprendizaje: mide redes confirmadas y entrega evidencia persistida por hito', () => {
  const hace = d => new Date(Date.now() - d * 86400000 - 3600000).toISOString();
  const pubs = [{ request_id: 'a', estado: 'publicado', publicado_en: hace(2), canal_id: 'c', video_id: 'v' }, { request_id: 'b', estado: 'publicado', publicado_en: hace(4) }, { request_id: '', publicado_en: hace(2) }, { request_id: 'e', estado: 'error', publicado_en: hace(7) }];
  const t = run(codeOf(APR, 'Toca medir en redes'), { all: { $input: pubs } });
  assert.deepStrictEqual(t.map(i => i.json.request_id), ['a', 'b', 'e']);
  const fecha='2026-11-21T00:00:00.000Z';
  const lec = run(codeOf(APR, 'Pedir lecciones'), { all: { 'Toca medir en redes': [{ request_id: 'a', canal_id: 'c', video_id: 'v' }], 'Videos publicados':[{video_id:'v',canal_id:'c'}], 'Cooper · historial de redes': [{request_id:'a',metricas_consultadas_en:fecha,metricas_historial:JSON.stringify({tiktok:[{fecha,ventana:'24h',vistas:900}]})}] } }).map(i => i.json);
  assert.strictEqual(lec.length, 1); assert.equal(lec[0].datos.evidencias[0].metricas.vistas,900); assert.equal(lec[0].datos.evidencias[0].metricas.seguidoresGanados,null);
});

test('producción y calidad: el costo de la miniatura se suma y la aprobación final muestra cortes, miniatura y títulos', () => {
  const filas = run(codeOf(PROD, 'Costo de derivados'), { json: { costo_usd: 0.06, cortes: [{}, {}] }, nodes: { 'Plan de producción': { video_id: 'v' } } }).map(i => i.json);
  assert.deepStrictEqual(filas.map(f => f.concepto), ['miniatura', 'cortes verticales (2)']);
  assert.strictEqual(run(codeOf(PROD, 'Costo de derivados'), { json: { costo_usd: 0, cortes: [] }, nodes: { 'Plan de producción': { video_id: 'v' } } })[0].json.nada, true);
  const m = run(codeOf(PUB, 'Mensaje final'), { json: { video_id: 'v', canal_id: 'c', render_url: 'r', duracion_s: 300, costo_usd: 2, carpeta: 'k', avisos: [],
    cortes: [{ corte: 1, duracion_s: 40, url: 'c1' }], miniatura_url: 'm', publicacion: { youtube: { titulos: ['A', 'B'] } }, formato: 'largo' } })[0].json;
  assert.match(m.mensaje, /Miniatura: m/); assert.match(m.mensaje, /Corte 1 \(40 s\): c1/); assert.match(m.mensaje, /1\. A — \d+\/100.*\n2\. B — \d+\/100/); assert.match(m.mensaje, /publicarlo/);
  assert.deepStrictEqual(m.contexto.cortes.length, 1); assert.strictEqual(m.contexto.miniatura_url, 'm');
});

test('escala: topes de 24 h por canal y de toda la fábrica', () => {
  const v = (canal, n) => Array.from({ length: n }, (_, i) => ({ video_id: canal + i, canal_id: canal }));
  const r = (filas, canal = 'c1') => run(codeOf(ORQ, 'Revisar topes'), { nodes: { 'Leer ajustes': aj, 'Buscar canal': { canal_id: canal } }, all: { $input: filas } })[0].json;
  assert.strictEqual(r(v('c1', aj.maxVideosDiaPorCanal - 1)).ok, true);
  assert.match(r(v('c1', aj.maxVideosDiaPorCanal)).motivo, /canal c1/);
  assert.match(r(v('otro', aj.maxVideosDiaTotal)).motivo, /fábrica/);
  assert.strictEqual(r([{}]).ok, true);                        // tabla vacía (alwaysOutputData)
});

test('escala: todo flujo es válido — nodos únicos, conexiones existentes, sin huérfanos, HTTP con tiempo límite', () => {
  for (const id of ['FabAjustes000001', 'FabLlamarClaude1', 'FabRetornoClaud1', 'FabAprobacion001', 'FabOrquestador01', 'FabProduccion001', 'FabSonido0000001',
    'FabPublicacion01', 'FabAprendizaje01', 'FabEstado0000001', 'FabReferencias01', 'FabYouTube000001', 'FabVidiq00000001', 'FabDerivados0001', 'FabRedes00000001', 'FabRutina0000001', 'FabErrores000001', 'FabAgenteTelegr1', 'FabTextoGPT0001', 'FabNoticia000001', 'FabRadar00000001', 'FabCooperAPI0001']) {
    const w = wf(id); const nombres = w.nodes.map(n => n.name);
    assert.strictEqual(new Set(nombres).size, nombres.length, id + ': nombres repetidos');
    const destinos = new Set(Object.values(w.connections).flatMap(c => Object.values(c).flat(2)).map(x => x.node));
    for (const d of destinos) assert.ok(nombres.includes(d), id + ': conexión a ' + d);
    for (const n of w.nodes) {
      assert.ok(destinos.has(n.name) || w.connections[n.name], id + ': huérfano ' + n.name);
      if (n.type.endsWith('httpRequest')) assert.ok(n.parameters.options?.timeout, id + ': sin timeout ' + n.name);
      if (n.type.endsWith('.code')) {   // el entorno de Code de n8n no trae estas funciones (verificado en vivo)
        // crypto está permitido desde el puente Cooper; no habilitar otros módulos.
        const sinComentarios = n.parameters.jsCode.replace(/require\(['"]crypto['"]\)/g, 'crypto').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
        assert.doesNotMatch(sinComentarios, /\bnew URL\(|URLSearchParams|TextEncoder|TextDecoder|structuredClone|\batob\(|\bbtoa\(|\bfetch\(|setTimeout|require\(/, id + ': función no disponible en ' + n.name);
      }
      if (n.type.endsWith('.code')) assert.doesNotThrow(() => new Function('$', '$json', '$input', '$now', '$binary', n.parameters.jsCode), id + ': JS inválido en ' + n.name);
    }
  }
});

test('vigilante: el aviso de error dice flujo, nodo, mensaje y enlace', () => {
  const ERR = wf('FabErrores000001');
  const m = run(codeOf(ERR, 'Mensaje de error'), { json: { workflow: { name: 'M8 · Publicación en redes' }, execution: { lastNodeExecuted: 'Subir a redes', url: 'https://n8n/x/1', error: { message: '429  demasiadas\n peticiones' } } } })[0].json.texto;
  assert.match(m, /Se detuvo: Publicación en redes/); assert.match(m, /Paso: Subir a redes/);
  assert.match(m, /Motivo: el servicio pidió ir más despacio/); assert.match(m, /429 demasiadas peticiones/);   // motivo en español + original
  assert.match(m, /<a href="https:\/\/n8n\/x\/1">Ver el detalle<\/a>/);
  const raro = run(codeOf(ERR, 'Mensaje de error'), { json: { workflow: { name: 'F · X' }, execution: { error: { message: 'algo <raro> & nuevo' } } } })[0].json.texto;
  assert.match(raro, /Motivo: algo &lt;raro&gt; &amp; nuevo/);   // sin traducción: el original, escapado para HTML de Telegram
  const vacio = run(codeOf(ERR, 'Mensaje de error'), { json: {} })[0].json.texto;
  assert.match(vacio, /error sin mensaje/);
  assert.strictEqual(nodo(ERR, 'Avisar error').parameters.additionalFields.parse_mode, 'HTML');
  for (const id of ['FabProduccion001', 'FabRedes00000001', 'FabOrquestador01']) { const s = wf(id).settings;
    assert.strictEqual(s.errorWorkflow, 'FabErrores000001'); assert.ok(s.executionTimeout > 0 && s.executionTimeout <= 3600); }
});

test('rutina: avisa los videos que llevan más de 24 h sin avanzar, y solo esos', () => {
  const RUT = wf('FabRutina0000001'); const viejo = new Date(Date.now() - 30 * 3600000).toISOString(), nuevo = new Date().toISOString();
  const filas = [{ video_id: 'a', canal_id: 'c', etapa: 'guion', estado: 'en_proceso', updatedAt: viejo }, { video_id: 'b', canal_id: 'c', etapa: 'guion', estado: 'en_proceso', updatedAt: nuevo },
    { video_id: 'p', canal_id: 'c', etapa: 'publicado', estado: 'publicado', updatedAt: viejo }, { video_id: 'e', canal_id: 'c', etapa: 'publicado', estado: 'error_publicacion', error: 'cuota', updatedAt: viejo }];
  const t = run(codeOf(RUT, 'Atascados'), { all: { $input: filas } })[0].json.texto;
  assert.match(t, /\(2\)/); assert.match(t, /• a \(c\) en «guion»/); assert.match(t, /• e .*cuota/); assert.doesNotMatch(t, /• b|• p/);
  assert.strictEqual(run(codeOf(RUT, 'Atascados'), { all: { $input: [{}] } })[0].json.nada, true);
});

test('redes: zona horaria por canal (válida o rechazada) y calendario en la hora de ese público', () => {
  const v = x => run(codeOf(ORQ, 'Validar redes'), { nodes: { Inicio: x } })[0].json;
  assert.deepStrictEqual(v({ perfil: 'mx', redes: 'tiktok', zona: 'America/Mexico_City' }).fila, { uploadpost_perfil: 'mx', redes: 'tiktok', zona: 'America/Mexico_City' });
  assert.match(v({ perfil: 'mx', redes: 'tiktok', zona: 'Marte/Olympus' }).motivo, /zona horaria desconocida/);
  const inicio = { video_id: 'v', canal_id: 'c', tema: 'T', formato: 'short', perfil: 'p', redes: 'tiktok', zona: 'Europe/Madrid', contexto: { render_url: 'r' } };
  const o = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj }, all: { 'Agenda del canal': [] } })[0].json;
  assert.ok(hl(o.programado, 'Europe/Madrid').endsWith(', 19:00')); assert.ok(cuerpoDe(o).includes('name="timezone"\r\n\r\nEurope/Madrid'));
});

test('redes: el calendario es correcto a cualquier hora del día (24 horas simuladas)', () => {
  const real = Date.now; const base = Date.parse('2026-11-19T05:00:00Z');   // 00:00 en Lima
  try {
    for (let k = 0; k < 24; k++) {
      const ahora = base + k * 3600000 + 7 * 60000; Date.now = () => ahora;
      const inicio = { video_id: 'v', canal_id: 'c', tema: 'T', formato: 'largo', perfil: 'p', redes: 'youtube,tiktok,instagram,facebook',
        contexto: { render_url: 'r', cortes: [1, 2, 3].map(i => ({ corte: i, titulo: 't', url: 'u' + i })) } };
      const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj }, all: { 'Agenda del canal': [] } }).map(i => i.json);
      assert.strictEqual(out.length, 14, 'hora ' + k);
      const p = out.find(o => o.tipo === 'principal' && o.plataformas === 'youtube');
      for (const o of out) {
        assert.ok(Date.parse(o.programado) > ahora + 15 * 60000, `futuro ${k} ${o.tipo}`);
        if (o.tipo !== 'principal') assert.strictEqual(dias(p.programado, o.programado), { 'corte 1': 1, 'corte 2': 3, 'corte 3': 5 }[o.tipo], `${k} ${o.tipo}`);
      }
    }
  } finally { Date.now = real; }
});

test('redes: «Subir a redes» usa el multipart nativo de n8n con tantas casillas como pares arma el plan', () => {
  const n = RED.nodes.find(x => x.name === 'Subir a redes'); const p = n.parameters;
  assert.strictEqual(p.contentType, 'multipart-form-data'); assert.ok(!('body' in p) && !('rawContentType' in p));
  const cas = p.bodyParameters.parameters; assert.strictEqual(cas.length, 24);
  cas.forEach((c, i) => { assert.strictEqual(c.parameterType, 'formData'); assert.strictEqual(c.name, `={{ $json.pares[${i}][0] }}`); assert.strictEqual(c.value, `={{ $json.pares[${i}][1] }}`); });
  assert.match(codeOf(RED, 'Plan de publicación'), /const CASILLAS = 24;/);
});

// ---------- Control desde la computadora: un solo formulario de decisión, chat web y pendientes ----------
const APB = wf('FabAprobacion001'), PEN = wf('FabPendientes001'), CHT = wf('FabChatWeb000001'), PRO2 = wf('FabProduccion001'), AGT = wf('FabAgenteTelegr1');
const nodo = (w, n) => w.nodes.find(x => x.name === n);

test('aprobación: un formulario firmado de n8n sirve para Telegram y para la computadora (sin sendAndWait)', () => {
  for (const w of [APB, PRO2]) assert.ok(!w.nodes.some(n => n.parameters?.operation === 'sendAndWait'), w.name + ' aún usa sendAndWait');
  const esp = nodo(APB, 'Aprobación · esperar'); assert.strictEqual(esp.type, 'n8n-nodes-base.wait'); assert.strictEqual(esp.parameters.resume, 'form');
  assert.deepStrictEqual(esp.parameters.formFields.values.map(v => v.fieldLabel), ['Decisión', 'Cambios']);
  const boton = nodo(APB, 'Aprobación · avisar').parameters.inlineKeyboard.rows[0].row.buttons[0];
  assert.match(boton.additionalFields.url, /Aprobación · preparar/); assert.strictEqual(nodo(APB, 'Aprobación · avisar').onError, 'continueRegularOutput');
  assert.match(codeOf(APB, 'Aprobación · preparar'), /\$execution\.resumeFormUrl/);
});

test('aprobación: la decisión del formulario se convierte en el evento correcto', () => {
  const corre = (decision, cambios) => run(codeOf(APB, 'Aprobación · decisión'), { json: { 'Decisión': decision, Cambios: cambios }, nodes: { 'Aprobación · preparar': { aprobacion_id: 'ap-1' } } })[0].json;
  assert.deepStrictEqual((({ estado, cambios, aprobacion_id }) => ({ estado, cambios, aprobacion_id }))(corre('Aprobar', '')), { estado: 'aprobado', cambios: '', aprobacion_id: 'ap-1' });
  assert.strictEqual(corre('Pedir cambios', 'más tensión').estado, 'cambios'); assert.strictEqual(corre('Pedir cambios', 'más tensión').cambios, 'más tensión');
  assert.strictEqual(corre('algo raro', '').estado, 'cambios');   // ante lo desconocido, nunca aprueba
  const ev = run(codeOf(APB, 'Evento cambios'), { nodes: { Inicio: { etapa: 'guion', video_id: 'v', mensaje: 'm' }, 'Aprobación · decisión': { cambios: '' } } })[0].json;
  assert.strictEqual(ev.evento, 'cambios'); assert.ok(ev.cambios.length > 0); assert.strictEqual(ev.mensaje, undefined);
  const g = run(codeOf(PRO2, 'Permiso de gasto · decisión'), { json: { 'Decisión': 'Detener' }, nodes: { 'Permiso de gasto · preparar': { aprobacion_id: 'g' } } })[0].json;
  assert.strictEqual(g.estado, 'detenido');
});

test('pendientes: lista cada decisión con su enlace, la más antigua primero', () => {
  const filas = [{ etapa: 'guion', video_id: 'v2', canal_id: 'c', resumen: 'Guion de v2\nmás', url: 'https://x/form-waiting/2?signature=b', estado: 'pendiente', createdAt: '2026-11-19T10:00:00Z' },
    { etapa: 'gasto', video_id: 'v1', canal_id: 'c', resumen: 'gastó', url: 'https://x/form-waiting/1?signature=a', estado: 'pendiente', createdAt: '2026-11-19T09:00:00Z' },
    { etapa: 'final', video_id: 'v3', url: 'https://x/3', estado: 'aprobado' }];
  const t = run(codeOf(PEN, 'Lista'), { all: { $input: filas } })[0].json.texto;
  assert.match(t, /Esperan tu decisión \(2\)/); assert.ok(t.indexOf('Permiso de gasto · v1') < t.indexOf('Guion · v2'));
  assert.ok(t.includes('Decidir: https://x/form-waiting/1?signature=a') && !t.includes('v3'));
  assert.strictEqual(run(codeOf(PEN, 'Lista'), { all: { $input: [] } })[0].json.texto, 'No hay nada esperando tu decisión.');
});

test('chat web: público pero con usuario y clave, y llama al mismo agente que Telegram', () => {
  const c = nodo(CHT, 'Chat'); assert.strictEqual(c.parameters.public, true); assert.strictEqual(c.parameters.authentication, 'basicAuth');
  assert.ok(c.credentials.httpBasicAuth.id); assert.strictEqual(c.parameters.options.responseMode, 'lastNode');
  const a = run(codeOf(CHT, 'A agente'), { json: { chatInput: 'hola', sessionId: 'abc' } })[0].json;
  assert.deepStrictEqual(a, { texto: 'hola', chatId: 'web-abc' });
  assert.strictEqual(nodo(CHT, 'Agente').parameters.workflowId.value, 'FabAgenteTelegr1');
  assert.ok(nodo(AGT, 'pendientes') && AGT.connections.pendientes.ai_tool[0][0].node === 'Agente');
});

test('agente: el modelo usa la API Responses (gpt-6-astra no acepta herramientas por chat/completions)', () => {
  const m = nodo(AGT, 'Modelo'); assert.ok(m.typeVersion >= 1.3); assert.strictEqual(m.parameters.responsesApiEnabled, true); assert.ok(nodo(AGT, 'Agente').typeVersion >= 3.1);
});

test('agente: cada herramienta declara su esquema (sin él n8n solo pasa un texto «query» y el orquestador no recibe el evento)', () => {
  const tools = AGT.nodes.filter(n => n.type === '@n8n/n8n-nodes-langchain.toolWorkflow');
  assert.ok(tools.length >= 11);
  for (const t of tools) { const wi = t.parameters.workflowInputs;
    assert.deepStrictEqual(wi.schema.map(c => c.id).sort(), Object.keys(wi.value).sort(), t.name);
    assert.ok(wi.schema.every(c => c.type === 'string' && c.removed === false && c.display === true), t.name); }
  assert.strictEqual(nodo(AGT, 'crear_video').parameters.workflowInputs.value.evento, 'nuevo_video');
});

test('crear_video: las indicaciones del operador llegan al pedido de guion', () => {
  assert.ok('indicaciones' in nodo(AGT, 'crear_video').parameters.workflowInputs.value);
  assert.match(codeOf(ORQ, 'Nuevo video'), /indicaciones: String\(e\.indicaciones \|\| ''\)\.slice\(0, 2000\)/);
});

test('producción: «Juntar planos» solo deja pasar cuando están todos los planos del plan (y en el orden del plan)', () => {
  const PRD = wf('FabProduccion001'); assert.strictEqual(nodo(PRD, 'Juntar planos').type, 'n8n-nodes-base.code');
  const plan = { planos: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] };
  const corre = (archivo, imagen) => run(codeOf(PRD, 'Juntar planos'), { nodes: { 'Plan de producción': plan }, all: { 'Archivo aprobado': archivo, 'Plano aprobado': imagen, 'Avatar pendiente': [] } });
  assert.strictEqual(corre([{ plano_id: 'p2', url: 'a' }], []).length, 0);                       // llegó solo el archivo: no sigue
  const out = corre([{ plano_id: 'p2', url: 'a' }], [{ plano_id: 'p3', url: 'c' }, { plano_id: 'p1', url: 'b' }]);
  assert.deepStrictEqual(out[0].json.planos.map(p => p.plano_id), ['p1', 'p2', 'p3']);
  const RIT = nodo(wf('FabSonido0000001'), 'Voz (Gemini TTS)').parameters.options.batching.batch;
  assert.deepStrictEqual([RIT.batchSize, RIT.batchInterval], [1, 6500]);
});

test('mensajes: Telegram recibe una tarjeta corta y el formulario el detalle completo', () => {
  const APX = wf('FabAprobacion001'); assert.match(nodo(APX, 'Aprobación · avisar').parameters.text, /Aprobación · preparar.*\.aviso/);
  const prep = run(codeOf(APX, 'Aprobación · preparar'), { nodes: { Inicio: { etapa: 'storyboard', video_id: 'v', mensaje: 'L1\nL2\nL3\nL4\nL5', aviso: '🎬 corto' } } })[0].json;
  assert.strictEqual(prep.aviso, '🎬 corto');
  const sin = run(codeOf(APX, 'Aprobación · preparar'), { nodes: { Inicio: { etapa: 'guion', mensaje: 'L1\nL2\nL3\nL4\nL5' } } })[0].json.aviso;
  assert.ok(sin.startsWith('L1\nL2\nL3') && !sin.includes('L4'));
  const sb = run(codeOf(ORQ, 'Mensaje de storyboard'), { json: { video_id: 'v', canal_id: 'c', resultado: { costo_estimado_usd: 2.2, planos: Array.from({ length: 23 }, (_, i) => ({ id: 'p' + i, tipo: i < 6 ? 'archivo' : 'imagen', encuadre: 'x', texto_narrado: 't' })) } } })[0].json;
  assert.match(sb.aviso, /23 escenas/); assert.match(sb.aviso, /17 imágenes · 6 clips de archivo|6 clips de archivo · 17 imágenes/); assert.ok(sb.aviso.split('\n').length <= 6);
  assert.ok(sb.mensaje.includes('p22'));   // el detalle sigue completo para el formulario
});

test('aprobaciones: lo que se guarda en fab_aprobaciones existe como columna (n8n rechaza columnas desconocidas)', () => {
  const COLUMNAS = ['aprobacion_id', 'etapa', 'video_id', 'canal_id', 'job_id', 'resumen', 'url', 'estado', 'cambios', 'decidido_en', 'aviso', 'pedido'];
  for (const [w, p] of [['FabAprobacion001', 'Aprobación'], ['FabProduccion001', 'Permiso de gasto']]) {
    const W = wf(w);
    const ini = { etapa: 'guion', video_id: 'v', canal_id: 'c', mensaje: 'm', presupuesto: 1.5 };
    const prep = run(codeOf(W, p + ' · preparar'), { nodes: { Inicio: ini, 'Plan de producción': ini, 'Gasto de planos': { usd: 1, pct: 0.7 } } })[0].json;
    assert.deepStrictEqual(Object.keys(prep).filter(k => !COLUMNAS.includes(k)), [], w + ' preparar');
    const dec = run(codeOf(W, p + ' · decisión'), { json: { 'Decisión': 'x' }, nodes: { [p + ' · preparar']: prep } })[0].json;
    assert.deepStrictEqual(Object.keys(dec).filter(k => !COLUMNAS.includes(k)), [], w + ' decisión');
  }
});

// ---------- Arreglos de la primera prueba real y banco de roles ----------
test('archivo: el revisor visual elige entre 3 candidatos o los rechaza todos (y entonces se genera la imagen)', () => {
  const PRD = wf('FabProduccion001');
  const c = [{ url: 'u1', thumb: 't1', fuente: { banco: 'Pexels' } }, { url: 'u2', thumb: 't2', fuente: { banco: 'Pexels' } }];
  const elige = (texto, revisar = true) => run(codeOf(PRD, 'Archivo elegido'), { json: { output: [{ content: [{ type: 'output_text', text: texto }] }] },
    nodes: { 'Pedido de revisión de archivo': { plano: { id: 'p1' }, candidatos: c, revisar } } })[0].json;
  assert.strictEqual(elige('{"elegido": 2, "motivo": "ok"}').url, 'u2');
  const no = elige('{"elegido": -1, "motivo": "tiene texto en inglés"}'); assert.strictEqual(no.url, ''); assert.match(no.nota_archivo, /texto en inglés/);
  assert.strictEqual(elige('basura').url, '');                       // respuesta ilegible: no se arriesga
  assert.strictEqual(elige('', false).url, 'u1');                    // revisión apagada: el primero
  const sigue = n => PRD.connections['¿Sirve el archivo?'].main[n][0].node;
  assert.strictEqual(sigue(0), 'Archivo aprobado'); assert.strictEqual(sigue(1), 'Sin archivo: generar');
  assert.strictEqual(PRD.connections['¿Hay en Pexels?'].main[0][0].node, 'Pedido de revisión de archivo');
});

test('montaje: la cifra clave del storyboard sale en grande en su escena', () => {
  const PRD = wf('FabProduccion001');
  const planos = [{ plano_id: 'p1', url: 'https://x/a.png', plano: { id: 'p1', tipo: 'imagen', texto_narrado: 'De tus 10 soles, 1 se va en impuestos', texto_pantalla: 'QUEDAN S/ 9' } }];
  const out = run(codeOf(PRD, 'Composición Creatomate'), { json: { voces: [{ plano_id: 'p1', url: 'https://d/v1', duracion_s: 3 }] },
    nodes: { 'Plan de producción': { video_id: 'v', planos: [planos[0].plano], biblia: {}, formato: 'short' }, 'Juntar planos': { planos } } })[0].json;
  const cifra = out.source.elements[0].elements.find(e => e.type === 'text' && e.text === 'QUEDAN S/ 9');
  assert.ok(cifra && cifra.font_size === '11 vmin' && cifra.y === '30%');
});

test('vidIQ: la semilla de palabras clave es corta (con la frase entera volvía volumen nulo)', () => {
  const r = run(codeOf(ORQ, 'Pedido a vidIQ'), { nodes: { 'Nuevo video': { pedido: { datos: { tema: 'Cuánto gana de verdad una pollería en Lima', formato: 'short' } } }, 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(r.semilla, 'pollería lima'); assert.strictEqual(r.tema, 'Cuánto gana de verdad una pollería en Lima');
  assert.match(JSON.stringify(nodo(wf('FabVidiq00000001'), 'Palabras clave').parameters), /json\.semilla/);
});

test('banco de roles: Claude lee su rol y los modelos de GPT llevan el suyo incrustado', () => {
  const fab = fs.readFileSync(path.join(__dirname, '..', 'skill', 'FABRICA.md'), 'utf8');
  for (const r of ['investigador', 'guionista', 'director-visual', 'editor-publicacion', 'analista']) {
    assert.ok(fab.includes(r + '.md'), 'FABRICA no nombra ' + r); assert.ok(fs.existsSync(path.join(__dirname, '..', 'skill', 'roles', r + '.md')), r); }
  const critico = JSON.stringify(nodo(ORQ, 'Texto · Crítico del guion').parameters); assert.match(critico, /LA ARITMÉTICA CUADRA/);
  const PRD = wf('FabProduccion001');
  for (const n of ['Revisar plano', 'Revisar archivo']) assert.match(JSON.stringify(nodo(PRD, n).parameters), /Eres el revisor visual/, n);
  const guionista = fs.readFileSync(path.join(__dirname, '..', 'skill', 'roles', 'guionista.md'), 'utf8');
  assert.match(guionista, /cuenta corrida/); assert.match(guionista, /110–130 palabras/);
});

test('cierre honesto: el guion recibe documental_url y la descripción del Short ya no promete un video completo', () => {
  assert.match(codeOf(ORQ, 'Nuevo video'), /documental_url: String\(e\.documental_url \|\| ''\)/);
  assert.ok(!codeOf(RED, 'Plan de publicación').includes('Video completo en el canal'));
  assert.match(codeOf(wf('FabProduccion001'), 'Carpeta en la tabla'), /error: ''/);
});

test('todas las expresiones {{ }} de todos los flujos son JavaScript válido (el crítico fallaba en silencio por un salto de línea)', () => {
  let total = 0; const malos = [];
  for (const f of fs.readdirSync(dir)) { const w = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const ver = (v, n) => { if (typeof v === 'string') { if (v.startsWith('={{') && v.trimEnd().endsWith('}}')) { total++;
        try { new Function('$', '$json', '$execution', '$now', '$fromAI', '$input', 'return (' + v.slice(3).trimEnd().slice(0, -2) + ')'); } catch (e) { malos.push(w.name + ' · ' + n.name + ': ' + e.message); } } }
      else if (v && typeof v === 'object') for (const k in v) ver(v[k], n); };
    for (const n of w.nodes) ver(n.parameters, n); }
  assert.ok(total > 300); assert.deepStrictEqual(malos, []);
});

test('tema elegido por la fábrica: sin tema, investiga el nicho, pasa los temas recientes y guarda el tema que eligió el guionista', () => {
  const canal = { canal_id: 'm', nicho: 'Cómo ganan dinero realmente los negocios: márgenes, costos y estrategias', formato_defecto: 'largo', presupuesto_short_usd: 1.5 };
  const corre = tema => run(codeOf(ORQ, 'Nuevo video'), { nodes: { Inicio: { canal_id: 'm', tema, formato: 'short' }, 'Buscar canal': canal, 'Buscar biblia': { resultado: '{"resultado":{"tono":"x"}}' } },
    all: { 'Temas recientes del canal': [{ video_id: 'a', tema: 'Pollería en Lima', createdAt: '2026-11-19' }, { video_id: 'b', tema: 'Gasolineras', createdAt: '2026-11-18' }] } })[0].json;
  const sin = corre(''); assert.strictEqual(sin.pedido.datos.elegir_tema, true); assert.strictEqual(sin.pedido.datos.tema, '');
  assert.deepStrictEqual(sin.pedido.datos.temas_recientes, ['Pollería en Lima', 'Gasolineras']); assert.match(sin.fila.tema, /la fábrica elige/);
  const con = corre('Cuánto gana una gasolinera'); assert.strictEqual(con.pedido.datos.elegir_tema, false); assert.strictEqual(con.pedido.datos.tema, 'Cuánto gana una gasolinera');
  const vq = run(codeOf(ORQ, 'Pedido a vidIQ'), { nodes: { 'Nuevo video': { pedido: sin.pedido }, 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(vq.semilla, 'dinero negocios márgenes'); assert.strictEqual(vq.tema, vq.semilla);   // outliers y palabras clave del nicho
  assert.deepStrictEqual(run(codeOf(ORQ, 'Tema elegido'), { nodes: { Inicio: { resultado: { tema_elegido: 'Cuánto gana un chifa' } } } })[0].json, { tema: 'Cuánto gana un chifa' });
  assert.strictEqual(run(codeOf(ORQ, 'Tema elegido'), { nodes: { Inicio: { resultado: {} } } }).length, 0);   // con tema dado, no toca la ficha
  assert.match(nodo(AGT, 'crear_video').parameters.workflowInputs.value.tema, /VACÍO si el operador no da tema/);
});

test('publicación programada: el video queda «programado» (no «publicado») y no se consulta Upload-Post con un id falso', () => {
  const filas = [{ request_id: 'r1', job_id: 'j1', estado: 'programado', publicado_en: '2026-11-20T21:00:00Z' }, { request_id: 'r2', job_id: 'j2', estado: 'programado', publicado_en: '2026-11-21T00:00:00Z' }];
  const v = run(codeOf(RED, 'Video publicado'), { all: { 'Filas de publicación': filas } })[0].json;
  assert.strictEqual(v.estado, 'programado'); assert.strictEqual(v.etapa, 'programado');
  const ya = run(codeOf(RED, 'Video publicado'), { all: { 'Filas de publicación': [{ ...filas[0], estado: 'enviado' }] } })[0].json;
  assert.strictEqual(ya.estado, 'publicado');
  const p = run(codeOf(RED, 'Pedidos de estado'), { all: { 'Filas de publicación': filas } });
  assert.deepStrictEqual(p.map(i => i.json), [{ nada: true }]);
  assert.ok(!JSON.stringify(RED).includes('ninguno'));
  const sal = RED.connections['¿Hay que consultar?'].main;
  assert.strictEqual(sal[0][0].node, 'Estado en redes'); assert.strictEqual(sal[1][0].node, 'Resumen de publicación');
  const fp = run(codeOf(RED, 'Filas de publicación'), { all: { $input: [{ success: true, job_id: 'jj', request_id: 'rr' }], 'Plan de publicación': [{ tipo: 'principal', plataformas: 'youtube', programado: '2026-11-20T21:00:00Z' }] }, nodes: { Inicio: { video_id: 'v', canal_id: 'c' } } })[0].json;
  assert.strictEqual(fp.job_id, 'jj'); assert.strictEqual(fp.estado, 'programado');
});

test('confirmar publicaciones: consulta por job_id lo que ya debió salir y cierra el video solo cuando salieron todas sus redes', () => {
  const C = wf('FabConfirmar0001');
  assert.match(C.nodes.find(n => n.name === 'Consultar Upload-Post').parameters.url, /job_id=/);
  const pasado = new Date(Date.now() - 3600000).toISOString(), futuro = new Date(Date.now() + 3600000).toISOString();
  const todas = [{ video_id: 'v', request_id: 'r1', job_id: 'j1', plataformas: 'youtube', estado: 'programado', publicado_en: pasado },
    { video_id: 'v', request_id: 'r2', job_id: 'j2', plataformas: 'tiktok', estado: 'programado', publicado_en: futuro },
    { video_id: 'w', request_id: 'r3', plataformas: 'youtube', estado: 'publicado', publicado_en: pasado }];
  const por = run(codeOf(C, 'Por confirmar'), { all: { $input: todas } }).map(i => i.json.request_id);
  assert.deepStrictEqual(por, ['r1']);
  const ok = { status: 'completed', results: [{ platform: 'youtube', success: true, post_url: 'https://www.youtube.com/shorts/3sY1JsbPxMY' }] };
  const r = run(codeOf(C, 'Leer resultados'), { all: { $input: [ok], 'Por confirmar': [todas[0]], 'Publicaciones recientes': todas } }).map(i => i.json);
  assert.strictEqual(r[0].estado, 'publicado'); assert.strictEqual(r[0].video.estado, '');   // TikTok aún pendiente
  const ambas = run(codeOf(C, 'Leer resultados'), { all: { $input: [ok, { status: 'completed', results: [{ platform: 'tiktok', success: true }] }], 'Por confirmar': [todas[0], todas[1]], 'Publicaciones recientes': todas } }).map(i => i.json);
  assert.strictEqual(ambas[0].video.estado, 'publicado'); assert.strictEqual(ambas[0].video.youtube_id, '3sY1JsbPxMY');
  // Respuesta real de Upload-Post para un programado en cola: success:false sin intento, no es un fallo.
  const cola = { status: 'queued', scheduler_status: 'pending', results: [{ platform: 'youtube', status: 'queued', attempts: 0, success: false }] };
  assert.deepStrictEqual(run(codeOf(C, 'Leer resultados'), { all: { $input: [cola], 'Por confirmar': [todas[0]], 'Publicaciones recientes': todas } })[0].json, { nada: true });
  const real = { status: 'completed', results: [{ platform: 'youtube', success: true, platform_post_id: '3sY1JsbPxMY', post_url: 'https://www.youtube.com/watch?v=3sY1JsbPxMY', error_message: null }] };
  assert.strictEqual(run(codeOf(C, 'Leer resultados'), { all: { $input: [real], 'Por confirmar': [todas[0]], 'Publicaciones recientes': todas } })[0].json.youtube_id, '3sY1JsbPxMY');
  const esperando = run(codeOf(C, 'Leer resultados'), { all: { $input: [{ status: 'pending', results: [] }], 'Por confirmar': [todas[0]], 'Publicaciones recientes': todas } });
  assert.deepStrictEqual(esperando[0].json, { nada: true });
  const falla = run(codeOf(C, 'Leer resultados'), { all: { $input: [{ status: 'failed', results: [{ platform: 'youtube', success: false, error_message: 'cuota' }] }], 'Por confirmar': [todas[0]], 'Publicaciones recientes': todas } })[0].json;
  assert.strictEqual(falla.estado, 'error'); assert.strictEqual(falla.video.estado, 'error_publicacion');
  const cerrar = run(codeOf(C, 'Videos a cerrar'), { all: { 'Leer resultados': ambas } }).map(i => i.json);
  assert.deepStrictEqual(cerrar, [{ video_id: 'v', estado: 'publicado', etapa: 'publicado', youtube_id: '3sY1JsbPxMY' }]);
  assert.strictEqual(C.settings.errorWorkflow, 'FabErrores000001');
});

test('costo: sin texto en las imágenes, respaldo de escena para el archivo y repeticiones solo dentro del tope', () => {
  const P = wf('FabProduccion001'); const prm = n => JSON.stringify(P.nodes.find(x => x.name === n).parameters);
  assert.match(prm('Revisar plano'), /NO lo exijas dentro de la imagen/);
  assert.match(prm('Revisar archivo'), /tolera letreros o logos pequeños de fondo/);
  // Plano de archivo sin prompt_imagen: la escena sale de la búsqueda y de la voz (antes solo del estilo → pollerías).
  const arch = { id: 'p02', tipo: 'archivo', texto_narrado: '[énfasis] Un galón a 20 soles.', busqueda_archivo: 'gas station pump night', prompt_imagen: '', encuadre: 'general', luz: 'noche' };
  const it = run(codeOf(P, 'Un ítem por plano'), { nodes: { 'Plan de producción': { video_id: 'v', planos: [arch], biblia: { estilo_visual: { descripcion: 'cocinas de pollería' } } }, 'Leer ajustes': aj } })[0].json;
  assert.match(it.prompt, /^Escena: gas station pump night\. Lo que narra la voz: Un galón a 20 soles\./);
  // Veredicto: 12 planos, tope 1,5; ya se generaron 12 y se revisaron 12 → caben pocas repeticiones, no 11.
  const planos = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, tipo: 'imagen' }));
  const malo = { output: [{ content: [{ type: 'output_text', text: JSON.stringify({ aprobado: false, problemas: ['no es un grifo'], prompt_corregido: 'un grifo' }) }] }] };
  const prev = planos.map(p => ({ plano: p, intento: 1, prompt: 'x', url: 'u' }));
  const ajs = { ...aj, allowRevisionVisual: true };
  const out = run(codeOf(P, 'Veredicto'), { all: { $input: planos.map(() => malo), 'URL del plano': prev },
    pasadas: { 'Extraer imagen': [prev], 'Revisar plano': [planos] }, nodes: { 'Leer ajustes': ajs, 'Plan de producción': { presupuesto: 1.5, planos } } }).map(i => i.json);
  const rep = out.filter(o => o.repetir).length;
  const total = (12 + rep) * aj.costoImagenUsd + (12 + rep) * aj.costoRevisionUsd + 12 * aj.costoVozUsdPorPlano;
  assert.ok(rep > 0 && rep < 11, 'repeticiones ' + rep); assert.ok(total <= 1.5 * aj.avisoGastoPct + 1e-9, 'total ' + total);
  assert.ok(out.find(o => !o.repetir).veredicto.problemas.includes('aceptado sin repetir: no cabe en el tope de gasto'));
  assert.match(out.find(o => o.repetir).prompt, /Sin texto, letras, cifras ni logos/);
  // Con presupuesto holgado, todas las que fallan se repiten (una vez).
  const holgado = run(codeOf(P, 'Veredicto'), { all: { $input: planos.map(() => malo), 'URL del plano': prev },
    pasadas: { 'Extraer imagen': [prev], 'Revisar plano': [planos] }, nodes: { 'Leer ajustes': ajs, 'Plan de producción': { presupuesto: 10, planos } } });
  assert.strictEqual(holgado.filter(i => i.json.repetir).length, 12);
  const plan = run(codeOf(P, 'Plan de producción'), { nodes: { Inicio: { video_id: 'v', storyboard: { planos: [...planos.slice(0, 9), ...Array.from({ length: 3 }, (_, i) => ({ id: 'a' + i, tipo: 'archivo' }))] }, presupuesto_usd: 1.5 }, 'Leer ajustes': ajs } })[0].json;
  assert.ok(plan.costo_estimado_usd > 9 * aj.costoImagenUsd, 'la estimación cuenta revisiones y respaldo del archivo');
});

test('cifras verificadas: busca en la web antes del crítico, obliga a reescribir si hay cifras por corregir y pasa los datos a Claude', () => {
  const O = wf('FabOrquestador01'); const nodo = n => O.nodes.find(x => x.name === n);
  const body = nodo('Texto · Verificar cifras').parameters.jsCode;
  assert.match(body, /type: 'web_search'/); assert.match(body, /Eres el verificador de datos/); assert.match(body, /notas_del_guionista/);
  assert.strictEqual(O.connections['Temas del canal'].main[0][0].node, 'Puntuar ganchos');
  assert.strictEqual(O.connections['Puntuar ganchos'].main[0][0].node, '¿Verificar cifras?');
  assert.strictEqual(O.connections['Cifras verificadas'].main[0][0].node, 'Texto · Crítico del guion');
  assert.match(nodo('Texto · Crítico del guion').parameters.jsCode, /verificacion_de_cifras/);
  // Respuesta real (forma de la prueba en vivo): búsquedas, razonamiento y un mensaje con el JSON.
  const texto = JSON.stringify({ cifras: [{ dato: 'IGV', valor_guion: '1,53', valor_verificado: '1,53', estado: 'ok' }, { dato: 'margen', valor_guion: '4-5', valor_verificado: '', estado: 'vieja', fecha: '2024-11' }],
    faltantes: [{ dato: 'Precio de lista Petroperú gasohol regular', valor: '15.6293 soles/galón', fecha: '2026-11-18', fuente_url: 'https://www.petroperu.com.pe/x.pdf' }], cuenta: ['S/ 10', 'IGV 1,53'], resumen: 'ok' });
  const resp = { output: [{ type: 'web_search_call' }, { type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: texto, annotations: [] }] }] };
  const cv = run(codeOf(O, 'Cifras verificadas'), { nodes: { 'Verificar cifras': resp } })[0].json;
  assert.strictEqual(cv.leido, true); assert.strictEqual(cv.corregir, true);
  assert.match(cv.conteo, /1 confirmadas, 0 por corregir, 1 viejas, 0 sin fuente; 1 datos nuevos/);
  assert.deepStrictEqual(run(codeOf(O, 'Cifras verificadas'), {})[0].json, { leido: false, verificacion: null });          // apagado
  assert.strictEqual(run(codeOf(O, 'Cifras verificadas'), { nodes: { 'Verificar cifras': { error: { message: '500' } } } })[0].json.leido, false); // falló: no bloquea
  const altas = { output: [{ content: [{ type: 'output_text', text: JSON.stringify({ gancho: 9, promesa: 9, claridad: 9, emocion: 9, exactitud: 9, originalidad: 9 }) }] }] };
  assert.strictEqual(run(codeOf(O, 'Veredicto del crítico'), { json: altas, nodes: { 'Cifras verificadas': cv } })[0].json.pasa, false);
  assert.strictEqual(run(codeOf(O, 'Veredicto del crítico'), { json: altas, nodes: { 'Cifras verificadas': { ...cv, corregir: false } } })[0].json.pasa, true);
  const ped = run(codeOf(O, 'Pedir corrección (crítico)'), { nodes: { Inicio: { video_id: 'v', canal_id: 'c', resultado: { guion: 'x' } }, 'Veredicto del crítico': { notas: {}, instrucciones: '', problemas: [] }, 'Biblia (crítico)': { resultado: '{}' }, 'Cifras verificadas': cv } })[0].json;
  assert.strictEqual(ped.datos.cifras_verificadas.faltantes[0].valor, '15.6293 soles/galón'); assert.match(ped.datos.cambios, /Datos verificados en la web/);
  const msg = run(codeOf(O, 'Mensaje de guion'), { nodes: { Inicio: { video_id: 'v', resultado: { titulo: 'T', guion: 'g', rubrica: { gancho: 8 } } }, 'Cifras verificadas': cv } })[0].json;
  assert.match(msg.aviso, /🔎 Cifras: 1 confirmadas/); assert.match(msg.mensaje, /Cuenta: S\/ 10 → IGV 1,53/);
  assert.strictEqual(aj.allowVerificacion, false);
});

test('reenviar: reenvía lo vivo con su enlace, rehace lo muerto con el pedido original y avisa lo que no se puede rehacer', () => {
  const R = wf('FabReenviar00001'); const A = wf('FabAprobacion001');
  const ini = { etapa: 'guion', video_id: 'v1', canal_id: 'c', mensaje: 'm', contexto: { titulo: 'T' } };
  const prep = run(codeOf(A, 'Aprobación · preparar'), { nodes: { Inicio: ini } })[0].json;
  assert.deepStrictEqual(JSON.parse(prep.pedido), ini);                     // la aprobación guarda su pedido
  const filas = [{ aprobacion_id: 'a1', etapa: 'guion', video_id: 'v1', url: 'https://x.ngrok-free.dev/form-waiting/457?signature=s', estado: 'pendiente', pedido: JSON.stringify(ini) },
    { aprobacion_id: 'a2', etapa: 'storyboard', video_id: 'v2', url: 'https://x.ngrok-free.dev/form-waiting/466?signature=s', estado: 'pendiente', pedido: '{}' },
    { aprobacion_id: 'a3', etapa: 'gasto', video_id: 'v3', url: 'https://x.ngrok-free.dev/form-waiting/470?signature=s', estado: 'pendiente', pedido: '' }];
  const el = run(codeOf(R, 'Elegir'), { all: { $input: filas }, nodes: { Inicio: {} } }).map(i => i.json);
  assert.strictEqual(el[0].prueba, 'http://127.0.0.1:5678/form-waiting/457?signature=s');
  assert.strictEqual(run(codeOf(R, 'Elegir'), { all: { $input: filas }, nodes: { Inicio: { video_id: 'v2' } } }).length, 1);
  const resp = [{ statusCode: 200, data: '<html><form id="n8n-form">' }, { statusCode: 401, data: 'Unauthorized' }, { statusCode: 200, data: 'Form Submitted' }];
  const d = run(codeOf(R, 'Diagnóstico'), { all: { $input: resp, Elegir: el } }).map(i => i.json);
  assert.deepStrictEqual(d.map(x => x.salida), [0, 1, 2]);
  assert.deepStrictEqual(run(codeOf(R, 'Pedido original'), { json: { pedido: JSON.stringify(ini) } })[0].json, ini);
  const t = run(codeOf(R, 'Resultado'), { all: { 'Diagnóstico': d }, nodes: { Inicio: {} } })[0].json.texto;
  assert.match(t, /mismo enlace: guion · v1/); assert.match(t, /rehechas con enlace nuevo .*storyboard · v2/); assert.match(t, /No se pueden rehacer .*gasto · v3/);
  assert.match(run(codeOf(R, 'Resultado'), { nodes: { Inicio: { video_id: 'v9' } } })[0].json.texto, /No hay aprobaciones pendientes de v9/);
  const AG = wf('FabAgenteTelegr1'); assert.ok(AG.connections['reenviar'].ai_tool);
});

// ---------- skills de YouTube (skill/youtube) ----------
const { execFileSync } = require('node:child_process');
const ALL_IDS = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const nodoDe = (w, n) => w.nodes.find(x => x.name === n);
const RAIZ_REPO = path.join(__dirname, '..');
const SK = path.join(RAIZ_REPO, 'skill', 'youtube');
const MUESTRA_GANCHOS = ['De tus 10 soles, el grifo se queda con menos de lo que crees.', 'Hoy te voy a contar algo increíble sobre los grifos, suscríbete.',
  '¿Cuánto se queda de verdad un grifo de tus 10 soles de gasolina?', 'Vende 70 mil al mes… y al dueño le quedan 7 mil.', 'Los grifos son un negocio muy interesante.',
  'Si cargas 10 soles de gasolina cada día, esto te interesa porque pierdes más de lo que crees.', 'Todos dicen que el grifo gana con la gasolina. Nadie te dice esto.',
  'En 50 segundos vas a saber cuánto paga el Estado, Petroperú y el transporte antes de que el grifo vea un sol.', '5 cosas que paga el grifo antes de ganar un sol.', 'Ñandú, Él y ÁRBOL: prueba de tildes y mayúsculas'];
const MUESTRA_TITULOS = [['Margen del grifo: ¿cuánto se queda de tus 10 soles de gasolina?', ''], ['Grifo: de tus S/ 10, ¿cuánto se queda?', 'QUEDAN S/ 2'],
  ['El INCREÍBLE SECRETO QUE NADIE SABE', ''], ['Grifo: de tus S/ 10, ¿cuánto se queda?', 'EL GRIFO GANA POCO HOY'], ['a'.repeat(105), ''], ['La pollería de Don Julio: 70 mil al mes', 'QUEDAN 7 MIL']];

test('skills de YouTube: n8n puntúa ganchos y títulos EXACTAMENTE igual que las herramientas en Python de Claude', () => {
  const O = wf('FabOrquestador01'), M = wf('FabPublicacion01');
  const ganchosJs = new Function(codeOf(O, 'Puntuar ganchos').split('\nconst r = ')[0] + '\nreturn puntuarGancho;')();
  const py = JSON.parse(execFileSync('python3', ['-c', `import json,sys; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'yt-guion'))}); import ganchos; print(json.dumps([ganchos.puntuar(t) for t in json.loads(sys.argv[1])]))`, JSON.stringify(MUESTRA_GANCHOS)]).toString());
  MUESTRA_GANCHOS.forEach((g, i) => { const j = ganchosJs(g);
    assert.deepStrictEqual({ p: j.propiedades, v: j.veredicto, b: j.banda, f: j.formula, d: j.mas_debil }, { p: py[i].propiedades, v: py[i].veredicto, b: py[i].banda, f: py[i].formula, d: py[i].mas_debil }, g); });
  const titJs = new Function(codeOf(M, 'Mensaje final').split('\nconst e = $json;')[0] + '\nreturn revisarTitulo;')();
  const pyt = JSON.parse(execFileSync('python3', ['-c', `import json,sys; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'yt-empaque'))}); import titulo; print(json.dumps([titulo.revisar(t, m or None) for t, m in json.loads(sys.argv[1])]))`, JSON.stringify(MUESTRA_TITULOS)]).toString());
  MUESTRA_TITULOS.forEach(([t, m], i) => { const j = titJs(t, m || undefined);
    assert.deepStrictEqual({ p: j.puntaje, f: j.fallas, b: j.bien, n: j.caracteres }, { p: pyt[i].puntaje, f: pyt[i].fallas, b: pyt[i].bien, n: pyt[i].caracteres }, t); });
  // separa lo malo de lo bueno (es una alerta: solo se exige el orden grueso)
  assert.ok(ganchosJs(MUESTRA_GANCHOS[0]).veredicto > ganchosJs(MUESTRA_GANCHOS[1]).veredicto + 20);
});

test('skills de YouTube: el gancho se puntúa y colapsa las filas del canal (el crítico ya no corre una vez por video)', () => {
  const O = wf('FabOrquestador01');
  const r = { ganchos: ['Los grifos son interesantes.', 'De tus 10 soles, el grifo se queda con menos de lo que crees.'], gancho_elegido: 1, titulo: 'T', guion: 'g', rubrica: { gancho: 8 } };
  const out = run(codeOf(O, 'Puntuar ganchos'), { all: { $input: [{ tema: 'a' }, { tema: 'b' }, { tema: 'c' }] }, nodes: { Inicio: { resultado: r } } });
  assert.strictEqual(out.length, 1); assert.strictEqual(out[0].json.elegido.formula, 'El dato');
  assert.match(nodoDe(O, 'Texto · Crítico del guion').parameters.jsCode, /puntaje_ganchos/);
  assert.match(nodoDe(O, 'Texto · Crítico del guion').parameters.jsCode, /La boleta/);   // el crítico GPT lleva las 21 fórmulas incrustadas
  const msg = run(codeOf(O, 'Mensaje de guion'), { nodes: { Inicio: { video_id: 'v', resultado: r } } })[0].json;
  assert.match(msg.aviso, /🪝 Gancho: \d+\/100 (FUERTE|SIRVE|DÉBIL) · El dato/); assert.match(msg.mensaje, /alerta \d+\/100/);
});

test('escala: una tabla leída entera nunca se reparte en nodos que corren por ítem (llamadas pagas o mensajes repetidos)', () => {
  const malos = [];
  for (const id of ALL_IDS) { const w = wf(id); const nd = Object.fromEntries(w.nodes.map(n => [n.name, n]));
    for (const n of w.nodes) { const p = n.parameters || {};
      if (!(n.type === 'n8n-nodes-base.dataTable' && p.operation === 'get' && p.returnAll)) continue;
      const cola = [n.name], vistos = new Set();
      while (cola.length) { const x = cola.shift(); if (vistos.has(x)) continue; vistos.add(x);
        for (const salida of (w.connections[x]?.main || [])) for (const c of salida || []) { const t = nd[c.node]; const tipo = t.type.split('.').pop();
          if ((tipo === 'code' && t.parameters?.mode !== 'runOnceForEachItem') || t.executeOnce) continue;   // colapsa o corre una vez
          if (['if', 'switch'].includes(tipo)) { cola.push(t.name); continue; }                                 // deja pasar los ítems
          malos.push(`${w.name}: ${n.name} → ${t.name}`); } } } }
  assert.deepStrictEqual(malos, []);
});

test('skills de YouTube: están en el repo, con licencia, sin preguntas y conectadas a su modo', () => {
  const skills = ['yt-guion', 'yt-empaque', 'yt-seo', 'yt-cortes', 'yt-capitulos', 'yt-retencion'];
  const fab = fs.readFileSync(path.join(RAIZ_REPO, 'skill', 'FABRICA.md'), 'utf8');
  for (const s of skills) { const md = fs.readFileSync(path.join(SK, s, 'SKILL.md'), 'utf8');
    assert.match(md, new RegExp('^---\\nname: ' + s + '\\ndescription:'), s); assert.match(md, /MIT/); assert.match(fab, new RegExp('`' + s + '`'), s + ' en FABRICA.md');
    assert.doesNotMatch(md, /ship it|voice\.md`? if it exists|ask for/i, s); }
  assert.match(fs.readFileSync(path.join(SK, 'LICENSE-youtube-agent-skill'), 'utf8'), /MIT License[\s\S]*Jake Schincariol/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(SK, 'yt-guion', 'ganchos.json'), 'utf8')).formulas.length, 21);
  const tmp = path.join(require('os').tmpdir(), 'capitulos-prueba.json');
  fs.writeFileSync(tmp, JSON.stringify([{ t: '0:00', titulo: 'Lo que pagas aquí' }, { t: '0:05', titulo: 'Lo que cobra el Estado' }]));
  const cap = JSON.parse(execFileSync('python3', [path.join(SK, 'yt-capitulos', 'capitulos.py'), tmp, '--duracion', '300']).toString());
  assert.strictEqual(cap.valido, false); assert.ok(cap.fallas.some(f => /al menos 3/.test(f)) && cap.fallas.some(f => /dura 5 s/.test(f)));
});

test('skills de YouTube: los títulos llegan a vidIQ ordenados por la revisión y, sin vidIQ, se publica el mejor revisado', () => {
  const R = wf('FabRedes00000001');
  const titulos = ['El INCREÍBLE SECRETO QUE NADIE SABE', 'Grifo: de tus S/ 10, ¿cuánto se queda?', 'a'.repeat(120)];
  const p = run(codeOf(R, 'Pedido de títulos'), { nodes: { Inicio: { contexto: { publicacion: { youtube: { titulos } } }, formato: 'short' } } })[0].json;
  assert.deepStrictEqual(p.titulos, ['Grifo: de tus S/ 10, ¿cuánto se queda?', 'El INCREÍBLE SECRETO QUE NADIE SABE']);
  assert.match(codeOf(R, 'Plan de publicación'), /const porRevision = /);
});

test('movimiento real: un Short no queda en diapositivas (gancho animado, cuota mínima, tope de clips y de gasto)', () => {
  const P = wf('FabProduccion001'); const ajc = { ...aj, allowClips: true };
  const planos = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + (i + 1), tipo: i < 3 ? 'archivo' : 'imagen', texto_narrado: 'una frase de unas doce palabras para medir la duracion del clip animado aqui', emocion: i === 6 ? 'sorpresa' : 'calma' }));
  const plan = run(codeOf(P, 'Plan de producción'), { nodes: { Inicio: { video_id: 'v', formato: 'short', storyboard: { planos }, presupuesto_usd: 2.5 }, 'Leer ajustes': ajc } })[0].json;
  const tipo = id => plan.planos.find(p => p.id === id).tipo;
  assert.strictEqual(tipo('p1'), 'archivo');                                   // ya se movía: no se toca
  assert.ok(plan.movimiento.animados.length >= 1 && plan.movimiento.animados.length <= ajc.clipsMaxShort);
  assert.ok(plan.movimiento.animados.includes('p7'), 'la escena de sorpresa se anima primero');
  assert.ok(plan.movimiento.cuota >= ajc.movimientoMinShort, 'cuota ' + plan.movimiento.cuota);
  assert.ok(plan.costo_estimado_usd <= 2.5 * ajc.avisoGastoPct + 1e-9, 'costo ' + plan.costo_estimado_usd);
  assert.ok(plan.planos.filter(p => p.tipo === 'clip').every(p => p.duracion_clip_s >= 4 && p.duracion_clip_s <= 8));
  // gancho fijo → se anima siempre
  const g = run(codeOf(P, 'Plan de producción'), { nodes: { Inicio: { formato: 'short', storyboard: { planos: planos.map(p => ({ ...p, tipo: 'imagen' })) }, presupuesto_usd: 2.5 }, 'Leer ajustes': ajc } })[0].json;
  assert.strictEqual(g.planos[0].tipo, 'clip');
  // presupuesto chico: no anima lo que no cabe
  const pobre = run(codeOf(P, 'Plan de producción'), { nodes: { Inicio: { formato: 'short', storyboard: { planos }, presupuesto_usd: 1 }, 'Leer ajustes': ajc } })[0].json;
  assert.ok(pobre.movimiento.animados.length < plan.movimiento.animados.length);
  // video largo y clips apagados: no cambia nada
  const largo = run(codeOf(P, 'Plan de producción'), { nodes: { Inicio: { formato: 'largo', storyboard: { planos } }, 'Leer ajustes': ajc } })[0].json;
  assert.strictEqual(largo.planos.filter(p => p.tipo === 'clip').length, 0);
  assert.strictEqual(run(codeOf(P, 'Plan de producción'), { nodes: { Inicio: { formato: 'short', storyboard: { planos } }, 'Leer ajustes': { ...ajc, allowClips: false } } })[0].json.planos.filter(p => p.tipo === 'clip').length, 0);
  // el clip se pide con su duración y, si llega por URI, se descarga
  assert.match(nodoDe(P, 'Animar (Gemini Omni)').parameters.jsonBody, /\[0-' \+ \(\$json\.plano\.duracion_clip_s \|\| 8\) \+ 's\]/);
  assert.strictEqual(P.connections['¿Clip por URI?'].main[0][0].node, 'Descargar clip');
  const uri = run(codeOf(P, 'Extraer clip'), { json: { steps: [{ type: 'model_output', content: [{ type: 'video', uri: 'https://g/files/x:download' }] }] }, nodes: { 'Extraer imagen': { plano: { id: 'p1' } } } })[0].json;
  assert.strictEqual(uri.clip_uri, 'https://g/files/x:download');
  // calidad avisa si el Short quedó en diapositivas
  const M = wf('FabPublicacion01');
  const q = run(codeOf(M, 'Chequeos objetivos'), { nodes: { Inicio: { render_url: 'u', planos: 10, esperados: 10, duracion_s: 50, formato: 'short', subtitulos: true, movimiento_real: 0.3 }, 'Leer ajustes': ajc } })[0].json;
  assert.ok(q.avisos.some(a => /diapositivas/.test(a)));
});

test('metas: valida, mezcla con las anteriores y no confunde un campo vacío con cero', () => {
  const v = e => run(codeOf(ORQ, 'Validar metas'), { nodes: { Inicio: e } })[0].json;
  assert.deepStrictEqual(v({ canal_id: 'mr', videos_semana: '', auto: 'sí', gasto_semana_usd: '12,5' }).cambios, { auto: true, gasto_semana_usd: 12.5 });
  assert.strictEqual(v({ canal_id: 'mr', videos_semana: '99' }).ok, false);
  assert.strictEqual(v({ videos_semana: 4 }).ok, false);
  const f = run(codeOf(ORQ, 'Fila de metas'), { json: { canal_id: 'mr', metas: '{"videos_semana":3,"retencion_min":0.4}' }, nodes: { 'Validar metas': { cambios: { videos_semana: 5, auto: true } } } })[0].json;
  const m = JSON.parse(f.metas);
  assert.strictEqual(m.videos_semana, 5); assert.strictEqual(m.retencion_min, 0.4); assert.strictEqual(m.auto, true);
  assert.strictEqual(run(codeOf(ORQ, 'Ruta'), { nodes: { Inicio: { evento: 'metas' } } })[0].json.salida, 20);
});

test('adoptar cuenta: reconoce enlaces y @usuario, y vuelve por la aprobación de canal', () => {
  const l = e => run(codeOf(ORQ, 'Leer enlace'), { nodes: { Inicio: e } })[0].json;
  assert.deepStrictEqual([l({ url: 'https://www.instagram.com/margen.real/' }).red, l({ url: 'https://www.instagram.com/margen.real/' }).handle], ['instagram', 'margen.real']);
  assert.strictEqual(l({ url: 'https://www.tiktok.com/@margenreal?lang=es' }).handle, 'margenreal');
  assert.strictEqual(l({ url: 'https://youtube.com/@MargenRealtv' }).handle, '@MargenRealtv');
  assert.strictEqual(l({ url: '@MargenRealtv', red: 'youtube' }).handle, '@MargenRealtv');
  assert.strictEqual(l({ url: 'hola mundo' }).ok, false);
  const r = run(codeOf(ORQ, 'Ruta'), { nodes: { Inicio: { evento: 'claude_ok', modo: 'adoptar_cuenta' } } })[0].json;
  assert.strictEqual(r.clave, 'claude_ok:investigar_nichos');
  assert.strictEqual(run(codeOf(ORQ, 'Ruta'), { nodes: { Inicio: { evento: 'adoptar_cuenta' } } })[0].json.salida, 21);
  run(codeOf(CL, 'Preparar trabajo'), { nodes: { Inicio: { modo: 'adoptar_cuenta', datos: {} }, 'Leer ajustes': aj } });
  // El canal adoptado guarda la cuenta y las metas propuestas; la biblia recibe el diagnóstico.
  const ctx = { canal: { nombre_propuesto: 'Margen Real', formatos: ['short'] }, cuenta: { red: 'instagram', handle: 'x' }, diagnostico: { cambiar: ['a'] }, metas: { videos_semana: 4, auto: true } };
  const c = run(codeOf(ORQ, 'Nuevo canal'), { json: { contexto: ctx }, nodes: { 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(c.plataformas, 'instagram'); assert.strictEqual(JSON.parse(c.metas).videos_semana, 4); assert.strictEqual(JSON.parse(c.cuenta).handle, 'x');
  const b = run(codeOf(ORQ, 'Pedir biblia'), { nodes: { 'Según evento': { contexto: ctx }, 'Nuevo canal': c } })[0].json;
  assert.match(b.datos.notas, /Cuenta existente adoptada/);
  const re = run(codeOf(ORQ, 'Reinvestigar'), { json: { contexto: ctx, cambios: 'más humor' } })[0].json;
  assert.strictEqual(re.modo, 'adoptar_cuenta'); assert.match(re.datos.notas, /más humor/);
  const m = run(codeOf(ORQ, 'Mensaje de canal'), { nodes: { Inicio: { resultado: { ...ctx, metas: { videos_semana: 4, gasto_semana_usd: 10 } } } } })[0].json;
  assert.match(m.mensaje, /^Adopción de cuenta/); assert.match(m.mensaje, /Metas propuestas: 4/);
});

test('vidIQ cuenta: llamadas por red y resumen tolerante a fallos', () => {
  const VQ = wf('FabVidiq00000001');
  const ll = e => run(codeOf(VQ, 'Llamadas de cuenta'), { nodes: { Inicio: e } }).map(i => i.json.nombre);
  assert.deepStrictEqual(ll({ red: 'instagram', handle: 'x' }), ['vidiq_ig_profile', 'vidiq_ig_profile_reels']);
  assert.deepStrictEqual(ll({ red: 'tiktok', handle: 'x' }), ['vidiq_tiktok_profile', 'vidiq_tiktok_profile_videos']);
  assert.strictEqual(ll({ red: 'youtube', handle: '@x' })[0], 'vidiq_channel_stats');
  const ok = t => ({ data: 'data: ' + JSON.stringify({ result: { content: [{ type: 'text', text: t }] } }) });
  const r = run(codeOf(VQ, 'Resumen de cuenta'), { all: { $input: [ok('perfil 1200 seguidores'), { data: '{"error":{"message":"x"}}' }] } })[0].json;
  assert.strictEqual(r.ok, true); assert.match(r.perfil, /1200/); assert.strictEqual(r.creditos, 5);
  const sw = VQ.nodes.find(n => n.name === 'Según acción');
  assert.strictEqual(sw.parameters.numberOutputs, 3);
});

test('rutina: produce sola hacia la meta, con tope, un video a la vez y freno de calidad', () => {
  const RU = wf('FabRutina0000001');
  const ahora = new Date().toISOString();
  const canal = (id, metas) => ({ canal_id: id, estado: 'activo', metas: JSON.stringify(metas) });
  const plan = (canales, vids, costos) => run(codeOf(RU, 'Plan del día'), { nodes: { 'Leer ajustes': aj }, all: { 'Canales activos': canales, 'Videos en curso': vids, $input: costos } })[0].json;
  const m = { videos_semana: 4, formato: 'short', gasto_semana_usd: 10, retencion_min: 0.5, auto: true };
  // Debajo de la meta y con presupuesto: pide un Short sin tema.
  let p = plan([canal('mr', m), canal('otro', { ...m, auto: false })], [{ video_id: 'v1', canal_id: 'mr', estado: 'publicado', createdAt: ahora }], [{ video_id: 'v1', usd: 1.6 }]);
  assert.strictEqual(p.pedidos.length, 1); assert.strictEqual(p.pedidos[0].evento, 'nuevo_video'); assert.strictEqual(p.pedidos[0].tema, '');
  assert.strictEqual(p.pedidos[0].formato, 'short'); assert.match(p.texto, /2\/4/);
  // Tope: 8.5 gastados + 2.5 de un Short > 10.
  p = plan([canal('mr', m)], [{ video_id: 'v1', canal_id: 'mr', estado: 'publicado', createdAt: ahora }], [{ video_id: 'v1', usd: 8.5 }]);
  assert.strictEqual(p.pedidos.length, 0); assert.match(p.texto, /tope semanal/);
  // Uno en curso: espera.
  p = plan([canal('mr', m)], [{ video_id: 'v1', canal_id: 'mr', estado: 'en_proceso', createdAt: ahora }], []);
  assert.strictEqual(p.pedidos.length, 0); assert.match(p.texto, /en curso/);
  // Freno de calidad: 3 últimos con retención media bajo la meta.
  const malos = [1, 2, 3].map(i => ({ video_id: 'v' + i, canal_id: 'mr', estado: 'publicado', createdAt: ahora, retencion_media: 0.3 }));
  p = plan([canal('mr', m)], malos, []);
  assert.strictEqual(p.pedidos.length, 0); assert.match(p.texto, /freno de calidad/);
  // Meta cumplida.
  p = plan([canal('mr', { ...m, videos_semana: 3 })], malos.map(v => ({ ...v, retencion_media: 0.7 })), []);
  assert.match(p.texto, /meta cumplida/);
  // Sin canales en automático: nada.
  assert.strictEqual(plan([canal('otro', { ...m, auto: false })], [], []).nada, true);
});

test('aprender: guarda la retención media de cada video medido', () => {
  const AP = wf('FabAprendizaje01');
  const r = run(codeOf(AP, 'Retención media'), { all: { 'Pedidos de retención': [{ video_id: 'v1' }, { video_id: 'v2' }], $input: [{ rows: [[0.1, 0.9], [0.5, 0.5], [1, 0.1]] }, { error: 'x' }] } });
  assert.deepStrictEqual(r.map(i => i.json), [{ video_id: 'v1', retencion_media: 0.5 }]);
});

test('telegram: todos los mensajes van en HTML escapado (un «_» o «<» ya no rompe el envío ni detiene el flujo)', () => {
  let n = 0;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) for (const nd of wf(f.replace('.json', '')).nodes.filter(x => x.type === 'n8n-nodes-base.telegram')) {
    n++; assert.strictEqual(nd.parameters.additionalFields.parse_mode, 'HTML', f + ' · ' + nd.name);
    const t = nd.parameters.text;
    if (nd.name !== 'Avisar error' && t.startsWith('=')) assert.match(t, /^=\{\{ String\(.*\.replace\(\/&\/g, '&amp;'\)\.replace\(\/<\/g, '&lt;'\)\.replace\(\/>\/g, '&gt;'\) \}\}$/s, f + ' · ' + nd.name);
  }
  assert.ok(n > 30);
});

test('especialistas por red: cada red sale a la hora que propone su especialista (6–23 h) y con su propio texto', () => {
  const RED = wf('FabRedes00000001');
  const pub = { youtube: { titulos: ['T1'], hora: 17 }, tiktok: { texto: 'solo tiktok', hashtags: ['negocios'], hora: 21 }, instagram: { texto: 'solo reels', hora: 3 } };
  const inicio = { video_id: 'v', canal_id: 'c', tema: 'Tema', formato: 'short', perfil: 'p', redes: 'youtube,tiktok,instagram', contexto: { render_url: 'https://r.mp4', publicacion: pub } };
  const out = run(codeOf(RED, 'Plan de publicación'), { nodes: { Inicio: inicio, 'Leer ajustes': aj }, all: { 'Agenda del canal': [] } }).map(i => i.json);
  const por = Object.fromEntries(out.map(o => [o.plataformas, o]));
  assert.ok(hl(por.youtube.programado).endsWith(', 17:00')); assert.ok(hl(por.tiktok.programado).endsWith(', 21:00'));
  assert.ok(hl(por.instagram.programado).endsWith(', 20:00'));   // 3 h no es válida: queda la de Ajustes
  assert.ok(cuerpoDe(por.tiktok).includes('solo tiktok\n\n#negocios')); assert.ok(cuerpoDe(por.instagram).includes('solo reels'));
});

test('radar de tendencias: consultas por canal, encargo al analista, guardado por canal y uso en guion y storyboard', () => {
  const VQ = wf('FabVidiq00000001'), RA = wf('FabRadar00000001');
  const ll = run(codeOf(VQ, 'Llamadas de cuenta'), { nodes: { Inicio: { accion: 'radar', nicho: 'negocios con números reales' } } }).map(i => i.json);
  assert.deepStrictEqual(ll.map(x => x.nombre), ['vidiq_instagram_tiktok_outlier_search', 'vidiq_outliers', 'vidiq_tiktok_trending_sound_search']);
  assert.match(ll[0].args.audienceQuery, /^Culture\/Region: .+; Global: false; Demographics: .+;$/);
  const ped = run(codeOf(RA, 'Pedidos de radar'), { all: { $input: [{ canal_id: 'mr', nombre: 'Margen Real', nicho: 'negocios', estado: 'activo' }, { canal_id: 'x' }] } }).map(i => i.json);
  assert.strictEqual(ped.length, 1); assert.strictEqual(ped[0].accion, 'radar');
  const enc = run(codeOf(RA, 'Encargo del analista'), { all: { 'Pedidos de radar': ped, $input: [{ ok: true, textos: ['REELS', 'SHORTS', 'SONIDOS'], creditos: 15 }] } })[0].json;
  assert.match(enc.prompt, /REELS[\s\S]*SHORTS[\s\S]*SONIDOS/); assert.match(enc.prompt, /CapCut/);
  const salida = t => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(t) }] }] });
  const r = run(codeOf(RA, 'Radar del canal'), { all: { 'Encargo del analista': [enc, { ...enc, canal_id: 'b', nombre: 'B' }], $input: [salida({ resumen: 'r', ideas: [{ titulo: 'Kebab', red: 'tiktok', gancho: 'g' }], sonidos: [] }), { error: 'x' }] } }).map(i => i.json);
  assert.deepStrictEqual(r.map(x => x.ok), [true, false]); assert.strictEqual(JSON.parse(r[0].tendencias).ideas[0].titulo, 'Kebab');
  const m = run(codeOf(RA, 'Mensaje de radar'), { all: { 'Competencia comprobada': r.map((x,i)=>({...x,tendencias:JSON.stringify({competencia:{estado:i?'parcial':'listo',competidores:i?[]:[{},{},{}],resumen:i?'Sin muestra comparable.':'r'}})})) } })[0].json.texto;
  assert.match(m, /Margen Real: investigación disponible · 3 competidores/); assert.match(m, /B: investigación incompleta · 0 competidores/);assert.ok(m.length<=3900);
  const ver = run(codeOf(RA, 'Radar guardado'), { nodes: { Inicio: { accion: 'ver' } }, all: { $input: [{ canal_id: 'mr', nombre: 'Margen Real', tendencias: r[0].tendencias }] } })[0].json.respuesta;
  assert.match(ver, /1\. \[tiktok\] Kebab/);
  // El guionista recibe el radar si tiene menos de 3 días; uno viejo no se usa.
  const nv = t => run(codeOf(ORQ, 'Nuevo video'), { nodes: { Inicio: { canal_id: 'mr', tema: '' }, 'Buscar canal': { canal_id: 'mr', tendencias: t }, 'Buscar biblia': { resultado: '{}' }, 'Leer ajustes': aj }, all: { $input: [] } })[0].json.pedido.datos.tendencias;
  assert.strictEqual(nv(r[0].tendencias).ideas[0].titulo, 'Kebab');
  assert.strictEqual(nv(JSON.stringify({ fecha: '2026-01-01T00:00:00Z', ideas: [] })), null);
  const sb = run(codeOf(ORQ, 'Pedir storyboard'), { nodes: { Inicio: { canal_id: 'mr', video_id: 'v' }, 'Biblia del video': { resultado: '{}' }, Video: { formato: 'short' }, 'Canal del video': { tendencias: r[0].tendencias }, 'Leer ajustes': aj } })[0].json;
  assert.strictEqual(sb.datos.tendencias.resumen, 'r');
  // Los especialistas existen y el contrato los nombra.
  for (const red of ['tiktok', 'instagram', 'youtube']) assert.ok(fs.existsSync(path.join(__dirname, '..', 'skill', 'roles', `especialista-${red}.md`)));
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'skill', 'FABRICA.md'), 'utf8'), /especialista-tiktok\.md/);
});

const FX = wf('FabCooperAPI0001'), PROGRESO = wf('FabCooperProgr01'), COSTO = wf('FabCooperCosto01');
const contratoCooper = require('../cooper/src/contratos/cooper-v1.json');
const cryptoCooper = require('node:crypto');
const tokenCooper = cryptoCooper.randomBytes(32).toString('hex');
const envCooper = { COOPER_N8N_TOKEN: tokenCooper, COOPER_WEBHOOK_SECRET: tokenCooper, COOPER_ADMIN_EMAIL: 'admin@example.test' };
const solicitudCooper = (evento, datos = {}, extra = {}) => ({ version: 'cooper-v1', id_evento: cryptoCooper.randomUUID(), evento, dueno_email: 'ana@example.test', admin: false, datos, ...extra });
const canalCooper = { canal_id: 'c-ana', dueno_email: 'ana@example.test', nombre: 'Ciencia', nicho: 'Ciencia', estado: 'activo', biblia_ruta: 'trabajo:j', costo_usd: 999, presupuesto_largo_usd: 999 };
const videoCooper = { video_id: 'v-ana', canal_id: 'c-ana', dueno_email: 'ana@example.test', tema: 'Cielo', etapa: 'aprobacion_guion', guion_cooper: 'Guion', cooper_actualizado_en: 1, costo_usd: 999 };
function resolverCooper(b, { canales = [canalCooper], videos = [videoCooper], aprobaciones = [], trabajos = [], eventos = [], publicaciones = [], conexiones = [], ajustes = aj } = {}) {
  return run(codeOf(FX, 'Resolver'), { nodes: { 'Ajustes de Cooper': ajustes, Autenticar: { solicitud: b, admin: b.admin, dueno_email: b.dueno_email } },
    all: { 'Canales autorizados': canales, 'Videos autorizados': videos, Aprobaciones: aprobaciones, 'Lecciones de Cooper': trabajos, 'Historial de Cooper': eventos, 'Decisiones de Cooper': aprobaciones, 'Publicaciones de Cooper': publicaciones, 'Conexiones de Cooper': conexiones } })[0].json;
}
test('Cooper: token obligatorio, fallo cerrado y admin contrastado con entorno', () => {
  const auth = (body, authorization, env = envCooper) => run(codeOf(FX, 'Autenticar'), { json: { body, headers: { authorization } }, env })[0].json;
  assert.strictEqual(auth(solicitudCooper('estado'), '').status, 401);
  assert.strictEqual(auth(solicitudCooper('estado'), 'Bearer ' + tokenCooper, {}).status, 401);
  assert.strictEqual(auth(solicitudCooper('estado'), 'Bearer ' + tokenCooper).status, 200);
  assert.strictEqual(auth(solicitudCooper('estado', {}, { admin: true }), 'Bearer ' + tokenCooper).status, 403);
  assert.strictEqual(auth(solicitudCooper('gastos'), 'Bearer ' + tokenCooper).status, 403);
  assert.strictEqual(auth(solicitudCooper('gastos', {}, { admin: true, dueno_email: envCooper.COOPER_ADMIN_EMAIL }), 'Bearer ' + tokenCooper).status, 200);
  assert.strictEqual(auth(solicitudCooper('inventado'), 'Bearer ' + tokenCooper).status, 400);
});
test('Cooper: estado proyecta solo recursos propios y jamás columnas internas', () => {
  const result = resolverCooper(solicitudCooper('estado'), { canales: [canalCooper, { ...canalCooper, canal_id:'otro', dueno_email:'otro@example.test' }],
    videos: [videoCooper, { ...videoCooper, video_id:'otro', canal_id:'otro', dueno_email:'otro@example.test' }] });
  assert.deepStrictEqual(result.respuesta.videos.map(v=>v.id), ['v-ana']);
  assert.ok(!JSON.stringify(result.respuesta).match(/costo|presupuesto|999|servicio/));
  assert.strictEqual(result.respuesta.videos[0].stage, 3);
});
test('Cooper: cada mutación de recursos rechaza al dueño ajeno', () => {
  for (const evento of Object.keys(contratoCooper.eventos).filter(x=>x!=='nuevo_canal')) {
    const out = resolverCooper(solicitudCooper(evento, { id:'v-ana', recursoId:'v-ana', canalId:'c-ana', accion:'referencias', confirmado:true, tipo:'video', texto:'Cambio' }, { dueno_email:'otro@example.test' }));
    assert.strictEqual(out.status, 404, evento);
  }
});
test('Cooper: el administrador puede consultar todo y las filas sin dueño quedan excluidas', () => {
  const out = resolverCooper(solicitudCooper('estado',{}, { admin:true, dueno_email:'admin@example.test' }), {
    canales:[canalCooper, {...canalCooper, canal_id:'sin', dueno_email:''}], videos:[videoCooper] });
  assert.strictEqual(out.respuesta.canales.length,1);
  assert.strictEqual(out.respuesta.videos.length,1);
});
test('Cooper: mapea todas las órdenes al Orquestador sin aceptar identidades de datos', () => {
  for (const evento of Object.keys(contratoCooper.eventos).filter(x=>!['aprobar_guion','aprobar_final'].includes(x))) {
    const isVideo = ['corregir','programar','referencias'].includes(evento);
    const datos = { id:'nuevo-id', recursoId:isVideo?'v-ana':'c-ana', texto: evento==='programar'?new Date(Date.now()+7200000).toISOString():'3 videos por semana',
      parametros:{ perfil:'ciencia', redes:['youtube'] }, dueno_email:'falso@example.test' };
    if(evento==='eliminar') Object.assign(datos,{id:'v-ana',tipo:'video'});
    if(evento==='control_fabrica')Object.assign(datos,{accion:'referencias',canalId:'c-ana',confirmado:true});
    const out=resolverCooper(solicitudCooper(evento,datos));
    assert.strictEqual(out.accion,'orden',evento); assert.strictEqual(out.evento.evento,evento==='control_fabrica'?'referencias':evento);
    assert.strictEqual(out.evento.dueno_email,'ana@example.test');
  }
});
test('Cooper: las dos aprobaciones usan contexto persistido y exigen etapa y decisión pendientes', () => {
  for(const etapa of ['guion','final']) {
    const b=solicitudCooper('aprobar_'+etapa,{id:'v-ana',contexto:{falso:true}});
    const videos=[{...videoCooper,etapa:'aprobacion_'+etapa}];
    assert.strictEqual(resolverCooper(b,{videos}).status,409);
    const aprobaciones=[{aprobacion_id:'ap1',video_id:'v-ana',etapa,estado:'pendiente',pedido:JSON.stringify({contexto:{verificado:true}})}];
    const out=resolverCooper(b,{videos,aprobaciones});
    assert.strictEqual(out.evento.evento,'aprobado'); assert.strictEqual(out.evento.etapa,etapa);
    assert.deepStrictEqual(out.evento.contexto,{verificado:true});
    assert.strictEqual(resolverCooper(b,{videos:[{...videoCooper,etapa:'produccion'}],aprobaciones}).status,409);
  }
});
test('Cooper: validación de campos, programación y eliminación durante producción', () => {
  for(const [evento,datos] of [
    ['ajustar_biblia',{parametros:{campo:'constructor.prototype'}}], ['configurar_redes',{}], ['programar',{texto:'ayer'}], ['metas',{texto:'muchos'}],
  ]) assert.strictEqual(resolverCooper(solicitudCooper(evento,{id:'x',recursoId:evento==='programar'?'v-ana':'c-ana',texto:'texto',...datos})).status,400);
  assert.strictEqual(resolverCooper(solicitudCooper('eliminar',{id:'v-ana',tipo:'video'}),{videos:[{...videoCooper,etapa:'produccion'}]}).status,409);
});
test('Cooper: consultas textuales excluyen gastos y eliminados', () => {
  for(const event of ['reporte','pendientes','tendencias']) {
    const out=resolverCooper(solicitudCooper(event),{videos:[{...videoCooper,eliminado:true}]});
    assert.ok(!JSON.stringify(out.respuesta).match(/999|presupuesto|costo|Cielo/));
  }
});
test('Cooper: gasto por día, semana y mes con dueño y solo administrador', () => {
  const code=codeOf(FX,'Agregar gastos');
  assert.strictEqual(run(code,{nodes:{Autenticar:{admin:false}}})[0].json.status,403);
  const now=new Date().toISOString();
  const out=run(code,{nodes:{Autenticar:{admin:true}}, all:{$input:[
    {dueno_email:'ana@example.test',usd:0.002,createdAt:now,estimado:true},
    {dueno_email:'ana@example.test',usd:1,createdAt:now}, {dueno_email:'luis@example.test',usd:2,createdAt:now,estimado:false},
    {dueno_email:'ana@example.test',usd:-7,createdAt:now}, {usd:50,createdAt:now},
  ]}})[0].json.respuesta;
  assert.deepStrictEqual(out.gastos,[{dueno_email:'ana@example.test',dia:1.002,semana:1.002,mes:1.002},{dueno_email:'luis@example.test',dia:2,semana:2,mes:2}]);
  assert.strictEqual(out.estimados,true);
});
test('Cooper: HMAC firma exactamente los bytes transmitidos y no incluye costos', () => {
  const event=run(codeOf(PROGRESO,'Progreso público'),{nodes:{Inicio:{...videoCooper,cooper_evento_id:'evento-1'}}})[0].json;
  const signed=run(codeOf(PROGRESO,'Firmar progreso'),{nodes:{'Progreso público':event},env:envCooper})[0].json;
  const digest=cryptoCooper.createHmac('sha256',tokenCooper).update(signed.timestamp+'.'+signed.cuerpo).digest('hex');
  assert.strictEqual(signed.firma,'sha256='+digest);assert.deepStrictEqual(JSON.parse(signed.cuerpo),event);
  assert.ok(!signed.cuerpo.includes('999'));
  const http=PROGRESO.nodes.find(n=>n.name==='Avisar a Cooper');
  assert.strictEqual(http.parameters.contentType,'raw'); assert.strictEqual(http.parameters.body,'={{ $json.cuerpo }}');
});
test('Cooper: atribución de costo consulta el dueño de las tablas y rechaza huérfanos', () => {
  const args={nodes:{Inicio:{video_id:'v-ana',usd:0.1,concepto:'voz',servicio:'prueba',dueno_email:'falso'},'Video del costo':videoCooper,'Canal del costo':canalCooper}};
  assert.strictEqual(run(codeOf(COSTO,'Costo atribuido'),args)[0].json.dueno_email,'ana@example.test');
  assert.throws(()=>run(codeOf(COSTO,'Costo atribuido'),{nodes:{...args.nodes,'Canal del costo':{}}}),/sin dueño/);
  assert.strictEqual(COSTO.nodes.find(n=>n.name==='Guardar costo atribuido').parameters.operation,'upsert');
});
test('Cooper: todas las escrituras de etapa avisan tras persistir y existen las doce etapas', () => {
  assert.deepStrictEqual(Object.values(contratoCooper.etapas),Array.from({length:12},(_,i)=>i));
  for(const id of ['FabOrquestador01','FabProduccion001','FabPublicacion01','FabRedes00000001','FabConfirmar0001']) {
    const flow=wf(id);
    for(const n of flow.nodes.filter(n=>n.type.endsWith('.dataTable') && ['insert','update'].includes(n.parameters.operation) && n.parameters.dataTableId.value==='VIfMDnjzrrw1p2EA')) {
      const next=flow.connections[n.name].main[0][0].node;
      assert.strictEqual(flow.nodes.find(x=>x.name===next).parameters.workflowId.value,'FabCooperProgr01',id+':'+n.name);
    }
  }
});
test('Cooper: reserva antes de despachar y confirmación antes de aceptar; no guarda tokens en ejecuciones', () => {
  const edges=n=>FX.connections[n].main.flat().map(x=>x.node);
  assert.deepStrictEqual(edges('¿Autorizado?'),['¿Consultar recibo?','Responder']);
  assert.deepStrictEqual(edges('Consultar orden'),['Recibo anterior']);
  assert.deepStrictEqual(edges('Recibo anterior'),['Canales autorizados','Aceptado','En proceso']);
  assert.match(codeOf(FX,'Firmar consulta de orden'),/fase:'consultar'/);
  assert.deepStrictEqual(edges('Reservar orden'),['Estado de reserva']);
  assert.deepStrictEqual(edges('Entregar al Orquestador'),['Firmar confirmación']);
  assert.deepStrictEqual(edges('Confirmar orden'),['Aceptado']);
  assert.strictEqual(FX.settings.saveDataErrorExecution,'none'); assert.strictEqual(FX.settings.saveDataSuccessExecution,'none');
  for(const id of ['FabCooperAPI0001','FabCooperProgr01','FabCooperCosto01']) {
    const flow=wf(id), names=new Set(flow.nodes.map(n=>n.name));
    for(const [name, outputs] of Object.entries(flow.connections)) {
      assert.ok(names.has(name)); for(const edge of outputs.main.flat()) assert.ok(names.has(edge.node),edge.node);
    }
  }
});
test('Cooper: atribuye trabajos desde tablas y rechaza huérfanos sin confiar en el pedido', () => {
  const fila = { job_id:'j', video_id:'v', canal_id:'c', dueno_email:'falso@example.test' };
  const ejecutar = (video, canal, datos=fila) => run(codeOf(CL,'Atribuir trabajo'), { nodes: {
    'Preparar trabajo':{fila:datos}, 'Video del trabajo':video, 'Canal del trabajo':canal }, env:envCooper })[0].json;
  assert.strictEqual(ejecutar({dueno_email:'ana@example.test',canal_id:'c'}, {dueno_email:'ana@example.test'}).dueno_email,'ana@example.test');
  assert.throws(() => ejecutar({}, {dueno_email:'ana@example.test'}), /sin dueño/);
  assert.throws(() => ejecutar({dueno_email:'ana@example.test',canal_id:'c'}, {dueno_email:'otra@example.test'}), /sin dueño/);
  assert.strictEqual(ejecutar({}, {}, {job_id:'investigacion',video_id:'',canal_id:''}).dueno_email,envCooper.COOPER_ADMIN_EMAIL);
});
test('Cooper: todos los nodos Code compilan y todo el grafo apunta a nodos existentes', () => {
  for (const filename of fs.readdirSync(dir).filter(x=>x.endsWith('.json'))) {
    const flow = JSON.parse(fs.readFileSync(path.join(dir,filename),'utf8'));
    const names = new Set(flow.nodes.map(n=>n.name));
    assert.strictEqual(names.size,flow.nodes.length,filename);
    for (const node of flow.nodes) if(node.parameters.jsCode) assert.doesNotThrow(()=>new Function(node.parameters.jsCode),filename+':'+node.name);
    for(const [source,kinds] of Object.entries(flow.connections)) {
      assert.ok(names.has(source),filename+':'+source);
      for(const edges of Object.values(kinds)) for(const edge of edges.flat()) assert.ok(names.has(edge.node),filename+':'+edge.node);
    }
  }
});
test('Cooper: cada clip se cobra con su duración y cada gasto conserva el ID emisor', () => {
  const p = wf('FabProduccion001');
  const out = run(codeOf(p,'Cooper · costo Animar (Gemini Omni)'), { nodes: { Inicio:{video_id:'v-ana'}, 'Leer ajustes':aj },
    all: { $input:[{},{}], 'Un ítem por plano':[{plano:{duracion_clip_s:4}},{plano:{duracion_clip_s:9}}] } });
  assert.strictEqual(out[0].json.usd,4*aj.costoClipSegUsd);assert.strictEqual(out[1].json.usd,9*aj.costoClipSegUsd);
  const stamp=codeOf(ORQ,'Cooper · identificar Guardar costo (crítico)');
  const once=run(stamp,{json:{usd:0.02}})[0].json;
  assert.strictEqual(run(stamp,{json:once})[0].json.paso_id,once.paso_id);
});

test('Integración: la fábrica sigue rechazando los recursos de demostración', () => {
  for (const proveedor of ['simulada']) {
    const out = resolverCooper(solicitudCooper('nuevo_video', {
      id: 'video-presentador', recursoId: 'c-ana', texto: 'Ensayo',
      presentacion: { version: 1, presencia: 'completo', avatar: { proveedor, id: 'ficticio', recurso_id: 'local', tipo: 'propio' }, voz: null },
    }));
    assert.strictEqual(out.status, 422);
    assert.strictEqual(out.accion, 'responder');
  }
});

const presentacionReal = (presencia = 'partes', proveedor = 'gemini') => ({version:1,presencia,
  avatar:{recurso_id:'avatar-local',proveedor:'heygen',id:'look-elegido',tipo:'propio'},
  voz:{recurso_id:'voz-local',proveedor,id:proveedor === 'gemini' ? 'Charon' : 'voz-clonada',tipo:proveedor === 'gemini' ? 'catalogo' : 'propio'}});
const encendido = {...aj,allowAvatar:true,allowVoz:true,allowMontaje:true,allowDrive:true,allowImagenes:true};
const planPresentacion = (p, cambios = {}, ajustes = encendido) => run(codeOf(PROD,'Plan de producción'),{nodes:{Inicio:{video_id:'v-ana',formato:'largo',presupuesto_usd:20,
  presentacion:p,storyboard:{planos:storyboard.planos.map((p,i)=>({...p,tipo:'imagen',usa_avatar:i===0}))},...cambios},'Leer ajustes':ajustes}})[0].json;
const expNodo = (flow,name,key,ctx) => {
  const expr=flow.nodes.find(n=>n.name===name).parameters[key];
  return run('return {json:('+expr.slice(3,-2)+')};',ctx)[0].json;
};

test('presentación: FX valida referencias, conserva la orden y no acepta simulados ni contratos incompletos', () => {
  const p=presentacionReal();
  const request=solicitudCooper('nuevo_video',{id:'v-presentacion',recursoId:'c-ana',texto:'Ensayo',presentacion:p});
  const out=resolverCooper(request);
  assert.strictEqual(out.status,200); assert.deepStrictEqual(out.evento.presentacion,p);
  assert.strictEqual(out.evento.cooper_orden_id,request.id_evento);
  for (const bad of [{...p,version:2},{...p,avatar:{...p.avatar,proveedor:'gemini'}},{...p,voz:{...p.voz,tipo:'propio'}},{...p,evidencia:'privada'}])
    assert.strictEqual(resolverCooper({...request,datos:{...request.datos,presentacion:bad}}).status,400);
  assert.strictEqual(resolverCooper({...request,datos:{...request.datos,presentacion:undefined,avatarId:'sin-resolver'}}).status,422);
});

test('presentación: nuevo video persiste el contrato y se recupera para storyboard, corrección y producción', () => {
  const p=presentacionReal(),e={video_id:'v-ana',canal_id:'c-ana',tema:'Ensayo',presentacion:p,cooper_orden_id:'orden'};
  const nuevo=run(codeOf(ORQ,'Nuevo video'),{nodes:{Inicio:e,'Buscar canal':{canal_id:'c-ana',dueno_email:'ana@example.test'},'Buscar biblia':{resultado:'{}'}}})[0].json;
  assert.deepStrictEqual(JSON.parse(nuevo.fila.presentacion),p);assert.strictEqual(nuevo.fila.cooper_orden_id,'orden');
  assert.deepStrictEqual(nuevo.pedido.datos.presentacion,p);
  for (const [name,v,b,c] of [['Pedir storyboard','Video','Biblia del video','Canal del video'],['Pedir storyboard corregido','Video (rehacer)','Biblia (rehacer)','Canal (rehacer)']]) {
    const out=run(codeOf(ORQ,name),{nodes:{Inicio:e,[v]:{presentacion:JSON.stringify(p),presupuesto_usd:5},[b]:{resultado:'{}'},[c]:{},'Leer ajustes':aj}})[0].json;
    assert.deepStrictEqual(out.datos.presentacion,p);assert.match(out.datos.presentacion_instrucciones,/usa_avatar/);
  }
  const out=run(codeOf(ORQ,'Encargo de producción'),{nodes:{Inicio:e,'Video (producción)':{presentacion:JSON.stringify(p)},'Biblia (producción)':{resultado:'{}'}},all:{'Trabajos (producción)':[]}})[0].json;
  assert.deepStrictEqual(out.presentacion,p);
});

test('presentación: completo cubre todas las narraciones; partes respeta el subconjunto del storyboard', () => {
  const full=planPresentacion(presentacionReal('completo'));
  assert.deepStrictEqual(full.planos.map(p=>p.tipo),['avatar','avatar']);
  const part=planPresentacion(presentacionReal());
  assert.deepStrictEqual(part.planos.map(p=>p.tipo),['avatar','imagen']);
  assert.deepStrictEqual(part.planos[0].presentacion,part.presentacion);
  assert.throws(()=>planPresentacion(presentacionReal(),{storyboard:{planos:storyboard.planos}}),/solo algunas/);
  assert.throws(()=>planPresentacion({...presentacionReal(),avatar:null},{storyboard:{planos:[{id:'p',tipo:'avatar',texto_narrado:'Hola'}]}}),/sin presentación/);
});

test('presentación: interruptores y presupuesto cero paran sin perder la elección', () => {
  const p=presentacionReal();
  for (const [settings,bloqueo] of [[{allowAvatar:false},'avatar_apagado'],[{allowVoz:false},'voz_apagada'],[{allowMontaje:false},'produccion_pausada']]) {
    const out=planPresentacion(p,{}, {...encendido,...settings});assert.strictEqual(out.bloqueo,bloqueo);assert.deepStrictEqual(out.presentacion,p);
  }
  const out=planPresentacion(p,{presupuesto_usd:0});assert.strictEqual(out.bloqueo,'presupuesto');assert.strictEqual(out.dentro,false);
  assert.deepStrictEqual(out.presentacion,p);
});

test('presentación: cada voz usa su transporte y el catálogo usa Ajustes.modeloVoz', async () => {
  const calls=[];
  const fake=async (url,body) => {calls.push({url,body});return {data:{audio_url:'https://media.example.test/voz.wav',duration:2}};};
  for (const proveedor of ['gemini','heygen','elevenlabs']) {
    const p=presentacionReal('completo',proveedor),plan=planPresentacion(p);
    const textos=run(codeOf(SON,'Textos de voz'),{nodes:{Inicio:{video_id:'v-ana',presentacion:p,planos:plan.planos.map(plano=>({plano,plano_id:plano.id}))},'Leer ajustes':encendido}});
    assert.strictEqual(textos.length,2);
    for (const {json:t} of textos) {assert.strictEqual(t.voz,p.voz.id);assert.strictEqual(t.proveedor,proveedor);}
    const name={gemini:'Voz (Gemini TTS)',heygen:'Voz (HeyGen)',elevenlabs:'Voz (ElevenLabs)'}[proveedor];
    const node=SON.nodes.find(n=>n.name===name),ctx={json:textos[0].json,nodes:{'Leer ajustes':{...encendido,modeloVoz:'modelo-configurado'}}};
    const body=expNodo(SON,name,'jsonBody',ctx);
    const url=node.parameters.url.startsWith('=') ? expNodo(SON,name,'url',ctx) : node.parameters.url;
    await fake(url,body);
    assert.ok(!node.retryOnFail,'No repetir síntesis incierta');
    if(proveedor==='gemini'){assert.strictEqual(body.model,'modelo-configurado');assert.strictEqual(body.generation_config.speech_config[0].voice,'Charon');}
    if(proveedor==='heygen'){assert.strictEqual(body.voice_id,'voz-clonada');assert.ok(!body.text.includes('<short pause>'));}
    if(proveedor==='elevenlabs'){assert.match(url,/voz-clonada\/with-timestamps\?output_format=pcm_24000$/);assert.strictEqual(body.model_id,'eleven_multilingual_v2');}
  }
  assert.strictEqual(calls.length,3);
});

test('presentación: PCM ElevenLabs se mide como WAV y HeyGen exige duración acreditada', () => {
  const pcm=Buffer.alloc(48000);for(let i=0;i<24000;i++)pcm.writeInt16LE(2000,i*2);
  const normal=run(codeOf(SON,'PCM ElevenLabs'),{json:{audio_base64:pcm.toString('base64')}})[0].json;
  const w=run(codeOf(SON,'WAV'),{json:normal,nodes:{'Textos de voz':{plano_id:'p1',texto:'Hola',proveedor:'elevenlabs'}}})[0];
  assert.ok(Math.abs(w.json.duracion_s-1)<0.01);assert.strictEqual(w.binary.archivo.mimeType,'audio/wav');
  assert.throws(()=>run(codeOf(SON,'Voz HeyGen lista'),{json:{data:{audio_url:'https://a'}},nodes:{'Textos de voz':{}}}),/audio válido/);
});

test('presentación: HeyGen recibe look y la voz elegida, sondeo acotado y errores sin montaje', () => {
  const av=wf('FabAvatar0000001'),p=presentacionReal(),e={video_id:'v-ana',plano:{id:'p1',tipo:'avatar'},presentacion:p,formato:'short',voz:{url:'https://audio.example.test/elegida.wav',duracion_s:4}};
  const request=run(codeOf(av,'Pedido de avatar'),{nodes:{Inicio:e,'Leer ajustes':encendido}})[0].json;
  assert.deepStrictEqual(request,{type:'avatar',avatar_id:'look-elegido',audio_url:e.voz.url,resolution:'1080p',aspect_ratio:'9:16'});
  assert.ok(!request.voice_id);assert.ok(!request.script);
  assert.throws(()=>run(codeOf(av,'Trabajo avatar'),{json:{data:{id:'no-video-id'}}}),/trabajo/);
  assert.strictEqual(run(codeOf(av,'Estado avatar'),{json:{data:{status:'processing'}}})[0].json.status,'processing');
  assert.throws(()=>run(codeOf(av,'Estado avatar'),{json:{data:{status:'failed'}}}),/falló/);
  assert.throws(()=>run(codeOf(av,'Estado avatar'),{json:{data:{status:'processing'}},runIndex:80}),/conciliar/);
  assert.throws(()=>run(codeOf(av,'Estado avatar'),{json:{data:{status:'completed'}}}),/sin video/);
  const result=run(codeOf(av,'Avatar listo'),{nodes:{Inicio:e,'Estado avatar':{id:'remote',video_url:'https://video.example.test/a.mp4',duration:4},'Leer ajustes':encendido}})[0].json;
  assert.strictEqual(result.costo_avatar_usd,4*aj.costoAvatarSegUsd);assert.strictEqual(result.plano_id,'p1');
});

test('presentación: montaje usa videos solo en planos avatar y una sola voz por escena', () => {
  for(const presencia of ['completo','partes']) {
    const plan=planPresentacion(presentacionReal(presencia));
    const planos=plan.planos.map(p=>({plano_id:p.id,plano:p,url:`https://media.example.test/${p.id}.${p.tipo==='avatar'?'mp4':'png'}`}));
    const voces=plan.planos.map(p=>({plano_id:p.id,url:`https://media.example.test/${p.id}.wav`,duracion_s:3}));
    const out=run(codeOf(PROD,'Composición Creatomate'),{json:{voces,planos},nodes:{'Plan de producción':plan}})[0].json;
    const scenes=out.source.elements.filter(e=>e.type==='composition');assert.strictEqual(scenes.length,2);
    assert.deepStrictEqual(scenes.map(e=>e.elements[0].type),presencia==='completo'?['video','video']:['video','image']);
    for(const e of scenes){assert.strictEqual(e.elements.filter(x=>x.type==='audio').length,1);if(e.elements[0].type==='video'){assert.strictEqual(e.elements[0].volume,'0%');assert.strictEqual(e.elements[0].loop,false);}}
    assert.throws(()=>run(codeOf(PROD,'Composición Creatomate'),{json:{voces,planos:planos.slice(1)},nodes:{'Plan de producción':plan}}),/Faltan/);
  }
});

test('presentación: el costo real de la duración de voz se comprueba antes de pedir avatares', () => {
  const plan=planPresentacion(presentacionReal('completo'),{presupuesto_usd:1});
  const out=run(codeOf(PROD,'Preparar avatares'),{nodes:{'Plan de producción':plan,'Leer ajustes':encendido,'Gasto de planos':{usd:0},'Sonido y emoción':{voces:plan.planos.map(p=>({plano_id:p.id,url:'https://audio.example.test/a',duracion_s:20,costo_voz_usd:0.01}))}}})[0].json;
  assert.strictEqual(out.bloqueo,'presupuesto');assert.strictEqual(out.pedidos.length,2);
});

test('presentación: consulta firmada usa la selección persistida y parada corta el grafo', () => {
  const v=wf('FabPresentacion1'),p=presentacionReal();
  const context={nodes:{Inicio:{video_id:'v-ana'},'Video de presentación':{video_id:'v-ana',cooper_orden_id:'orden',dueno_email:'ana@example.test',presentacion:JSON.stringify(p)},'Leer ajustes':encendido}};
  const out=run(codeOf(v,'Consulta de presentación'),context)[0].json;
  assert.deepStrictEqual(out.consulta.presentacion,p);assert.strictEqual(out.consulta.orden_id,'orden');
  context.nodes['Leer ajustes']={...encendido,allowAvatar:false};
  assert.strictEqual(run(codeOf(v,'Consulta de presentación'),context)[0].json.consulta.bloqueo,'avatar_apagado');
  const stop=run(codeOf(v,'Estado detenido'),{nodes:{'Consultar Cooper':{estado:'cancelada',aviso:'Consentimiento revocado'}}})[0].json;
  assert.strictEqual(stop.estado,'cancelado');
  assert.throws(()=>run(codeOf(v,'Detener presentación'),{nodes:{'Consultar Cooper':{aviso:'Consentimiento revocado'}}}),/revocado/);
  for (const [flow,destinos] of [[PROD,['Renderizar','¿Todo encendido?','¿Hay avatares?']],[SON,['Textos de voz','Voz (Gemini TTS)','Voz (HeyGen)','Voz (ElevenLabs)']],[wf('FabAvatar0000001'),['Pedido de avatar','Crear avatar','Consultar avatar','Avatar listo']]]) {
    for(const destino of destinos){const p='Presentación · '+destino;assert.ok(flow.nodes.some(n=>n.name===p+' validar'));
      const parents=Object.entries(flow.connections).filter(([,k])=>k.main?.flat().some(e=>e.node===destino)).map(([name])=>name);
      assert.deepStrictEqual(parents,[p+' seguir']);}
  }
});

test('presentación: gastos de avatar y cada voz se atribuyen al dueño y son idempotentes por paso', () => {
  const av=wf('FabAvatar0000001'),cost=wf('FabCooperCosto01');
  for(const [flow,name,extra,all] of [[av,'Crear avatar',{voz:{duracion_s:5}},{}],[SON,'Voz (HeyGen)',{}, {'Textos de voz':[{costo_voz_usd:0.2}]}],[SON,'Voz (ElevenLabs)',{}, {'Textos de voz':[{costo_voz_usd:0.3}]}]]) {
    const ctx={nodes:{Inicio:{video_id:'v-ana',...extra},'Leer ajustes':encendido},all};
    const c=run(codeOf(flow,'Cooper · costo '+name),ctx)[0].json;
    assert.ok(c.usd>0);assert.strictEqual(c.paso_id,run(codeOf(flow,'Cooper · costo '+name),ctx)[0].json.paso_id);
    const row=run(codeOf(cost,'Costo atribuido'),{nodes:{Inicio:c,'Video del costo':{dueno_email:'ana@example.test'},'Canal del costo':{dueno_email:'ana@example.test'}}})[0].json;
    assert.strictEqual(row.dueno_email,'ana@example.test');assert.strictEqual(row.estimado,true);
  }
});

test('presentación: contrato completo con transportes ficticios de voz, avatar y montaje', async () => {
  const av=wf('FabAvatar0000001');
  const pcm=Buffer.alloc(48000);for(let i=0;i<24000;i++)pcm.writeInt16LE(2000,i*2);
  for(const presencia of ['completo','partes']) for(const proveedor of ['gemini','heygen','elevenlabs']) {
    const plan=planPresentacion(presentacionReal(presencia,proveedor)),calls=[];
    const transport=async (url,body) => {
      calls.push({url,body});
      if(url.includes('/interactions')) {assert.strictEqual(body.generation_config.speech_config[0].voice,'Charon');return {steps:[{type:'model_output',content:[{type:'audio',mime_type:'audio/l16;rate=24000',data:pcm.toString('base64')}]}]};}
      if(url.includes('/models/audio/tts')) {assert.strictEqual(body.voice_id,'voz-clonada');return {data:{audio_url:'https://media.example.test/heygen.wav',duration:1}};}
      if(url.includes('/with-timestamps')) {assert.match(url,/voz-clonada/);return {audio_base64:pcm.toString('base64')};}
      if(url==='https://api.heygen.com/v3/videos') {assert.strictEqual(body.avatar_id,'look-elegido');assert.match(body.audio_url,/\.wav$/);return {data:{video_id:'render-avatar',status:'waiting'}};}
      if(url==='https://api.heygen.com/v3/videos/render-avatar') return {data:{id:'render-avatar',status:'completed',video_url:'https://media.example.test/avatar.mp4',duration:1}};
      if(url==='https://api.creatomate.com/v2/renders') {assert.strictEqual(body.source.elements.filter(e=>e.type==='composition').length,2);return {id:'montaje',status:'planned'};}
      throw new Error('Transporte no autorizado en prueba: '+url);
    };
    const send=async(flow,name,ctx) => {
      const n=flow.nodes.find(n=>n.name===name),p=n.parameters;
      const url=p.url.startsWith('=') ? expNodo(flow,name,'url',ctx) : p.url;
      return transport(url,p.jsonBody ? expNodo(flow,name,'jsonBody',ctx) : undefined);
    };
    const textos=run(codeOf(SON,'Textos de voz'),{nodes:{Inicio:{...plan,planos:plan.planos.map(plano=>({plano,plano_id:plano.id}))},'Leer ajustes':encendido}});
    const voces=[];
    for(const {json:texto} of textos) {
      const nodes={'Textos de voz':texto,'Leer ajustes':encendido},ctx={nodes,json:texto};
      const name={gemini:'Voz (Gemini TTS)',heygen:'Voz (HeyGen)',elevenlabs:'Voz (ElevenLabs)'}[proveedor];
      let response=await send(SON,name,ctx),voice;
      if(proveedor==='heygen') voice=run(codeOf(SON,'Voz HeyGen lista'),{nodes,json:response})[0].json;
      else {
        if(proveedor==='elevenlabs')response=run(codeOf(SON,'PCM ElevenLabs'),{json:response})[0].json;
        const wav=run(codeOf(SON,'WAV'),{nodes,json:response})[0];
        assert.strictEqual(wav.binary.archivo.mimeType,'audio/wav');
        voice={...wav.json,url:'https://media.example.test/'+texto.plano_id+'.wav'};
      }
      voces.push(voice);
    }
    const planos=[];
    for(const plano of plan.planos) {
      if(plano.tipo!=='avatar'){planos.push({plano_id:plano.id,plano,url:'https://media.example.test/imagen.png'});continue;}
      const entrada={...plan,plano,voz:voces.find(v=>v.plano_id===plano.id)};
      const nodes={Inicio:entrada,'Leer ajustes':encendido};
      const pedido=run(codeOf(av,'Pedido de avatar'),{nodes})[0].json;
      const creado=await send(av,'Crear avatar',{nodes,json:pedido});
      nodes['Trabajo avatar']=run(codeOf(av,'Trabajo avatar'),{json:creado})[0].json;
      const respuesta=await send(av,'Consultar avatar',{nodes});
      nodes['Estado avatar']=run(codeOf(av,'Estado avatar'),{json:respuesta})[0].json;
      planos.push(run(codeOf(av,'Avatar listo'),{nodes})[0].json);
    }
    const composed=run(codeOf(PROD,'Composición Creatomate'),{nodes:{'Plan de producción':plan},json:{planos,voces}})[0].json;
    const rendered=await send(PROD,'Renderizar',{json:composed});assert.strictEqual(rendered.status,'planned');
    assert.strictEqual(calls.filter(c=>c.url==='https://api.heygen.com/v3/videos').length,presencia==='completo'?2:1);
    assert.strictEqual(composed.planos,composed.esperados);
  }
});

// Fase 6: se ejecuta el código generado que consumirá n8n, con transportes ficticios.
const TXT = wf('FabTextoGPT0001'), NOT = wf('FabNoticia000001');
const respuestaTexto = value => ({ status:'completed', output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}] });
const fuenteNoticia = () => ({ url:'https://observatorio.example.test/boletin', titulo:'Boletín primario', fecha:new Date().toISOString() });
const noticiaFixture = () => ({ titulo:'Nueva medición del observatorio', fecha:new Date().toISOString(), hechos:[{id:'h1',dato:'La medición es de 12 unidades.',estado:'ok',fuentes:[fuenteNoticia()]}], fuentes_consultadas:[fuenteNoticia().url],verificado:true,verificado_en:new Date().toISOString() });
const noticiasJS = fs.readFileSync(path.join(__dirname,'../tools/cooper/noticia.js'),'utf8');
const evaluarNoticia = (js,json) => run(noticiasJS + '\n' + js,{json})[0]?.json;

test('texto: todos los roles usan Codex primero y un único respaldo Responses con plazo', () => {
  for (const [flow,name] of [[ORQ,'Crítico de nichos'],[ORQ,'Crítico del guion'],[ORQ,'Verificar cifras'],[wf('FabRadar00000001'),'Analista de tendencias']]) {
    const n=flow.nodes.find(n=>n.name===name);
    assert.equal(n.parameters.workflowId.value,TXT.id);
    assert.equal(n.parameters.mode,'each');
  }
  const edges=name=>TXT.connections[name].main.map(a=>a.map(x=>x.node));
  assert.deepEqual(edges('Pedido de texto'),[['Intentar Codex']]);
  assert.deepEqual(edges('¿Codex respondió?'),[['Resultado de texto'],['Permitir respaldo']]);
  assert.deepEqual(edges('Permitir respaldo'),[['Respaldo OpenAI']]);
  const http=TXT.nodes.find(n=>n.name==='Respaldo OpenAI');
  assert.equal(http.parameters.url,'https://api.openai.com/v1/responses');
  assert.match(http.parameters.jsonBody,/web_search_call.action.sources/);
  const timeout=TXT.nodes.find(n=>n.name==='Intentar Codex').parameters.options.timeout.slice(3,-2);
  for (const [tarea,buscar_web,esperado] of [['radar',true,190000],['radar',false,45000],['verificador',true,45000],['critico',false,45000]]) {
    assert.equal(run('return {timeout:('+timeout+')}',{nodes:{'Pedido de texto':{tarea,local:{buscar_web}}}})[0].timeout,esperado);
  }
  assert.equal(TXT.settings.saveDataErrorExecution,'none');
  assert.equal(TXT.settings.saveDataSuccessExecution,'none');
});
test('texto: éxito local evita API; fallo, 429, timeout o JSON inválido seleccionan respaldo', () => {
  const pedido={tarea:'radar',local:{buscar_web:false},costo_estimado_usd:0.25};
  const bueno={...respuestaTexto({ideas:[],resumen:'ensayo'}),ruta:'codex'};
  const evalua=json=>run(codeOf(TXT,'Evaluar Codex'),{json,nodes:{'Pedido de texto':pedido}})[0].json.ok;
  assert.equal(evalua(bueno),true);
  for(const bad of [{error:'timeout'},{error:'ocupado'},{ruta:'codex',output:[]},respuestaTexto({sin:'contrato'})]) assert.equal(evalua(bad),false);
  const local=run(codeOf(TXT,'Resultado de texto'),{nodes:{'Pedido de texto':pedido,'Evaluar Codex':{ok:true},'Intentar Codex':bueno}})[0].json;
  assert.deepEqual(local.texto_uso,{ruta:'codex',motivo_respaldo:'',usd:0,ahorro_estimado_usd:0.25,estimado:true});
  const api=run(codeOf(TXT,'Resultado de texto'),{nodes:{'Pedido de texto':pedido,'Evaluar Codex':{ok:false},'Respaldo OpenAI':respuestaTexto({ideas:[],resumen:'ensayo'})}})[0].json;
  assert.equal(api.texto_uso.usd,0.25); assert.equal(api.texto_uso.ahorro_estimado_usd,0); assert.equal(api.ruta,'openai_api');
  assert.throws(()=>run(codeOf(TXT,'Resultado de texto'),{nodes:{'Pedido de texto':pedido,'Evaluar Codex':{ok:false},'Respaldo OpenAI':{error:'sin servicio'}}}),/ambas rutas/);
  assert.throws(()=>run(codeOf(TXT,'Permitir respaldo'),{nodes:{'Pedido de texto':{api_permitida:false}}}),/apagado/);
});
test('texto: una noticia sin evidencia de búsqueda del proveedor vuelve al respaldo', () => {
  const n=noticiaFixture(), pedido={tarea:'radar_noticia',local:{buscar_web:true}};
  const r={...respuestaTexto({noticia:n}),ruta:'codex',busqueda_real:true,fuentes_consultadas:n.fuentes_consultadas};
  const evalua=json=>run(codeOf(TXT,'Evaluar Codex'),{json,nodes:{'Pedido de texto':pedido}})[0].json.ok;
  assert.equal(evalua(r),true);
  assert.equal(evalua({...r,busqueda_real:false}),false);
  assert.equal(evalua({...r,fuentes_consultadas:[]}),false);
  const p={...pedido,costo_estimado_usd:0.25};
  assert.throws(()=>run(codeOf(TXT,'Resultado de texto'),{nodes:{'Pedido de texto':p,'Evaluar Codex':{ok:false},'Respaldo OpenAI':respuestaTexto({noticia:n})}}),/búsqueda web/);
});
test('noticia: radar acepta solo hechos del día con URLs realmente consultadas', () => {
  const acepta=n=>run(codeOf(NOT,'Noticia candidata'),{nodes:{'Radar de noticia':{...respuestaTexto({noticia:n}),fuentes_consultadas:[fuenteNoticia().url]}}})[0].json.noticia;
  assert.equal(acepta(noticiaFixture()).hechos.length,1);
  for(const n of [null,{...noticiaFixture(),hechos:[]},{...noticiaFixture(),fecha:new Date(Date.now()-48*3600000).toISOString()},{...noticiaFixture(),fecha:new Date(Date.now()+3600000).toISOString()}, {...noticiaFixture(),hechos:[{id:'h1',dato:'rumor',fuentes:[{...fuenteNoticia(),url:'https://inventada.test/x'}]}]}]) assert.throws(()=>acepta(n),/Noticia detenida/);
});
test('noticia: verificador bloquea contradicciones, omisiones, fuentes inventadas y salida vacía', () => {
  const n=noticiaFixture();
  const valida=(value,r={})=>run(codeOf(NOT,'Noticia verificada'),{nodes:{Inicio:{canal_id:'c'},'Noticia candidata':{noticia:n},'Verificador de noticia':{...respuestaTexto(value),busqueda_real:true,fuentes_consultadas:n.fuentes_consultadas,...r}}})[0].json.noticia;
  assert.equal(valida({verificado:true,hechos:n.hechos}).verificado,true);
  for (const value of [{},{verificado:false,hechos:n.hechos},{verificado:true,hechos:[]},{verificado:true,hechos:[{...n.hechos[0],estado:'contradictorio'}]},{verificado:true,hechos:[{...n.hechos[0],dato:'13 unidades'}]}]) assert.throws(()=>valida(value),/Noticia detenida/);
  assert.throws(()=>valida({verificado:true,hechos:n.hechos},{fuentes_consultadas:[]}),/Noticia detenida/);
});
test('noticia: certificación cubre todo el guion y su huella rechaza cambios posteriores', () => {
  const n=noticiaFixture(), guion={titulo:n.titulo,guion:'La medición es de 12 unidades.'};
  const cert=covered=>run(codeOf(ORQ,'Certificar guion noticia'),{nodes:{Inicio:{resultado:guion},'Video (crítico)':{noticia:JSON.stringify(n)},'Verificar guion noticia':{...respuestaTexto({verificado:true,guion_cubierto:covered,hechos:n.hechos}),busqueda_real:true,fuentes_consultadas:n.fuentes_consultadas}}})[0].json;
  assert.throws(()=>cert(false),/afirmaciones sin verificar/);
  const v={...cert(true),modo_noticia:true};
  assert.doesNotThrow(()=>evaluarNoticia('exigirGuion($json.v,$json.g); return [{json:{ok:true}}];',{v,g:guion}));
  assert.throws(()=>evaluarNoticia('exigirGuion($json.v,$json.g);',{v,g:{...guion,guion:'Son 13 unidades.'}}),/versión verificada/);
  assert.throws(()=>evaluarNoticia('exigirGuion($json.v,null);',{v:{...v,noticia_guion_hash:''}}),/versión verificada/);
});
test('noticia: solo recursos didácticos propios; bloquea archivo, avatar y URLs de medios', () => {
  const plano={id:'p1',tipo:'imagen',origen_visual:'generado',recurso_didactico:'cifra',prompt_imagen:'Diagrama de 12 unidades'};
  assert.doesNotThrow(()=>evaluarNoticia('exigirVisuales($json);',{planos:[plano]}));
  for(const bad of [{...plano,tipo:'archivo'},{...plano,tipo:'avatar'},{...plano,origen_visual:'medio'}, {...plano,referencia:'https://medio.test/foto.jpg'}, {...plano,recurso_didactico:'fotografia'}]) assert.throws(()=>evaluarNoticia('exigirVisuales($json);',{planos:[bad]}),/nunca imágenes de medios/);
});
test('noticia: las puertas no dependen del crítico y publicación consulta la fila persistida', () => {
  const edges=(w,n)=>w.connections[n].main.flat().map(x=>x.node);
  assert(edges(ORQ,'Video (crítico)').includes('¿Verificar guion noticia?'));
  assert.deepEqual(ORQ.connections['¿Verificar guion noticia?'].main[0].map(x=>x.node),['Invalidar · Encargo de guion noticia entrada']);
  assert.match(codeOf(ORQ,'Noticia · Canal (publicar) validar'),/exigirGuion\(v,null\)/);
  assert.match(codeOf(PROD,'Noticia · Plan de producción validar'),/exigirGuion/);
  assert.match(codeOf(wf('FabRedes00000001'),'Noticia · Subir a redes validar'),/exigirGuion/);
  assert.match(codeOf(ORQ,'Nuevo video'),/typeof e.modo_noticia === 'boolean'/);
});
test('Cooper: modo noticia exige booleano y recurso autorizado', () => {
  // Reutiliza el mismo contrato/fixture de autorización que el resto del puente.
  const args={nodes:{Autenticar:{solicitud:{evento:'ajustar_biblia',datos:{id:'orden',recursoId:'c-ana',texto:'Activar',parametros:{campo:'modo_noticia',valor:true}}},dueno_email:'ana@example.test',admin:false},'Canales autorizados':{canal_id:'c-ana',dueno_email:'ana@example.test'},'Videos autorizados':{}}};
  const result=run(codeOf(FX,'Resolver'),args)[0].json;
  assert.equal(result.evento.campo,'modo_noticia'); assert.equal(result.evento.valor,'true');
  args.nodes.Autenticar.solicitud.datos.parametros.valor='false';
  assert.equal(run(codeOf(FX,'Resolver'),args)[0].json.status,400);
  args.nodes.Autenticar.solicitud.datos.recursoId='ajeno';
  assert.equal(run(codeOf(FX,'Resolver'),args)[0].json.status,404);
});
test('noticia: verifica storyboard completo e invalida certificados antes de corregir', () => {
  const n=noticiaFixture(), storyboard={planos:[{id:'p1',tipo:'imagen',origen_visual:'generado',recurso_didactico:'cifra',prompt_imagen:'12 unidades'}]};
  const cert=covered=>run(codeOf(ORQ,'Certificar storyboard noticia'),{nodes:{Inicio:{resultado:storyboard},'Video de storyboard noticia':{noticia:JSON.stringify(n)},'Verificar storyboard noticia':{...respuestaTexto({verificado:true,guion_cubierto:covered,hechos:n.hechos}),busqueda_real:true,fuentes_consultadas:n.fuentes_consultadas}}})[0].json;
  assert.throws(()=>cert(false),/storyboard sin respaldo/);
  const v={...cert(true),modo_noticia:true,noticia_guion_hash:'huella'};
  assert.doesNotThrow(()=>evaluarNoticia('exigirStoryboard($json.v,$json.s);',{v,s:storyboard}));
  assert.throws(()=>evaluarNoticia('exigirStoryboard($json.v,$json.s);',{v,s:{planos:[{...storyboard.planos[0],texto_pantalla:'13'}]}}),/storyboard distinto/);
  for (const step of ['Claude: corregir','Claude: corregir (crítico)','Claude: storyboard corregido']) {
    const flow=codeOf(ORQ,'Invalidar · '+step+' campos');
    assert.match(flow,/noticia_storyboard_hash:''/);
  }
});

const OBS=fs.readFileSync(path.join(__dirname,'../tools/cooper/observabilidad.js'),'utf8');
test('pulido: métricas por publicación, nulos distintos de cero y un punto por día',()=>{
 const respuesta={platforms:{youtube:{success:true,post_metrics:{views:0,likes:0}},tiktok:{success:true,post_metrics_error:'sin permiso',profile_snapshot_latest:{impressions:999}}}};
 const js=OBS+'return [{json:JSON.parse(historialRedesCooper($json.p,$json.respuesta,Date.now()))}];';
 const a=run(js,{json:{p:{},respuesta}})[0].json;
 assert.equal(a.youtube[0].vistas,0);assert.equal(a.youtube[0].comentarios,null);assert.equal(a.tiktok,undefined);
 const b=run(js,{json:{p:{metricas_historial:JSON.stringify(a)},respuesta}})[0].json;
 assert.equal(b.youtube.length,1);
});
test('pulido: la proyección aísla medios, lecciones, rechazos y resoluciones',()=>{
 const date='2026-11-21T00:00:00Z';
 const out=run(codeOf(FX,'Resolver'),{nodes:{Autenticar:{solicitud:solicitudCooper('estado'),dueno_email:'ana@example.test',admin:false}},all:{
  'Canales autorizados':[canalCooper], 'Videos autorizados':[{...videoCooper,render_url:'https://cdn.test/video.mp4'}],
  'Piezas de Cooper':[{video_id:'v-ana',plano_id:'p1',tipo:'imagen',archivo_url:'https://cdn.test/p1.png'},{video_id:'otro',plano_id:'privado',url:'https://privado.test/a.png'}],
  'Lecciones de Cooper':[{canal_id:'c-ana',job_id:'l',modo:'aprender',estado:'ok',createdAt:date,resultado:JSON.stringify({resultado:{resumen:'Mejoró el gancho.',lecciones:[{regla:'Preguntar al inicio ayuda al gancho.'}]},costo_usd:999})}],
  'Historial de Cooper':[{video_id:'v-ana',id:'e1',tipo:'incidencia_cooper',createdAt:date,detalle:JSON.stringify({tipo:'critico',resumen:'El gancho era largo.'})},{video_id:'v-ana',id:'e2',tipo:'correccion_cooper',createdAt:'2026-11-21T01:00:00Z',detalle:JSON.stringify({tipos:['critico'],cambio:'Se acortó la apertura y superó la revisión.'})}]
 }} )[0].json.respuesta;
 assert.equal(out.videos[0].observabilidad.montaje,'https://cdn.test/video.mp4');assert.equal(out.videos[0].observabilidad.escenas.length,1);
 assert.equal(out.videos[0].observabilidad.incidencias[0].estado,'corregido');assert.equal(out.canales[0].lecciones[0].ganchos.length,1);
 assert.doesNotMatch(JSON.stringify(out),/privado|999|costo_usd/);
});
test('pulido: red publicada se conserva ante fallo parcial y no se confunde enviado con publicado',()=>{
 const js=OBS+'return [{json:observabilidadCooper($json.v,[],$json.p,[],[])}];';
 const p=[{video_id:'v',request_id:'r',estado:'error',resultado:JSON.stringify({publicaciones:[{red:'youtube',url:'https://youtube.com/watch?v=abcdefghijk',publicado:true},{red:'tiktok',url:'',publicado:false}]})},{video_id:'v',request_id:'r2',estado:'enviado',url:'https://instagram.com/test'}];
 const out=run(js,{json:{v:{video_id:'v'},p}})[0].json;
 assert.equal(out.publicaciones.length,1);assert.equal(out.publicaciones[0].red,'youtube');
});
test('pulido: periodicidad diaria acotada y ningún análisis sin evidencia persistida',()=>{
 const videos=Array.from({length:110},(_,i)=>({video_id:String(i),youtube_id:'y',publicado_en:'2026-01-01T00:00:00Z'}));
 assert.equal(run(codeOf(APR,'Toca medir'),{all:{$input:videos}}).length,100);
 const fuera=run(codeOf(APR,'Pedir lecciones'),{all:{'Toca medir en redes':[{video_id:'v',canal_id:'c',dias:4}],'Métricas en redes':[{platforms:{}}]}});
 assert.equal(fuera.length,0);
});
test('pulido: piezas usa los archivos finales de sonido/avatar y el orden del montaje',()=>{
 const p1={plano_id:'p1',url:'https://cdn.test/imagen.png',plano:{id:'p1',tipo:'imagen'}};
 const p2={plano_id:'p2',url:'https://cdn.test/avatar.mp4',plano:{id:'p2',tipo:'avatar'}};
 const nodes={'Composición Creatomate':{planos:2},'Plan de producción':{planos:[{id:'p1'},{id:'p2'}]},'Juntar planos':{planos:[p1,{...p2,url:''}]},'Sonido y emoción':{planos:[p2,p1],voces:[{plano_id:'p2',url:'https://cdn.test/voz.wav'}]}};
 const datos=JSON.parse(run(codeOf(PROD,'Cooper · piezas terminadas'),{nodes})[0].json.cooper_escenas);
 assert.deepEqual(datos,[{id:'p1',orden:0,imagen:p1.url,clip:'',voz:''},{id:'p2',orden:1,imagen:'',clip:p2.url,voz:'https://cdn.test/voz.wav'}]);
});
test('pulido: conserva el porcentaje medio visto de YouTube sin recortarlo a 100 %',()=>{
 const out=run(codeOf(APR,'Cooper · historial YouTube'),{all:{'Pedidos de retención':[{video_id:'v'}],$input:[{columnHeaders:[{name:'views'},{name:'likes'},{name:'comments'},{name:'averageViewPercentage'}],rows:[[12,2,0,125]]}]}})[0].json;
 const historial=JSON.parse(out.metricas_youtube);
 assert.equal(historial[0].retencion,1.25);
 const vista=run(OBS+'return [{json:medicionCooper($json)}];',{json:historial[0]})[0].json;
 assert.equal(vista.retencion,1.25);
});

// Cobertura operativa: contratos de productor y consumidor, aislamiento y guardias.
const controlCooper=(accion,datos={},opts={})=>resolverCooper(solicitudCooper('control_fabrica',{accion,canalId:'c-ana',confirmado:true,id:'nuevo-video',...datos}),opts);
test('cobertura: biblia, radar, metas, referencias y especialistas salen de sus tablas y sin datos privados',()=>{
 const tendencias=JSON.stringify({fecha:new Date().toISOString(),resumen:'Radar diario',ideas:[{titulo:'Lluvia',gancho:'Mira el suelo',por_que:'Pregunta frecuente',fuente:'Universidad',fuente_url:'https://example.test/fuente'}],sonidos:[]});
 const trabajos=[{job_id:'j',canal_id:'c-ana',modo:'crear_biblia',resultado:JSON.stringify({resultado:{estilo_visual:{descripcion:'Luz lateral'},voz:{tono:'Cercano'},personajes:[{id:'ana',nombre:'Ana',referencias_urls:['https://example.test/ana.png']}],api_key:'privado'}})}, {job_id:'story',canal_id:'c-ana',video_id:'v-ana',modo:'storyboard',estado:'ok',resultado:JSON.stringify({resultado:{formato:'short',publicacion:{youtube:{hora:17,descripcion:'Abrir con pregunta',sonido:'Ambiente'}}}})}];
 const out=resolverCooper(solicitudCooper('operacion'),{canales:[{...canalCooper,tendencias}],trabajos});
 assert.strictEqual(out.status,200);const c=out.respuesta.canales[0];assert.strictEqual(c.biblia['voz.tono'],'Cercano');assert.strictEqual(c.referencias[0].nombre,'Ana');assert.strictEqual(c.especialistas[0].hora,'17');assert.strictEqual(c.radar.ideas[0].fuente,'Universidad');assert.ok(!JSON.stringify(out.respuesta).match(/api_key|privado|999|presupuesto/));
 assert.strictEqual(controlCooper('idea',{ideaId:c.radar.ideas[0].id},{canales:[{...canalCooper,tendencias}]}).evento.tema,'Lluvia');
 assert.strictEqual(controlCooper('idea',{ideaId:'0:2000'},{canales:[{...canalCooper,tendencias:JSON.stringify({fecha:'2000',ideas:[{titulo:'Viejo'}]})}]}).status,409);
});
test('cobertura: controles estructurados conservan rutas del Orquestador y rechazan campos peligrosos',()=>{
 for(const [accion,datos,evento]of [['biblia',{campo:'voz.tono',valor:'Cercano'},'ajustar_biblia'],['redes',{perfil:'ciencia',redes:['youtube'],zona:'America/Lima'},'configurar_redes'],['metas',{videos_semana:3,formato:'short',retencion_min:0.5,auto:true},'metas'],['referencias',{},'referencias'],['adoptar',{cuenta:'@ciencia',red:'youtube'},'adoptar_cuenta']]){
 const out=controlCooper(accion,datos);assert.strictEqual(out.accion,'orden',accion);assert.strictEqual(out.evento.evento,evento);assert.strictEqual(out.evento.dueno_email,'ana@example.test');
 }
 assert.strictEqual(controlCooper('biblia',{campo:'__proto__.x',valor:'x'}).status,400);
 assert.strictEqual(controlCooper('metas',{videos_semana:3,formato:'short',retencion_min:.5,auto:true,gasto_semana_usd:100}).status,403);
 assert.strictEqual(controlCooper('referencias',{confirmado:false}).status,400);
 assert.strictEqual(controlCooper('adoptar',{cuenta:'https://interno.test',red:'youtube'}).status,400);
});
test('cobertura: ajustes son administrativos, verifican revisión y nunca permiten cambiar destinos o secretos',()=>{
 const admin={admin:true,dueno_email:'admin@example.test'};
 assert.strictEqual(resolverCooper(solicitudCooper('ajustes')).status,403);
 const estado=resolverCooper(solicitudCooper('ajustes',{},admin)).respuesta;
 assert.ok(!Object.hasOwn(estado.valores,'chatId'));assert.ok(!Object.hasOwn(estado.valores,'routineUrl'));
 const pedir=valores=>resolverCooper(solicitudCooper('control_fabrica',{accion:'ajustes',revision:estado.revision,valores,confirmado:true},admin));
 assert.strictEqual(pedir({allowVoz:true,presupuestoShortUsd:3}).evento.accion,'ajustes');
 for(const valores of [{routineUrl:'https://ajeno'},{allowVoz:'true'},{maxVideosDiaTotal:-1},{'calendario.zona':'No/Existe'}])assert.strictEqual(pedir(valores).status,400);
 assert.strictEqual(resolverCooper(solicitudCooper('control_fabrica',{accion:'ajustes',revision:'vieja',valores:{allowVoz:true},confirmado:true},admin)).status,409);
 const effective=run(codeOf(AJ,'Ajustes efectivos'),{nodes:{Ajustes:aj},all:{$input:[{id:1,detalle:JSON.stringify({valores:{allowVoz:true,presupuestoShortUsd:3}})},{id:2,detalle:JSON.stringify({valores:{baseUrl:'https://ajeno'}})}]}})[0].json;
 assert.strictEqual(effective.allowVoz,true);assert.strictEqual(effective.baseUrl,aj.baseUrl);
});
test('cobertura: todas las decisiones reanudan únicamente el formulario propio con multipart y sin repetir',()=>{
 const ap={aprobacion_id:'ap-cobertura',canal_id:'c-ana',video_id:'v-ana',estado:'pendiente',etapa:'storyboard',url:aj.baseUrl+'/form-waiting/42?signature=ficticia',pedido:'{}'};
 const r=controlCooper('decidir',{id:ap.aprobacion_id,decision:'aprobar',cambios:''},{aprobaciones:[ap]});
 assert.strictEqual(r.evento.accion,'decision');assert.strictEqual(r.evento.datos.data['field-0'],'Aprobar');
 for(const url of ['https://ajeno.test/form-waiting/42',aj.baseUrl+'/api/v1/workflows',aj.baseUrl+'/form-waiting/../../api'])assert.strictEqual(controlCooper('decidir',{id:ap.aprobacion_id,decision:'aprobar'},{aprobaciones:[{...ap,url}]}).status,409);
 assert.strictEqual(controlCooper('decidir',{id:ap.aprobacion_id,decision:'aprobar'},{aprobaciones:[{...ap,estado:'decidida'}]}).status,409);
 assert.strictEqual(controlCooper('decidir',{id:ap.aprobacion_id,decision:'aprobar'},{aprobaciones:[{...ap,etapa:'gasto'}]}).status,403);
 assert.strictEqual(controlCooper('decidir',{id:ap.aprobacion_id,decision:'cambios',cambios:''},{aprobaciones:[ap]}).status,400);
 const node=FX.nodes.find(n=>n.name==='Responder decisión de Cooper');assert.strictEqual(node.parameters.contentType,'multipart-form-data');assert.ok(!node.retryOnFail);assert.strictEqual(node.parameters.options.redirect.redirect.followRedirects,false);
});
test('cobertura: programados distingue borradores y omisiones; Telegram solo afirma aceptación con recibo',()=>{
 const conf=wf('FabConfirmar0001'),p={request_id:'r',video_id:'v-ana',plataformas:'tiktok,youtube',tipo:'video'};
 const o=run(codeOf(conf,'Leer resultados'),{all:{'Por confirmar':[p],'Publicaciones recientes':[p],$input:[{status:'completed',results:[{platform:'tiktok',success:true,fallback_to_inbox:true},{platform:'youtube',success:true,skipped:true}]}]}})[0].json;
 const pubs=JSON.parse(o.resultado).publicaciones;assert.ok(pubs.every(p=>!p.publicado));assert.strictEqual(pubs[0].estado,'borrador');
 const out=resolverCooper(solicitudCooper('operacion'),{publicaciones:[{...p,...o}]}).respuesta.publicaciones;assert.deepStrictEqual(out.map(p=>p.estado),['borrador','omitido']);
 const n=ORQ.nodes.find(n=>n.name==='Cooper · aviso Aviso: investigando');
 const r=run(n.parameters.jsCode,{nodes:{Inicio:{canal_id:'c-ana'}},json:{message_id:42}})[0].json;assert.strictEqual(JSON.parse(r.detalle).estado,'enviado');assert.strictEqual(r.canal_id,'c-ana');
});
test('cobertura: rutina guarda motivos públicos, incluso apagado, y reintento no vuelve a subir publicaciones',()=>{
 const rut=wf('FabRutina0000001');const p=run(codeOf(rut,'Plan del día'),{nodes:{'Leer ajustes':aj},all:{'Videos en curso':[],'Canales activos':[{canal_id:'c',metas:'{"auto":false}'}],$input:[]}})[0].json;
 assert.strictEqual(p.decisiones[0].decision,'En pausa');assert.ok(!JSON.stringify(p.decisiones).match(/USD|US\$|presupuesto/));
 const retry=controlCooper('reintentar',{videoId:'v-ana'},{videos:[{...videoCooper,estado:'error_publicacion',error:'timeout'}]});assert.strictEqual(retry.evento.accion,'consultar');
 assert.strictEqual(controlCooper('reintentar',{videoId:'v-ana'},{videos:[{...videoCooper,estado:'cancelado',error:'timeout'}]}).status,409);
});

test('cobertura: puertas web sin formulario cierran guion/final y referencias conservan identidad',()=>{
 const ap={aprobacion_id:'ap-web',canal_id:'c-ana',video_id:'v-ana',estado:'pendiente',etapa:'guion',url:'',pedido:JSON.stringify({contexto:{guion:'Texto'}})};
 for(const decision of ['aprobar','cambios']){
  const out=controlCooper('decidir',{id:ap.aprobacion_id,decision,cambios:'Más claro'},{aprobaciones:[ap],videos:[{...videoCooper,etapa:'aprobacion_guion'}]});
  assert.strictEqual(out.evento.evento,decision==='aprobar'?'aprobado':'cambios');assert.strictEqual(out.evento.aprobacion_id,'ap-web');assert.strictEqual(out.evento.contexto.guion,'Texto');
 }
 assert.strictEqual(controlCooper('decidir',{id:ap.aprobacion_id,decision:'aprobar'},{aprobaciones:[ap],videos:[{...videoCooper,estado:'cancelado'}]}).status,409);
 const trabajos=[{job_id:'j',resultado:JSON.stringify({resultado:{personajes:[{id:'ana',descripcion_fija:'Antes',prompts_referencia:['perfil']} ]}})}];
 const ref=controlCooper('referencia',{id:'ana',tipo:'personajes',descripcion:'Después',urls:['https://example.test/a.png']},{trabajos});
 assert.strictEqual(ref.evento.evento,'ajustar_biblia');const valor=JSON.parse(ref.evento.valor);assert.strictEqual(valor.length,1);assert.deepStrictEqual(valor[0].prompts_referencia,['perfil']);assert.strictEqual(valor[0].descripcion_fija,'Después');
 assert.strictEqual(controlCooper('referencia',{id:'ana',tipo:'personajes',descripcion:'x',urls:['file:///etc/passwd']},{trabajos}).status,400);
 assert.strictEqual(controlCooper('biblia',{campo:'voz.palabras_prohibidas',valor:'uno\ndos'}).evento.valor,'["uno","dos"]');
 assert.strictEqual(controlCooper('biblia',{campo:'montaje.duracion_plano_s.short',valor:'-1'}).status,400);
 const n=wf('FabErrores000001').nodes.find(n=>n.name==='Cooper · aviso Avisar error');
 assert.strictEqual(JSON.parse(run(n.parameters.jsCode,{json:{message_id:1}})[0].json.detalle).estado,'enviado');
});

test('cobertura: radar y renovación se acotan al canal; conexiones no exponen credenciales',()=>{
 assert.strictEqual(controlCooper('radar').status,409);
 assert.strictEqual(controlCooper('radar',{}, {ajustes:{...aj,allowRadar:true}}).evento.canal_id,'c-ana');
 const ra=wf('FabRadar00000001');const pedidos=run(codeOf(ra,'Pedidos de radar'),{nodes:{Inicio:{accion:'correr',canal_id:'c-ana'}},all:{$input:[{canal_id:'c-ana',nicho:'a'},{canal_id:'otro',nicho:'b'}]}});assert.strictEqual(pedidos.length,1);assert.strictEqual(pedidos[0].json.canal_id,'c-ana');
 const ap={aprobacion_id:'ap-uno',canal_id:'c-ana',video_id:'v-ana',estado:'pendiente',etapa:'storyboard',url:aj.baseUrl+'/form-waiting/42'};
 assert.strictEqual(controlCooper('renovar',{id:'ap-uno'},{aprobaciones:[ap]}).evento.aprobacion_id,'ap-uno');
 assert.strictEqual(controlCooper('renovar',{id:'ap-uno'},{aprobaciones:[{...ap,canal_id:'otro'}]}).status,409);
 const conexiones=[{canal_id:'c-ana',estado:'pendiente',nonce:'a'.repeat(32),refresh_token:'secreto-ficticio',updatedAt:new Date().toISOString()},{canal_id:'otro',estado:'conectado',canal_youtube:'Cuenta ajena'}];
 const op=resolverCooper(solicitudCooper('operacion'),{conexiones,ajustes:{...aj,googleClientId:'cliente-ficticio'}}).respuesta;
 assert.strictEqual(new URL(op.canales[0].conexion.url).origin,'https://accounts.google.com');assert.ok(!JSON.stringify(op).includes('secreto-ficticio'));assert.ok(!JSON.stringify(op).includes('Cuenta ajena'));
 const error=resolverCooper(solicitudCooper('operacion'),{eventos:[{tipo:'incidencia_cooper',evento:'error-global',detalle:JSON.stringify({tipo:'ejecucion',resumen:'Falló un servicio'})}]}).respuesta;assert.strictEqual(error.fallos.length,0);
});

test('cobertura: los cierres web compiten por la decisión pendiente antes de avanzar',()=>{
 const cierres=ORQ.nodes.filter(n=>n.name.startsWith('Cooper · cerrar ')&&n.name.endsWith(' guardar'));assert.strictEqual(cierres.length,4);
 for(const n of cierres){assert.ok(n.parameters.filters.conditions.some(c=>c.keyName==='estado'&&c.keyValue==='pendiente'));assert.ok(!n.alwaysOutputData);}
});

test('cobertura: conservar listas editables y mostrar solo la recomendación más reciente',()=>{
 const trabajos=[{job_id:'j',resultado:JSON.stringify({resultado:{voz:{palabras_prohibidas:['primera','segunda']}}})},...['2026-11-20','2026-11-21'].map((createdAt,k)=>({job_id:'story-'+k,createdAt,canal_id:'c-ana',video_id:'v-ana',modo:'storyboard',estado:'listo',resultado:JSON.stringify({resultado:{publicacion:{youtube:{recomendacion:'Versión '+k}}}})}))];
 const c=resolverCooper(solicitudCooper('operacion'),{trabajos}).respuesta.canales[0];assert.strictEqual(c.biblia['voz.palabras_prohibidas'],'primera\nsegunda');assert.strictEqual(c.especialistas.length,1);assert.strictEqual(c.especialistas[0].recomendacion,'Versión 1');
 const canales=[{...canalCooper,tendencias:JSON.stringify({ideas:[{titulo:'Sin fecha'}]})}];assert.strictEqual(controlCooper('idea',{ideaId:'0:'},{canales}).status,409);
});

test('marcas: lote inactivo, firma exacta y sin salida cuando está apagado', () => {
  const crypto = require('node:crypto');
  for (const [wid, accion] of [['CooperMarcasPub1', 'publicar'], ['CooperMarcasMet1', 'metricas']]) {
    const flujo = wf(wid), js = codeOf(flujo, 'Firmar trabajo de marcas');
    assert.equal(flujo.active, false);
    assert.deepEqual(run(js), []);
    assert.throws(() => run(js, { env: { COOPER_MARCAS_HABILITAR: '1' } }));
    const secret = 'ficticio-'.repeat(8);
    const result = run(js, { env: { COOPER_MARCAS_HABILITAR: '1', COOPER_MARCAS_URL: 'https://cooper.example.test', COOPER_MARCAS_WORKER_SECRET: secret } })[0].json;
    assert.equal(result.url, 'https://cooper.example.test/api/marcas/operar');
    assert.deepEqual(JSON.parse(result.cuerpo), { accion });
    assert.equal(result.firma, crypto.createHmac('sha256', secret).update(result.tiempo + '.' + result.cuerpo).digest('hex'));
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(flujo.settings.saveDataSuccessExecution, 'none');
    assert.ok(flujo.connections.Reloj.main[0].some(n => n.node === 'Firmar trabajo de marcas'));
    assert.ok(flujo.connections['Firmar trabajo de marcas'].main[0].some(n => n.node === 'Atender marcas en Cooper'));
  }
});

// Ciclo completo con transportes ficticios; ninguna métrica ni publicación real.
const APRENDIZAJE = fs.readFileSync(path.join(__dirname,'../tools/cooper/aprendizaje.js'),'utf8');
const relojAprendizaje = fecha => class extends Date { constructor(...args) { super(...(args.length?args:[fecha])); } static now() { return Date.parse(fecha); } };
test('aprendizaje total: hitos reales, reintento de datos tardíos y ningún punto antes de 24 h',()=>{
 assert.equal(APR.name,'M7 · Aprendizaje (24 h, 72 h y 7 días)');
 const inicio='2026-11-01T00:00:00.000Z';
 for(const [horas,ventana] of [[23,null],[24,'24h'],[72,'72h'],[168,'7d'],[192,'7d']]) {
  const clock=relojAprendizaje(new Date(Date.parse(inicio)+horas*3600000).toISOString());
  const r=run(codeOf(APR,'Toca medir'),{clock,all:{$input:[{video_id:'v',youtube_id:'y',publicado_en:inicio}]}})[0].json;
  assert.equal(r.ventana || null,ventana);
 }
 const clock=relojAprendizaje('2026-11-04T00:00:00Z');
 const p={video_id:'v',youtube_id:'y',publicado_en:inicio,metricas_consultadas_en:'2026-11-03T22:00:00Z',metricas_youtube:JSON.stringify([{fecha:'2026-11-03T22:00:00Z',ventana:'24h'}])};
 assert.equal(run(codeOf(APR,'Toca medir'),{clock,json:p})[0].json.ventana,'72h');
 p.metricas_consultadas_en='2026-11-03T23:30:00Z';
 assert.equal(run(codeOf(APR,'Toca medir'),{clock,json:p})[0].json.nada,true);
});
test('aprendizaje total: medición → explicación verificada → siguiente guion → aplicación visible',()=>{
 const fecha='2026-11-02T00:00:00.000Z', clock=relojAprendizaje(fecha);
 const video={video_id:'v1',canal_id:'c',youtube_id:'abcdefghijk',publicado_en:'2026-11-01T00:00:00Z',tema:'Caso peruano'};
 const historial=run(codeOf(APR,'Cooper · historial YouTube'),{clock,all:{'Pedidos de retención':[video],$input:[{columnHeaders:['views','likes','comments','averageViewPercentage','subscribersGained'].map(name=>({name})),rows:[[100,2,0,40,3]]}]}})[0].json;
 const creativos=[{job_id:'g',video_id:'v1',canal_id:'c',modo:'guion',estado:'listo',resultado:JSON.stringify({resultado:{titulo:'Precio en Perú',guion:'Una frase comprobable.'}})},{job_id:'s',video_id:'v1',canal_id:'c',modo:'storyboard',estado:'listo',resultado:JSON.stringify({resultado:{planos:[{id:'p1',texto_narrado:'Frase inicial',duracion_s:4}],miniatura:{texto:'Caso peruano',prompt_imagen:'Puesto en Lima'}}})}];
 const all={'Videos publicados':[video],'Cooper · historial YouTube':[historial],'Trabajos para aprender':creativos,'Pedidos de retención':[video],'Retención':[{rows:[[0,1],[0.5,0.2]]}]};
 const pedido=run(codeOf(APR,'Pedir lecciones'),{all,clock})[0].json;
 const e=pedido.datos.evidencias[0]; assert.equal(e.metricas.seguidoresGanados,3);assert.equal(e.metricas.comentarios,0);assert.equal(e.creativo.guion,'Una frase comprobable.');assert.equal(e.creativo.planos[0].id,'p1');assert.equal(e.creativo.miniatura.texto,'Caso peruano');
 const trabajo=run(codeOf(CL,'Preparar trabajo'),{nodes:{Inicio:pedido,'Leer ajustes':{...aj,allowClaude:true}}})[0].json.fila;
 const propuesta={resumen:'Revisar la apertura',lecciones:[{regla:'Abrir con el dato local',causa:'Posible demora en explicar la cifra',correccion:'Mover la cifra al primer plano',origenes:[{video_id:'v1',red:'youtube',ventana:'24h',metrica:'retencion',valor:999}]}]};
 const salida=run(codeOf(RET,'Fila actualizada'),{nodes:{Validar:{estado:'ok',resultado:propuesta,avisos:[]},'Buscar trabajo':trabajo}})[0].json;
 const listo={...trabajo,...salida,createdAt:fecha}; const leccion=JSON.parse(listo.resultado).resultado.lecciones[0];
 assert.equal(leccion.origenes[0].valor,.4);assert.equal(leccion.nivel,'hipotesis');assert.equal(leccion.estado,'propuesta');
 assert.equal(run(codeOf(APR,'Pedir lecciones'),{all:{...all,'Trabajos para aprender':[...creativos,listo]},clock}).length,0);
 const nuevo=run(codeOf(ORQ,'Nuevo video'),{nodes:{Inicio:{tema:'Otro caso peruano'},'Buscar canal':{canal_id:'c'},'Buscar biblia':{resultado:JSON.stringify({resultado:{lecciones:['Regla humana']}})}},all:{'Lecciones antes del guion':[listo]}})[0].json;
 assert.equal(nuevo.pedido.datos.aprendizaje.lecciones[0].id,leccion.id);assert.deepEqual(nuevo.pedido.datos.biblia.lecciones,['Regla humana']);
 const guion=run(codeOf(CL,'Preparar trabajo'),{nodes:{Inicio:nuevo.pedido,'Leer ajustes':{...aj,allowClaude:true}}})[0].json.fila;
 assert.throws(()=>run(codeOf(RET,'Fila actualizada'),{nodes:{Validar:{estado:'ok',resultado:{guion:'Sin aplicar'},avisos:[]},'Buscar trabajo':guion}}),/cada aprendizaje requerido/);
 const aplicado=run(codeOf(RET,'Fila actualizada'),{nodes:{Validar:{estado:'ok',resultado:{guion:'Cifra primero.',aprendizajes_aplicados:[{id:leccion.id,cambio:'La cifra abre el primer plano'}]},avisos:[]},'Buscar trabajo':guion}})[0].json;
 const vista=run(OBS+'return [{json:leccionesCooper($json.c,$json.t)}];',{json:{c:{canal_id:'c'},t:[listo,{...guion,...aplicado,createdAt:fecha}]}})[0].json;
 assert.equal(vista[0].origenes[0].videoId,'v1');assert.equal(vista[0].origenes[0].valor,.4);assert.equal(vista[0].aplicaciones[0].videoId,nuevo.fila.video_id);assert.equal(vista[0].causa,propuesta.lecciones[0].causa);
});
test('aprendizaje total: no acepta evidencia ajena, cifras ausentes ni tres mediciones del mismo video como patrón',()=>{
 const evidencia={video_id:'v',red:'youtube',ventana:'24h',fecha:'2026-11-02T00:00:00Z',metricas:{retencion:.4,vistas:null}};
 const base={regla:'Abrir con el dato',causa:'Hipótesis',correccion:'Cambiar apertura'};
 const evaluar=origenes=>run(APRENDIZAJE+'return [{json:validarAprendizaje($json.r,$json.c,"j")}];',{json:{r:{lecciones:[{...base,origenes}]},c:{evidencias:[evidencia]}}})[0].json.lecciones;
 assert.equal(evaluar([{...evidencia,video_id:'ajeno',metrica:'retencion'}]).length,0);
 assert.equal(evaluar([{...evidencia,metrica:'vistas'}]).length,0);
 assert.equal(evaluar(Array.from({length:3},()=>({...evidencia,metrica:'retencion'})))[0].nivel,'hipotesis');
 assert.equal(run(APRENDIZAJE+'return [{json:leccionesParaGuion($json.t,"otro")}];',{json:{t:[{canal_id:'c',modo:'aprender',estado:'listo',resultado:JSON.stringify({resultado:{evidencia_version:1,lecciones:[{id:'l',origenes:[evidencia]}]}})}]}})[0].json.length,0);
});
test('aprendizaje total: no analiza historial viejo tras error y guarda seguidores solo del post',()=>{
 const fecha='2026-11-02T00:00:00.000Z',clock=relojAprendizaje(fecha),v={video_id:'v',canal_id:'c',publicado_en:'2026-11-01T00:00:00Z',metricas_youtube:JSON.stringify([{fecha:'2026-11-01T00:00:00.000Z',ventana:'24h',vistas:100}])};
 const h=run(codeOf(APR,'Cooper · historial YouTube'),{clock,all:{'Pedidos de retención':[v],$input:[{error:'sin permiso'}]}})[0].json;
 assert.equal(run(codeOf(APR,'Pedir lecciones'),{all:{'Videos publicados':[v],'Cooper · historial YouTube':[h]}}).length,0);
 const hist=run(OBS+'return [{json:JSON.parse(historialRedesCooper($json.p,$json.r,Date.now()))}];',{clock,json:{p:v,r:{platforms:{tiktok:{success:true,post_metrics:{views:20,new_followers:2},profile_snapshot_latest:{followers:999}}}}}})[0].json;
 assert.equal(hist.tiktok[0].seguidoresGanados,2);assert.equal(hist.tiktok[0].ventana,'24h');
});

test('aprendizaje total: reescritura obligatoria y segunda consulta conserva el pedido de su canal',()=>{
 const leccion={id:'l',origenes:[{video_id:'v',red:'youtube'}],regla:'Dato primero'};
 const trabajo={canal_id:'c',modo:'aprender',estado:'listo',resultado:JSON.stringify({resultado:{evidencia_version:1,lecciones:[leccion]}})};
 const r=run(codeOf(CL,'Preparar trabajo'),{nodes:{Inicio:{modo:'corregir_guion',canal_id:'c',datos:{guion:'Anterior'}},'Leer ajustes':aj},all:{'Aprendizajes al escribir':[trabajo,{...trabajo,canal_id:'ajeno'}]}})[0].json;
 assert.deepEqual(r.payload.datos.aprendizaje.lecciones.map(l=>l.id),['l']);
 assert.deepEqual(JSON.parse(r.fila.resultado)._lecciones_requeridas,['l']);
 assert.throws(()=>run(codeOf(RET,'Fila actualizada'),{nodes:{Validar:{estado:'ok',resultado:{guion:'Corrección sin justificar'}},'Buscar trabajo':r.fila}}),/cada aprendizaje requerido/);
 const pedidos=[{video_id:'v',canal_id:'c',token:'ficticio',youtube_id:'abcdefghijk'}];
 assert.deepEqual(run(codeOf(APR,'Reponer pedidos de métricas'),{json:{rows:[]},all:{'Pedidos de retención':pedidos}}).map(x=>x.json),pedidos);
});

test('aprendizaje del plan: persiste evidencia, limita salida y no tiene ruta de IA pagada ni callback',()=>{
 const e={video_id:'v',canal_id:'c',red:'youtube',ventana:'24h',fecha:'2026-11-02T00:00:00Z',metricas:{vistas:12},creativo:{guion:'x'.repeat(10000),planos:[]}};
 const tarea=run(codeOf(APR,'Preparar trabajo de aprendizaje'),{json:{canal_id:'c',datos:{evidencias:[e]}}})[0].json;
 assert.equal(tarea.estado,'enviado');assert.equal(JSON.parse(tarea.resultado)._aprendizaje.evidencias[0].metricas.vistas,12);
 const prompt=run(codeOf(APR,'Pedido al plan de aprendizaje'),{json:tarea})[0].json;
 assert.ok(prompt.prompt.length<60000);assert.equal(prompt.url,'http://127.0.0.1:8789');
 assert.throws(()=>run(codeOf(APR,'Pedido al plan de aprendizaje'),{json:tarea,env:{PUENTE_CODEX_URL:'https://proveedor-pagado.example'}}),/loopback/);
 const propuesta={lecciones:[{regla:'Dato antes',causa:'Hipótesis de apertura lenta',correccion:'Acortar apertura',origenes:[{video_id:'v',red:'youtube',ventana:'24h',metrica:'vistas',valor:999}]}]};
 const evaluar=json=>run(codeOf(APR,'Validar aprendizaje del plan'),{json,all:{'Preparar trabajo de aprendizaje':[tarea]}})[0].json;
 const listo=evaluar({texto:JSON.stringify(propuesta),llamadas:[]});
 assert.equal(listo.estado,'listo');assert.equal(JSON.parse(listo.resultado).resultado.lecciones[0].origenes[0].valor,12);
 for(const mal of [{error:'sin PC'},{texto:'no JSON',llamadas:[]},{texto:JSON.stringify(propuesta),llamadas:[{nombre:'publicar'}]}]) {
  const r=evaluar(mal);assert.equal(r.estado,'error');assert.equal(JSON.parse(r.resultado)._aprendizaje.evidencias[0].metricas.vistas,12);
 }
 const calls=APR.nodes.filter(n=>n.type.endsWith('.executeWorkflow')).map(n=>n.parameters.workflowId.value);
 assert.deepEqual(calls.sort(),['FabAjustes000001','FabYouTube000001'].sort());
 const posts=APR.nodes.filter(n=>n.type.endsWith('.httpRequest') && n.parameters.method==='POST');
 assert.equal(posts.length,1);assert.equal(posts[0].name,'Analizar con el plan de la PC');
 assert.match(posts[0].parameters.url,/\/v1\/chat/);
});

test('aprendizaje del plan: PC caída reintenta evidencia sin nueva métrica y excluye ensayos manuales',()=>{
 const clock=relojAprendizaje('2026-11-02T03:00:00Z');
 const e={video_id:'v',canal_id:'c',red:'youtube',ventana:'24h',fecha:'2026-11-02T00:00:00Z',metricas:{vistas:12},creativo:{}};
 const base={job_id:'aprender-plan-1',canal_id:'c',modo:'aprender',estado:'error',updatedAt:'2026-11-02T01:00:00Z',resultado:JSON.stringify({_aprendizaje:{evidencias:[e]},_plan:{estado:'error'}})};
 const pedir=trabajos=>run(codeOf(APR,'Pedir lecciones'),{clock,all:{'Trabajos para aprender':trabajos}});
 assert.equal(pedir([base])[0].json.datos.evidencias[0].fecha,e.fecha);
 assert.equal(pedir([{...base,updatedAt:'2026-11-02T02:45:00Z'}]).length,0);
 assert.equal(pedir([{...base,estado:'enviado'}]).length,1);
 assert.equal(pedir([{...base,estado:'listo'}]).length,0);
 assert.equal(pedir([{...base,resultado:JSON.stringify({...JSON.parse(base.resultado),_ensayo:{pendiente:true}})}]).length,0);
 assert.equal(pedir([base,{...base,job_id:'resuelto',estado:'listo'}]).length,0);
});

test('reconciliación YouTube: identidad confirmada, reversa y ninguna otra columna modificada',()=>{
 execFileSync('python3',[path.join(__dirname,'test_reconciliar_aprendizaje.py')],{stdio:'pipe'});
});

test('aceptación del plan: lección real validada y siguiente guion lee IDs sin crear un video',async()=>{
 const {aceptar,cargarFuentes}=await import('../tools/cooper/aceptar_aprendizaje_plan.mjs');
 const fuentes=await cargarFuentes(path.join(__dirname,'..'));
 const evidencia={canal_id:'c',video_id:'v',red:'youtube',ventana:'24h',fecha:'2026-11-02T00:00:00Z',metricas:{vistas:14},creativo:{guion:'Un comercio peruano.'}};
 const trabajo={job_id:'aprender-ensayo-test',modo:'aprender',canal_id:'c',estado:'bloqueado',resultado:JSON.stringify({_ensayo:{pendiente:true},_aprendizaje:{evidencias:[evidencia]}})};
 const propuesta={lecciones:[{regla:'Ensayar el dato primero',causa:'Hipótesis',correccion:'Reordenar apertura',origenes:[{video_id:'v',red:'youtube',ventana:'24h',metrica:'vistas'}]}]};
 const leccion=await aceptar({fase:'leccion',trabajo,fuentes},async prompt=>{assert.ok(prompt.includes('Un comercio peruano.'));return {texto:JSON.stringify(propuesta),llamadas:[]};});
 assert.equal(leccion.resultado_validado.lecciones[0].origenes[0].valor,14);
 const listo={...trabajo,estado:'listo',resultado:JSON.stringify({...JSON.parse(trabajo.resultado),resultado:leccion.resultado_validado})};
 const id=leccion.resultado_validado.lecciones[0].id;
 const guion=await aceptar({fase:'guion',trabajo:listo,fuentes},async prompt=>{assert.ok(prompt.includes(id));return {texto:JSON.stringify({guion:'Un comercio peruano abre el relato.',aprendizajes_aplicados:[{id,cambio:'El caso local abre el guion'}]}),llamadas:[]};});
 assert.equal(guion.prueba.omision_rechazada,true);assert.deepEqual(guion.prueba.ids,[id]);assert.equal(guion.crea_video,false);assert.equal(guion.publica,false);
 await assert.rejects(()=>aceptar({fase:'guion',trabajo,fuentes},async()=>({})),/leccion_persistida/);
});
