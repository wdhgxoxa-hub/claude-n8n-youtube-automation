// Solo datos deterministas de ensayo; nunca abre una base ni archivos de entorno.
const FECHA = '2026-01-01T00:00:00.000Z';
const dueno = i => `dueno${i}@example.test`;
const videoId = i => `video-${String(i).padStart(5, '0')}`;
const tablasPorNodo = {
  'Canales autorizados': 'fab_canales', 'Videos autorizados': 'fab_videos',
  Aprobaciones: 'fab_aprobaciones', 'Piezas de Cooper': 'fab_planos',
  'Publicaciones de Cooper': 'fab_publicaciones', 'Historial de Cooper': 'fab_eventos',
  'Decisiones de Cooper': 'fab_aprobaciones', 'Lecciones de Cooper': 'fab_trabajos',
  'Conexiones de Cooper': 'fab_youtube',
};
function fixture() {
  const tablas = Object.fromEntries([...new Set(Object.values(tablasPorNodo))].map(t => [t, []]));
  for (let i = 0; i < 100; i++) tablas.fab_canales.push({canal_id:`canal-${i}`,dueno_email:dueno(i % 10),nombre:`Canal ${i}`,nicho:'Ensayo',estado:'activo',eliminado:i === 99});
  for (let i = 0; i < 10000; i++) {
    const video_id = videoId(i), canal_id = `canal-${i % 100}`;
    tablas.fab_videos.push({video_id,canal_id:i === 3 ? 'canal-inexistente' : canal_id,dueno_email:i === 0 ? '' : i === 1 ? null : dueno(i % 10),eliminado:i === 2,tema:`Tema ${i}`,etapa:i % 2 ? 'publicado' : 'aprobacion_guion',estado:i % 2 ? 'publicado' : 'pausado',guion_cooper:'G'.repeat(4096),cooper_actualizado_en:1767225600000});
    tablas.fab_planos.push({video_id,plano_id:`plano-${i}`,tipo:'imagen',archivo_url:`https://media.example.test/${video_id}.png`,estado:'listo'});
    tablas.fab_publicaciones.push({video_id,canal_id,request_id:`pub-${i}`,estado:'publicado',publicado_en:FECHA,resultado:JSON.stringify({publicaciones:[{red:'youtube',publicado:true,url:`https://www.youtube.com/watch?v=${video_id}`}]}),metricas_historial:JSON.stringify({youtube:[{fecha:'2026-01-03T00:00:00.000Z',vistas:3},{fecha:FECHA,vistas:1}]})});
    tablas.fab_eventos.push({video_id,canal_id,tipo:'incidencia_cooper',detalle:JSON.stringify({tipo:'calidad',resumen:`Revisar ${video_id}`})});
    tablas.fab_aprobaciones.push({video_id,canal_id,aprobacion_id:`ap-${i}`,estado:'pendiente',etapa:'guion'});
  }
  return tablas;
}
function esperados(auth) {
  const ids = [];
  for (let i=4;i<10000;i++) if(i % 100 !== 99 && (auth.admin || auth.dueno_email === dueno(i % 10))) ids.push(videoId(i));
  return ids;
}
function contexto(filas, auth) {
  return nombre => ({first:()=>({json:nombre === 'Autenticar' ? auth : filas[nombre]?.[0]?.json}),all:()=>filas[nombre] || [],isExecuted:nombre === 'Autenticar' || Object.hasOwn(filas,nombre)});
}
function parametros(valor, $) {
  if (typeof valor === 'string' && valor.startsWith('={{')) return new Function('$',`return (${valor.slice(3,-2)});`)($);
  if (Array.isArray(valor)) return valor.map(v=>parametros(v,$));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k,v])=>[k,parametros(v,$)]));
  return valor;
}
module.exports = {FECHA,dueno,videoId,tablasPorNodo,fixture,esperados,contexto,parametros};
