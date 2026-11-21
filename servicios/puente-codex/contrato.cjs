// Compartido con los nodos de n8n; no depende del sistema de archivos ni de red.
function leerTexto(respuesta) {
  const texto = (respuesta?.output || []).filter(x => x.type === 'message')
    .flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n');
  try { return JSON.parse(texto); } catch { return null; }
}
function textoValido(tarea, respuesta) {
  if (respuesta?.error || respuesta?.status === 'incomplete') return false;
  const v = leerTexto(respuesta);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  switch (tarea) {
    case 'critico_nicho': return Array.isArray(v.sin_fuente) && Array.isArray(v.riesgos) && typeof v.veredicto === 'string';
    case 'critico': return ['gancho','promesa','claridad','emocion','exactitud','originalidad'].every(k => Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 10) && Array.isArray(v.problemas);
    case 'verificador': return Array.isArray(v.cifras) && Array.isArray(v.faltantes) && Array.isArray(v.cuenta);
    case 'radar': return Array.isArray(v.ideas) && typeof v.resumen === 'string';
    case 'radar_noticia': return v.noticia === null || typeof v.noticia?.titulo === 'string' && Array.isArray(v.noticia.hechos);
    case 'verificador_noticia': return typeof v.verificado === 'boolean' && Array.isArray(v.hechos);
    default: return false;
  }
}
function fuentesRespuesta(respuesta) {
  return [...new Set((respuesta?.output || []).flatMap(x => x.type === 'web_search_call'
    ? (x.action?.sources || []).map(s => s.url).concat(x.action?.url || [])
    : (x.content || []).flatMap(c => (c.annotations || []).filter(a => a.type === 'url_citation').map(a => a.url)))
    .filter(u => typeof u === 'string' && /^https:\/\//.test(u)))];
}
module.exports = { leerTexto, textoValido, fuentesRespuesta };
