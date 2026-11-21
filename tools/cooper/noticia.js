// Política de noticias, compartida por radar, guion, producción y publicación.
function fechaNoticia(fecha) {
  const ms = Date.parse(fecha);
  const dia = x => new Intl.DateTimeFormat('en-CA', { timeZone:'America/Lima', year:'numeric', month:'2-digit', day:'2-digit' }).format(x);
  return Number.isFinite(ms) && ms <= Date.now() && dia(ms) === dia(Date.now());
}
function validarHechos(hechos, consultadas) {
  const urls = new Set(consultadas || []);
  return Array.isArray(hechos) && hechos.length > 0 && hechos.length <= 30 &&
    new Set(hechos.map(h => h.id)).size === hechos.length && hechos.every(h =>
      typeof h.id === 'string' && /^[a-z0-9_-]{1,40}$/.test(h.id) && typeof h.dato === 'string' && h.dato.trim() &&
      Array.isArray(h.fuentes) && h.fuentes.length > 0 && h.fuentes.every(f =>
        typeof f.url === 'string' && /^https:\/\/[a-z0-9.-]+(?::443)?(?:[/?#][^\s]*)?$/i.test(f.url) &&
        urls.has(f.url) && typeof f.titulo === 'string' && f.titulo.trim() && Number.isFinite(Date.parse(f.fecha)) && Date.parse(f.fecha) <= Date.now()));
}
function validarNoticia(n) {
  if (!n || !fechaNoticia(n.fecha) || !n.titulo?.trim() || !validarHechos(n.hechos, n.fuentes_consultadas))
    throw new Error('Noticia detenida: faltan hechos, fuentes consultadas o noticia del día');
  return n;
}
function validarVerificacion(n, r, respuesta) {
  validarNoticia(n);
  if (!respuesta?.busqueda_real || r?.verificado !== true || !validarHechos(r.hechos, respuesta.fuentes_consultadas) ||
      r.hechos.length !== n.hechos.length || n.hechos.some(h => !r.hechos.some(v => v.id === h.id && v.dato === h.dato && v.estado === 'ok')))
    throw new Error('Noticia detenida: datos sin verificar o contradictorios');
  return { ...n, hechos:r.hechos, fuentes_consultadas:respuesta.fuentes_consultadas, verificado:true, verificado_en:new Date().toISOString() };
}
function exigirNoticia(n) {
  validarNoticia(n);
  const age = Date.now() - Date.parse(n.verificado_en);
  if (n.verificado !== true || !Number.isFinite(age) || age < 0 || age > 24 * 3600000 || n.hechos.some(h => h.estado !== 'ok'))
    throw new Error('Noticia detenida: verificación ausente o vencida');
}
function huellaGuion(g) {
  return require('crypto').createHash('sha256').update(JSON.stringify(g)).digest('hex');
}
function exigirGuion(v, g) {
  if (!v.modo_noticia) return;
  const n = JSON.parse(v.noticia || 'null'); exigirNoticia(n);
  if (!v.noticia_guion_hash || (g && v.noticia_guion_hash !== huellaGuion(g)))
    throw new Error('Noticia detenida: el guion no coincide con la versión verificada');
}
function exigirVisuales(storyboard) {
  const planos = storyboard?.planos;
  if (!Array.isArray(planos) || !planos.length || planos.some(p =>
    !['imagen','clip'].includes(p.tipo) || p.origen_visual !== 'generado' ||
    !['mapa','cifra','esquema'].includes(p.recurso_didactico) ||
    typeof p.prompt_imagen !== 'string' || !p.prompt_imagen.trim() ||
    /https?:\/\//i.test(JSON.stringify(p))))
    throw new Error('Noticia detenida: solo mapas, cifras y esquemas generados; nunca imágenes de medios');
}
function exigirStoryboard(v, storyboard) {
  if (!v.modo_noticia) return;
  exigirGuion(v, null);
  exigirVisuales(storyboard);
  if (!v.noticia_storyboard_hash || v.noticia_storyboard_hash !== huellaGuion(storyboard))
    throw new Error('Noticia detenida: storyboard distinto de la versión verificada');
}
