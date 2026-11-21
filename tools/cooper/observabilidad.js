// Proyección cerrada de datos públicos: jamás se serializan filas de proveedor/costos.
function jsonCooper(value, fallback) { try { return JSON.parse(value || 'null') ?? fallback; } catch { return fallback; } }
function urlCooper(value) { const s=String(value || ''); return /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::443)?(?:[/?#][^\s\\<>]*)?$/i.test(s) ? s : ''; }
function fechaCooper(value) { const n = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null; }
function numeroCooper(value) { return value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null; }
function textoCooper(value, max = 2000) {
  // Los textos libres de especialistas pueden mencionar datos administrativos.
  return String(value || '').replace(/https?:\/\/\S+/gi, '[enlace]').replace(/(?:Bearer|Apikey)\s+\S+/gi, '[privado]')
    .split(/\n|(?<=[.!?])\s/).filter(s => !/\b(?:USD|US\$|costos?|presupuesto|tokens?|api.?key|secret|proveedor|credencial|OpenAI|Claude|Creatomate|HeyGen|ElevenLabs|Gemini)\b|\$\s*\d/i.test(s)).join(' ').slice(0,max);
}
function curvaCooper(value) { return (Array.isArray(value)?value:[]).map(p=>({segundo:numeroCooper(p.second ?? p.segundo),porcentaje:numeroCooper(p.percentage ?? p.porcentaje)})).filter(p=>p.segundo!==null && p.porcentaje!==null && p.porcentaje<=1).slice(0,600); }
function medicionCooper(value) {
  const fecha = fechaCooper(value.fecha); if (!fecha) return null;
  const r = numeroCooper(value.retencion);
  return { fecha, curvaRetencion:curvaCooper(value.curvaRetencion), vistas:numeroCooper(value.vistas), meGusta:numeroCooper(value.meGusta), comentarios:numeroCooper(value.comentarios), retencion:r };
}
function leccionesCooper(canal, trabajos) {
  return trabajos.filter(t => t.canal_id === canal.canal_id && t.modo === 'aprender' && t.estado === 'ok').slice(-100).flatMap(t => {
    const raw = jsonCooper(t.resultado, {}), r = raw.resultado || raw;
    const fecha = fechaCooper(t.updatedAt || t.createdAt); if (!fecha) return [];
    const lista = x => (Array.isArray(x) ? x : []).map(v => textoCooper(typeof v === 'string' ? v : v.regla || v.leccion || v.descripcion || v.gancho || v.tema, 500)).filter(Boolean).slice(0,20);
    const resumen = textoCooper([r.resumen, ...lista(r.lecciones)].filter(Boolean).join(' '),3000);
    return resumen ? [{id:String(t.job_id),fecha,resumen,ganchos:lista(r.ganchos_que_funcionan || r.ganchos).concat(lista(r.lecciones).filter(x=>/gancho|apertura/i.test(x))).slice(0,20),temas:lista(r.temas_que_funcionan || r.temas).concat(lista(r.lecciones).filter(x=>/tema/i.test(x))).slice(0,20)}] : [];
  });
}
function observabilidadCooper(v, planos, publicaciones, eventos, aprobaciones) {
  const publicadas = publicaciones.filter(p => p.video_id === v.video_id).flatMap(p => {
    const r = jsonCooper(p.resultado, {});
    // Cada red confirmada se conserva aunque otra red del envío falle.
    const resultados = Array.isArray(r.publicaciones) ? r.publicaciones.filter(x => x.publicado === true) : p.estado === 'publicado' ? (r.urls || [p.url]).filter(Boolean).map(url => ({url,red: inferirRedCooper(url)})) : [];
    const historiales = jsonCooper(p.metricas_historial, {});
    return resultados.map(x => ({ id:String(p.request_id)+':'+x.red, red:String(x.red || p.plataforma || 'Otra red'),url:urlCooper(x.url),fecha:fechaCooper(p.publicado_en),miniatura:urlCooper(v.miniatura_url),
      historial:(Array.isArray(historiales[x.red]) ? historiales[x.red] : []).map(medicionCooper).filter(Boolean).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(-90) }));
  });
  if (v.youtube_id && v.estado === 'publicado' && !publicadas.some(p => p.red === 'youtube' && p.url.includes(v.youtube_id))) {
    publicadas.push({id:'youtube:'+v.youtube_id,red:'youtube',url:'https://www.youtube.com/watch?v='+encodeURIComponent(v.youtube_id),fecha:fechaCooper(v.publicado_en),miniatura:urlCooper(v.miniatura_url),historial:jsonCooper(v.metricas_youtube,[]).map(medicionCooper).filter(Boolean).slice(-90)});
  }
  const ytHist=jsonCooper(v.metricas_youtube,[]).map(medicionCooper).filter(Boolean);
  for (const p of publicadas) if (p.red==='youtube') {
    const porDia=new Map(ytHist.map(m=>[m.fecha.slice(0,10),m]));
    for (const m of p.historial) { const otro=porDia.get(m.fecha.slice(0,10)); porDia.set(m.fecha.slice(0,10),{...m,retencion:m.retencion ?? otro?.retencion ?? null}); }
    p.historial=[...porDia.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(-90);
  }
  // Los eventos de resolución explicitan qué revisión fue superada. Avanzar de etapa no basta.
  const propios = eventos.filter(e => e.video_id === v.video_id && ['incidencia_cooper','correccion_cooper'].includes(e.tipo)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  const incidencias=[];
  for (const e of propios) {
    const d=jsonCooper(e.detalle,{}), fecha=fechaCooper(e.createdAt); if (!fecha) continue;
    if (e.tipo === 'correccion_cooper') {
      for (const i of incidencias) if (i.estado === 'pendiente' && (d.tipos || []).includes(i.tipo)) { i.estado='corregido'; i.corregidoEn=fecha; i.cambio=textoCooper(d.cambio); }
    } else if (['ejecucion','critico','verificador','correccion','calidad'].includes(d.tipo)) incidencias.push({id:String(e.id || e.evento),tipo:d.tipo,resumen:textoCooper(d.resumen),fecha,estado:'pendiente',corregidoEn:null,cambio:''});
  }
  for (const a of aprobaciones.filter(a=>a.video_id===v.video_id && a.cambios)) {
    const fecha=fechaCooper(a.decidido_en || a.createdAt); if (!fecha) continue;
    const siguiente=aprobaciones.filter(b=>b.video_id===v.video_id && b.etapa===a.etapa && ['aprobado','decidida'].includes(b.estado) && fechaCooper(b.decidido_en)>fecha).sort((a,b)=>String(a.decidido_en).localeCompare(String(b.decidido_en)))[0];
    incidencias.push({id:'aprobacion:'+a.aprobacion_id,tipo:'correccion',resumen:textoCooper(a.cambios),fecha,estado:siguiente?'corregido':'pendiente',corregidoEn:siguiente?fechaCooper(siguiente.decidido_en):null,cambio:siguiente?'La nueva versión recibió aprobación después de los cambios solicitados.':''});
  }
  if (v.error && !incidencias.some(i=>i.estado==='pendiente')) incidencias.push({id:'estado:'+v.video_id,tipo:'ejecucion',resumen:'La producción registró un fallo; está pendiente de revisión.',fecha:fechaCooper(v.updatedAt || v.createdAt) || new Date(0).toISOString(),estado:'pendiente',corregidoEn:null,cambio:''});
  const guardadas = jsonCooper(v.cooper_escenas,[]);
  const escenas = guardadas.length ? guardadas : planos.filter(p=>p.video_id===v.video_id).map((p,i)=>({id:p.plano_id,orden:Math.max(0,Number(p.orden) || i),imagen:['imagen','ilustracion'].includes(p.tipo)?p.archivo_url || p.url:'',clip:['clip','archivo','avatar'].includes(p.tipo)?p.archivo_url || p.url:'',voz:p.voz_url || ''}));
  return {montaje:urlCooper(v.render_url),miniatura:urlCooper(v.miniatura_url),escenas:escenas.slice(0,200).map((e,i)=>({id:String(e.id || i),orden:Math.max(0,Math.floor(Number(e.orden)||0)),imagen:urlCooper(e.imagen),clip:urlCooper(e.clip),voz:urlCooper(e.voz)})),publicaciones:publicadas.slice(0,100),incidencias:incidencias.slice(-200)};
}
function inferirRedCooper(url) { const host = String(url).match(/^https:\/\/(?:www\.)?([^/:?#]+)/i)?.[1]?.toLowerCase(); return ({'youtube.com':'youtube','youtu.be':'youtube','tiktok.com':'tiktok','instagram.com':'instagram','facebook.com':'facebook'})[host] || 'Otra red'; }
function historialRedesCooper(p, respuesta, ahora) {
  const historial=jsonCooper(p.metricas_historial,{}), fecha=new Date(ahora).toISOString();
  for (const [red,r] of Object.entries(respuesta.platforms || {})) {
    if (r.success !== true || r.post_metrics_error || !r.post_metrics) continue;
    const m=r.post_metrics;
    // No usar snapshots del perfil como si fueran métricas de un video.
    const curva=curvaCooper(m.retention);
    const dato={fecha,vistas:numeroCooper(m.views),meGusta:numeroCooper(m.likes),comentarios:numeroCooper(m.comments),retencion:null,curvaRetencion:curva};
    const prev=Array.isArray(historial[red])?historial[red]:[];
    historial[red]=[...prev.filter(x=>x.fecha?.slice(0,10)!==fecha.slice(0,10)),dato].slice(-90);
  }
  return JSON.stringify(historial);
}
