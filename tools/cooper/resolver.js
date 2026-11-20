const auth = $('Autenticar').first().json, b = auth.solicitud, d = b.datos;
const fail = (status, error) => [{ json: { status, respuesta: { error }, accion: 'responder' } }];
const own = x => !!x.dueno_email && (auth.admin || x.dueno_email === auth.dueno_email);
const canales = $('Canales autorizados').all().map(i => i.json).filter(c => c.canal_id && own(c) && !c.eliminado);
const videos = $('Videos autorizados').all().map(i => i.json).filter(v => v.video_id && own(v) && !v.eliminado && canales.some(c => c.canal_id === v.canal_id));
const safeVideo = v => ({ id: v.video_id, dueno_email: v.dueno_email, canal_id: v.canal_id, titulo: String(v.tema || ''),
  stage: CONTRATO.etapas[v.etapa] ?? 0, script: String(v.guion_cooper || '').slice(0, 30000), actualizado_en: Number(v.cooper_actualizado_en) || Date.parse(v.updatedAt || v.createdAt) || 0 });
if (b.evento === 'estado') return [{ json: { accion: 'responder', status: 200, respuesta: {
  canales: canales.map(c => ({ id: c.canal_id, dueno_email: c.dueno_email, nombre: String(c.nombre || ''), nicho: String(c.nicho || '') })), videos: videos.map(safeVideo) } } }];
if (['reporte', 'pendientes', 'tendencias'].includes(b.evento)) {
  const summary = b.evento === 'tendencias' ? canales.map(c => {
    let t = {}; try { t = JSON.parse(c.tendencias || '{}'); } catch { /* no radar */ }
    return `${c.nombre}: ${String(t.resumen || 'Sin tendencias registradas.').slice(0, 1000)}`;
  }).join('\n') : videos.filter(v => b.evento !== 'pendientes' || ['aprobacion_guion', 'aprobacion_final'].includes(v.etapa))
    .map(v => `${v.tema}: ${v.etapa}`).join('\n');
  return [{ json: { accion: 'responder', status: 200, respuesta: { resumen: summary || 'Sin resultados en tu espacio.' } } }];
}
if (b.evento === 'gastos') return [{ json: { accion: 'gastos' } }];
const validId = x => typeof x === 'string' && /^[\w-]{1,160}$/.test(x);
if (!validId(d.id)) return fail(400, 'Falta el identificador');
const videoEvent = ['corregir', 'aprobar_guion', 'aprobar_final', 'programar', 'referencias'].includes(b.evento);
const resource = b.evento === 'eliminar' ? (d.tipo === 'canal' ? canales : d.tipo === 'video' ? videos : []).find(r => (r.video_id || r.canal_id) === d.id)
  : b.evento.startsWith('aprobar_') ? videos.find(v => v.video_id === d.id)
  : videoEvent ? videos.find(v => v.video_id === d.recursoId) : canales.find(c => c.canal_id === d.recursoId);
if (b.evento !== 'nuevo_canal' && !resource) return fail(404, 'Recurso no disponible');
if (b.evento === 'nuevo_canal' && canales.some(c => c.canal_id === d.id) || b.evento === 'nuevo_video' && videos.some(v => v.video_id === d.id)) return fail(409, 'Identificador existente');
if (b.evento === 'nuevo_video' && (resource.estado !== 'activo' || !String(resource.biblia_ruta).startsWith('trabajo:'))) return fail(409, 'El canal todavía se está preparando');
const e = { evento: b.evento, dueno_email: resource?.dueno_email || auth.dueno_email,
  canal_id: b.evento === 'nuevo_canal' ? d.id : resource?.canal_id,
  video_id: b.evento === 'nuevo_video' ? d.id : resource?.video_id || '', cooper: true };
const text = typeof d.texto === 'string' ? d.texto.trim() : '';
const p = d.parametros && typeof d.parametros === 'object' && !Array.isArray(d.parametros) ? d.parametros : {};
if (!['aprobar_guion', 'aprobar_final', 'eliminar'].includes(b.evento) && (!text || text.length > 6000)) return fail(400, 'Texto inválido');
switch (b.evento) {
  case 'nuevo_canal': e.criterios = text; e.nombre = String(d.nombre || text).slice(0,120); break;
  case 'nuevo_video': e.tema = text; e.formato = ['short','largo'].includes(p.formato) ? p.formato : resource.formato_defecto; break;
  case 'corregir': e.instruccion = text; e.etapa = (CONTRATO.etapas[resource.etapa] ?? 0) >= 4 ? 'storyboard' : 'guion'; break;
  case 'programar': {
    const time = Date.parse(text);
    if (!Number.isFinite(time) || time <= Date.now() + 3600000 || time >= Date.now() + 180 * 86400000) return fail(400, 'Fecha fuera del intervalo de una hora a seis meses');
    e.fecha = text; break;
  }
  case 'ajustar_biblia': {
    if (p.campo && (!/^[a-z_]+(\.[a-z_0-9]+){0,3}$/.test(p.campo) || p.campo.split('.').some(x => ['__proto__','prototype','constructor','canal_id','nombre'].includes(x)))) return fail(400, 'Campo inválido');
    e.campo = p.campo || 'notas'; e.valor = p.valor === undefined ? text : JSON.stringify(p.valor); break;
  }
  case 'configurar_redes': {
    // Los campos con significado operativo se envían estructurados; no se inventa un perfil.
    if (typeof p.perfil !== 'string' || !/^[A-Za-z0-9_.-]{2,60}$/.test(p.perfil) || !Array.isArray(p.redes) || !p.redes.length || p.redes.some(r => !['youtube','tiktok','instagram','facebook'].includes(r))) return fail(400, 'Indica perfil y redes en parametros');
    e.perfil = p.perfil; e.redes = p.redes.join(',');
    if (p.zona) { try { new Intl.DateTimeFormat('es', { timeZone: p.zona }); } catch { return fail(400, 'Zona inválida'); } e.zona = p.zona; } break;
  }
  case 'metas': {
    const n = p.videos_semana ?? Number((text.match(/\d+/) || [])[0]);
    if (!Number.isInteger(n) || n < 0 || n > 21) return fail(400, 'Indica de cero a veintiún videos por semana');
    e.videos_semana = n;
    if (p.auto !== undefined) { if (typeof p.auto !== 'boolean') return fail(400, 'Auto inválido'); e.auto = p.auto; }
    if (p.formato !== undefined) { if (!['short','largo'].includes(p.formato)) return fail(400, 'Formato inválido'); e.formato = p.formato; }
    // Los usuarios no leen ni cambian presupuestos internos.
    break;
  }
  case 'adoptar_cuenta': e.url = text; e.red = p.red || ''; break;
  case 'aprobar_guion': case 'aprobar_final': {
    const stage = b.evento === 'aprobar_guion' ? 'guion' : 'final';
    if (resource.etapa !== 'aprobacion_' + stage) return fail(409, 'Sin aprobación pendiente');
    const ap = $('Aprobaciones').all().map(i => i.json).filter(a => a.video_id === resource.video_id && a.etapa === stage && a.estado === 'pendiente')
      .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if (!ap) return fail(409, 'Sin decisión pendiente');
    let original; try { original = JSON.parse(ap.pedido); } catch { return fail(409, 'Decisión incompleta'); }
    e.evento = 'aprobado'; e.etapa = stage; e.contexto = original.contexto; e.aprobacion_id = ap.aprobacion_id; break;
  }
  case 'eliminar':
    // No prometer cancelar un proveedor ya en vuelo. La eliminación exige recursos en reposo.
    if (videos.some(v => (d.tipo === 'canal' ? v.canal_id === d.id : v.video_id === d.id) && !['aprobacion_guion','aprobacion_final','publicado'].includes(v.etapa))) return fail(409, 'Hay producción en curso');
    e.tipo = d.tipo; e.id = d.id; break;
}
return [{ json: { accion: 'orden', status: 200, evento: e } }];
