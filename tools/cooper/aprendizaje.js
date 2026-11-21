// Contrato de aprendizaje: solo evidencia observada, por canal, sin credenciales.
function parseAprendizaje(raw, fallback = {}) { try { return typeof raw === 'string' ? JSON.parse(raw || 'null') ?? fallback : raw ?? fallback; } catch { return fallback; } }
function ventanaAprendizaje(publicado, ahora = Date.now()) {
  const horas = (ahora - Date.parse(publicado || '')) / 3600000;
  return horas >= 168 ? '7d' : horas >= 72 ? '72h' : horas >= 24 ? '24h' : null;
}
function metricasAprendizaje(m) {
  const numero = v => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
  return Object.fromEntries(['vistas','meGusta','comentarios','retencion','seguidoresGanados'].map(k => [k, numero(m?.[k])]));
}
function duracionYoutubeAprendizaje(raw) {
  const m = String(raw || '').match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return null;
  const segundos = Number(m[1] || 0)*86400 + Number(m[2] || 0)*3600 + Number(m[3] || 0)*60 + Number(m[4] || 0);
  return segundos > 0 ? segundos : null;
}
function curvaYoutubeAprendizaje(reporte, duracion) {
  if (!(duracion > 0)) return [];
  const campos = (reporte?.columnHeaders || []).map(c => c.name);
  const tiempo = campos.indexOf('elapsedVideoTimeRatio'), valor = campos.indexOf('audienceWatchRatio');
  if (tiempo < 0 || valor < 0) return [];
  // YouTube entrega 100 intervalos, no una muestra por segundo. No interpolar.
  return (reporte.rows || []).flatMap(r => {
    const t = r[tiempo], v = r[valor];
    return typeof t === 'number' && t > 0 && t <= 1 && typeof v === 'number' && Number.isFinite(v) && v >= 0
      ? [{ segundo:Math.round(t*duracion*1000)/1000, porcentaje:v }] : [];
  }).sort((a,b) => a.segundo-b.segundo).slice(0,100);
}
function contextoAprendizaje(video, trabajos, planos) {
  const propios = trabajos.filter(t => t.video_id === video.video_id && t.canal_id === video.canal_id && ['ok','listo'].includes(t.estado)).sort((a,b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  const resultado = modo => { const r = parseAprendizaje(propios.find(t => modo.includes(t.modo))?.resultado); return r.resultado || r; };
  const guion = resultado(['guion','corregir_guion']), storyboard = resultado(['storyboard']);
  return { titulo: String(guion.titulo || video.tema || '').slice(0,500), guion: typeof guion.guion === 'string' ? guion.guion.slice(0,10000) : null, extracto_acotado:true,
    planos: (storyboard.planos || planos.filter(p => p.video_id === video.video_id).map(p => parseAprendizaje(p.plano, p))).slice(0,80).map(p => ({ id:String(p.id || p.plano_id || ''), texto:String(p.texto_narrado || '').slice(0,500), duracion_s:Number(p.duracion_s) || null, encuadre:String(p.encuadre || '').slice(0,100), texto_pantalla:String(p.texto_pantalla || '').slice(0,200) })),
    miniatura: storyboard.miniatura ? { texto:String(storyboard.miniatura.texto || '').slice(0,200), descripcion:String(storyboard.miniatura.prompt_imagen || '').slice(0,2000) } : null };
}
function acotarEvidenciasAprendizaje(nuevas, anteriores) {
  const vistas=new Set(), salida=[]; let longitud=0;
  for(const e of [...nuevas,...anteriores]) {
    const id=[e.video_id,e.red,e.ventana].join(':'), cantidad=JSON.stringify(e).length;
    if(vistas.has(id) || longitud+cantidad>160000 || salida.length>=12) continue;
    vistas.add(id);salida.push(e);longitud+=cantidad;
  }
  return salida;
}
function validarAprendizaje(resultado, contexto, jobId) {
  const evidencias = Array.isArray(contexto?.evidencias) ? contexto.evidencias : [];
  const texto = (s,n=1500) => String(s || '').slice(0,n);
  const lecciones = (Array.isArray(resultado?.lecciones) ? resultado.lecciones : []).slice(0,30).flatMap((l,i) => {
    const refs = (Array.isArray(l.origenes) ? l.origenes : []).flatMap(o => {
      const e = evidencias.find(e => e.video_id === o.video_id && e.red === o.red && e.ventana === o.ventana);
      if (!e || !['vistas','meGusta','comentarios','retencion','seguidoresGanados'].includes(o.metrica)) return [];
      const punto = o.segundo === undefined ? null : (e.retencion_segundos || []).find(p => p.segundo === o.segundo);
      if (o.segundo !== undefined && (o.metrica !== 'retencion' || !punto)) return [];
      const valor = punto ? punto.porcentaje : e.metricas[o.metrica];
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) return [];
      // El valor procede del registro, nunca de la respuesta del modelo.
      return [{ video_id:e.video_id, red:e.red, ventana:e.ventana, fecha:e.fecha, metrica:o.metrica, valor, ...(punto ? {segundo:punto.segundo} : {}), demora_horas:e.demora_horas || 0 }];
    });
    if (!refs.length || !texto(l.regla).trim() || !texto(l.causa).trim() || !texto(l.correccion).trim()) return [];
    return [{ id:jobId + ':' + i, regla:texto(l.regla,500), causa:texto(l.causa), correccion:texto(l.correccion), origenes:refs.slice(0,20),
      nivel:new Set(refs.map(o=>o.video_id)).size >= 3 ? 'patron' : 'hipotesis', estado:'propuesta', aplicada_en:[] }];
  });
  return { resumen:texto(resultado?.resumen,3000), lecciones, evidencia_version:1 };
}
function leccionesParaGuion(trabajos, canal) {
  return trabajos.filter(t => t.canal_id === canal && t.modo === 'aprender' && ['ok','listo'].includes(t.estado)).sort((a,b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))).flatMap(t => {
    const r=parseAprendizaje(t.resultado); return (r.resultado?.evidencia_version === 1 ? r.resultado.lecciones : []).filter(l=>l.id && l.origenes?.length);
  }).slice(0,30);
}
