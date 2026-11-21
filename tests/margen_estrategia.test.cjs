// Datos públicos y compatibilidad editorial; sin red, sesiones ni base real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '..');
const leer = p => JSON.parse(fs.readFileSync(path.join(raiz, p), 'utf8'));
const datos = n => leer(`canales/margen-real/${n}.json`);
const competidores = datos('competidores');
const biblia = datos('biblia');
const lecciones = datos('lecciones');
const identidad = datos('identidad');
const campos = leer('cooper/src/contratos/biblia-campos.json');
const flujo = leer('workflows/v2/FabOrquestador01.json');
const codigo = nombre => flujo.nodes.find(n => n.name === nombre).parameters.jsCode;
const hojas = (objeto, prefijo = '') => Object.entries(objeto).flatMap(([k, v]) => {
  const campo = prefijo ? `${prefijo}.${k}` : k;
  return v && typeof v === 'object' && !Array.isArray(v) ? hojas(v, campo) : [[campo, v]];
});
const mediana = xs => {
  const orden = [...xs].sort((a, b) => a - b);
  return (orden[Math.floor((orden.length - 1) / 2)] + orden[Math.floor(orden.length / 2)]) / 2;
};

test('muestras: denominadores, medianas, razones y ranking se recalculan desde las observaciones', () => {
  assert.ok(competidores.canales.length >= 5 && competidores.canales.length <= 10);
  assert.equal(new Set(competidores.canales.map(c => c.id)).size, competidores.canales.length);
  for (const c of competidores.canales) {
    const vs = c.videos.filter(v => v.vistas !== null);
    assert.ok(vs.length >= 4, c.id);
    const media = vs.reduce((s, v) => s + v.vistas, 0) / vs.length;
    assert.equal(c.resumen.n, vs.length, c.id);
    assert.equal(c.resumen.media_vistas, media, c.id);
    assert.equal(c.resumen.mediana_vistas, mediana(vs.map(v => v.vistas)), c.id);
    assert.equal(c.resumen.mediana_duracion_s, mediana(vs.map(v => v.duracion_s)), c.id);
    assert.equal(c.resumen.duracion_min_s, Math.min(...vs.map(v => v.duracion_s)));
    assert.equal(c.resumen.duracion_max_s, Math.max(...vs.map(v => v.duracion_s)));
    assert.deepEqual(c.resumen.ranking_ids, [...vs].sort((a, b) => b.vistas - a.vistas).map(v => v.id));
    assert.equal(new Set(vs.map(v => v.id)).size, vs.length, c.id);
    for (const v of vs) {
      assert.ok(Number.isFinite(v.vistas) && v.vistas >= 0);
      assert.ok(Number.isInteger(v.duracion_s) && v.duracion_s > 0);
      assert.equal(new URL(v.url).searchParams.get('v'), v.id);
      assert.equal(v.ratio_media_muestra, Number((v.vistas / media).toFixed(6)), v.id);
      assert.match(v.consultado_en, /^2026-11-21/);
      assert.ok(v.publicado_en || v.edad_visible, v.id);
      assert.ok(['contador_entero_publico', 'redondeadas_por_youtube'].includes(v.precision_vistas));
    }
    assert.ok(c.seleccion && c.limites.length && c.fuentes_seleccion.length);
  }
});

test('muestras hispanas: los ocho elegidos respetan el orden, madurez y duración, sin elegir por vistas', () => {
  for (const c of competidores.canales.filter(c => c.candidatos_en_orden_visible)) {
    for (const v of c.candidatos_en_orden_visible) {
      if (v.vistas === null) assert.equal(v.vistas_texto, null, v.id);
      else assert.match(v.vistas_texto, /vistas/, v.id);
    }
    const elegibles = c.candidatos_en_orden_visible.filter(v => {
      const edad = v.edad_visible.match(/^hace (\d+) (mes|meses|año)$/);
      const meses = edad ? Number(edad[1]) * (edad[2] === 'año' ? 12 : 1) : 0;
      return meses >= 1 && meses <= 12 && v.duracion_s >= 240 && v.duracion_s <= 3600 && v.vistas !== null;
    }).slice(0, 8);
    assert.deepEqual(c.videos.map(v => v.id), elegibles.map(v => v.id), c.id);
    for (const v of c.videos) {
      const candidato = elegibles.find(e => e.id === v.id);
      assert.equal(v.vistas, candidato.vistas);
      assert.equal(v.duracion_s, candidato.duracion_s);
    }
  }
});

test('hipótesis: toda evidencia existe y ninguna se convierte en aprendizaje propio confirmado', () => {
  assert.deepEqual(lecciones.confirmadas, []);
  assert.equal(lecciones.piloto.activar_rutina, false);
  assert.equal(lecciones.piloto.publicar, false);
  for (const h of lecciones.hipotesis) {
    assert.equal(h.estado, 'hipotesis_no_validada');
    assert.deepEqual(h.videos_propios_de_validacion, []);
    const canales = h.competidores_ids.map(id => competidores.canales.find(c => c.id === id));
    assert.ok(canales.every(Boolean), h.id);
    const ids = new Set(canales.flatMap(c => c.videos.map(v => v.id)));
    assert.ok(h.videos_fuente_ids.every(id => ids.has(id)), h.id);
  }
});

test('identidad: canal propio, homónimos y TikTok mantienen IDs y grados de certeza separados', () => {
  const propia = identidad.cuenta_de_la_mision;
  assert.equal(propia.vinculo_youtube_tiktok_verificado, false);
  const evidencias = identidad.evidencia_publica.identities;
  const canal = evidencias.find(e => e.url === `${propia.youtube_url}/about`);
  assert.equal(canal.channelId, propia.youtube_channel_id);
  assert.equal(new Set(evidencias.map(e => e.channelId)).size, evidencias.length);
  const homonimo = evidencias.find(e => e.url.includes('/@MARGENREAL/'));
  assert.equal(homonimo.country, 'España');
  assert.notEqual(homonimo.channelId, propia.youtube_channel_id);
  assert.equal(identidad.homonimo_mexicano.estado, 'no_confirmado');
  for (const v of identidad.evidencia_publica.own_shorts) assert.equal(v.channelId, propia.youtube_channel_id);
});

test('parche editorial: solo campos admitidos por Cooper y valores menores de 6000 caracteres', () => {
  for (const [campo, valor] of hojas(biblia)) {
    assert.ok(campos[campo], campo);
    assert.equal(campos[campo].tipo, 'texto', campo);
    assert.equal(typeof valor, 'string', campo);
    assert.ok(valor.length > 0 && valor.length <= 6000, campo);
  }
});

test('fábrica existente: aplicar el parche conserva configuración y entrega las fuentes al guionista', () => {
  const anterior = {
    canal_id: 'canal-ficticio', nombre: 'Nombre vigente',
    voz: { descripcion: 'Voz vigente' }, estilo_visual: { descripcion: 'Identidad vigente' },
    presupuesto: { short_usd: 1 }, calendario: { frecuencia_semanal: 1 },
    lecciones: [{ regla: 'Aprendizaje previo ficticio', evidencia: 'tres videos ficticios' }],
    publicacion: { instagram: 'Regla existente' },
  };
  let fila = { job_id: 'biblia-ficticia', resultado: JSON.stringify({ resultado: anterior }) };
  for (const [campo, valor] of hojas(biblia)) {
    const $ = () => ({ first: () => ({ json: { campo, valor: JSON.stringify(valor) } }) });
    const salida = new Function('$', '$json', codigo('Aplicar ajuste'))($, fila)[0].json;
    assert.equal(salida.ok, true, campo);
    fila = { ...fila, resultado: salida.resultado };
  }
  const final = JSON.parse(fila.resultado).resultado;
  for (const clave of ['canal_id', 'nombre', 'voz', 'estilo_visual', 'presupuesto', 'calendario', 'lecciones']) {
    assert.deepEqual(final[clave], anterior[clave], clave);
  }
  assert.equal(final.publicacion.instagram, anterior.publicacion.instagram);
  const nodos = {
    Inicio: { tema: 'Caso ficticio', formato: 'short' },
    'Buscar canal': { canal_id: anterior.canal_id, presupuesto_short_usd: 1 },
    'Buscar biblia': fila,
  };
  const $ = nombre => {
    if (nombre === 'Canal con competencia') return { isExecuted: false };
    if (['Lecciones antes del guion', 'Temas recientes del canal'].includes(nombre)) {
      return { all: () => [] };
    }
    assert.ok(Object.hasOwn(nodos, nombre), `Nodo esperado: ${nombre}`);
    return { first: () => ({ json: nodos[nombre] }) };
  };
  const salida = new Function('$', '$input', codigo('Nuevo video'))($, { all: () => [] })[0].json;
  assert.equal(salida.pedido.datos.biblia.notas, biblia.notas);
  assert.equal(salida.pedido.datos.biblia.publicacion.tiktok, biblia.publicacion.tiktok);
  assert.equal(salida.pedido.canal_id, anterior.canal_id);
});
