import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidatosYouTubeCompetencia, normalizarCompetenciaYouTube,
  normalizarCompetencia, combinarCompetenciaYouTube, proyectarCompetencia,
} from '../cooper/src/contratos/competencia.mjs';

const ahora = Date.parse('2026-11-21T12:00:00Z');
const propia = 'UC' + 'p'.repeat(22);
const ids = ['a', 'b', 'c'].map(x => 'UC' + x.repeat(22));
const ok = items => ({ statusCode: 200, body: { items } });
const perfil = id => 'https://www.youtube.com/channel/' + id;
function evidencia() {
  const identidades = ids.map((id, k) => ok([{ id, snippet: { title: 'Cuenta ' + k, country: 'PE' },
    contentDetails: { relatedPlaylists: { uploads: 'UU' + id.slice(2) } } }]));
  const videos = ids.flatMap((id, k) => Array.from({ length: 4 }, (_, j) => ({
    id: `${k}${j}` + 'v'.repeat(9), snippet: { channelId: id, title: 'Publicación', publishedAt: new Date(ahora - j * 86400000).toISOString() },
    statistics: { viewCount: ['1000', '100', '120', '90'][j], likeCount: '3' }, contentDetails: { duration: 'PT35S' },
  })));
  return { propia, candidatos: ids, identidades,
    listas: ids.map(id => ({ cuenta: id, playlist: 'UU' + id.slice(2), respuesta: ok(videos.filter(v => v.snippet.channelId === id).map(v => ({ contentDetails: { videoId: v.id } }))) })),
    videos: ok(videos), busqueda: ok([
      { id: { channelId: propia }, snippet: { title: 'Margen Real' } },
      { id: { channelId: 'UC' + 'h'.repeat(22) }, snippet: { title: 'Margen real ' } },
      { id: { channelId: 'UC' + 'z'.repeat(22) }, snippet: { title: 'El Margen' } },
    ]),
  };
}
test('YouTube conserva doce métricas nativas, excluye propio y no deduce formatos ni outliers', () => {
  const c = normalizarCompetenciaYouTube(evidencia(), 'Margen Real', ahora);
  assert.equal(c.fuente, 'youtube_data_api');
  assert.equal(c.estado, 'parcial');
  assert.equal(c.competidores.length, 3);
  assert.equal(c.competidores.flatMap(p => p.muestras).length, 12);
  assert.equal(c.competidores.flatMap(p => p.outliers).length, 0);
  assert.ok(c.competidores.every(p => p.muestras.every(v => v.formato === 'sin_clasificar' && v.likes === 3 && v.comentarios === null)));
  assert.equal(c.homonimos.length, 1); assert.equal(c.homonimos[0].pais, '');
  assert.match(c.diferenciacion, /Perú.*soles/);
  assert.deepEqual(proyectarCompetencia(c, 'Margen Real'), c);
});
test('YouTube rechaza respuestas fallidas, cuentas no pedidas y pertenencia discordante', () => {
  const d = evidencia(); d.identidades[0].statusCode = 403;
  d.identidades.push(ok([{ id: 'UC' + 'x'.repeat(22), snippet: { title: 'Ajena' } }]));
  d.videos.body.items[4].snippet.channelId = ids[2];
  d.listas[2].playlist = 'playlist-distinta';
  d.videos.body.items[5].statistics.viewCount = '-1';
  d.videos.body.items[6].statistics.viewCount = '9007199254740993';
  const c = normalizarCompetenciaYouTube(d, 'Margen Real', ahora);
  assert.equal(c.competidores.length, 2);
  assert.equal(c.competidores.flatMap(p => p.muestras).length, 1);
  d.propia = undefined;
  assert.equal(normalizarCompetenciaYouTube(d, 'Margen Real', ahora).competidores.length, 0);
});
test('el contrato web sigue rechazando afirmaciones nativas sin prueba de apertura', () => {
  const c = normalizarCompetencia({ competidores: [{ nombre: 'Inventado' }] },
    { ruta: 'youtube_data_api', busqueda_real: true, fuentes_consultadas: [perfil(ids[0])] }, 'Margen Real', ahora);
  assert.equal(c.estado, 'sin_datos'); assert.equal(c.competidores.length, 0);
});
test('diez muestras por cuenta no aumentan peticiones y >180 segundos excluye Shorts, sin mezclar directos', () => {
  const d = evidencia();
  d.videos = ok(ids.flatMap((id,k) => Array.from({length:10},(_,j) => ({
    id: `${k}${j}`+'v'.repeat(9), snippet:{channelId:id,title:'Largo ficticio',liveBroadcastContent:'none',publishedAt:new Date(ahora-j*86400000).toISOString()},
    contentDetails:{duration:'PT3M1S'},statistics:{viewCount:'100'},
  }))));
  d.listas = ids.map(id => ({cuenta:id,playlist:'UU'+id.slice(2),respuesta:ok(d.videos.body.items.filter(v=>v.snippet.channelId===id).map(v=>({contentDetails:{videoId:v.id}})))}));
  let c = normalizarCompetenciaYouTube(d,'Margen Real',ahora);
  assert.equal(c.competidores.flatMap(p=>p.muestras).length,30);
  assert.ok(c.competidores.every(p=>p.muestras.every(v=>v.formato==='largo')));
  assert.ok(c.competidores.every(p=>p.outliers.length===0));
  assert.equal(c.estado,'parcial'); // TikTok sigue pendiente.
  d.videos.body.items[0].contentDetails.duration='PT3M';
  d.videos.body.items[1].contentDetails.duration='PT';
  d.videos.body.items[2].liveStreamingDetails={actualStartTime:'2026-11-18T12:00:00Z'};
  d.videos.body.items[3].snippet.liveBroadcastContent='upcoming';
  c=normalizarCompetenciaYouTube(d,'Margen Real',ahora);
  assert.ok(c.competidores[0].muestras.slice(0,4).every(v=>v.formato==='sin_clasificar'));
  assert.ok(c.competidores[0].muestras.slice(4).every(v=>v.formato==='largo'));
});
test('solo el formato web comprobado habilita comparaciones y ambas redes mantienen su puerta', () => {
  const nativa = normalizarCompetenciaYouTube(evidencia(), 'Margen Real', ahora);
  const raw = { competidores: nativa.competidores.map(c => ({ ...c, muestras: c.muestras.map(v => ({ ...v, formato: 'short' })) })),
    comprobaciones: ['youtube', 'tiktok'].map(red => ({ red, consulta: 'Margen Real en ' + red, url: `https://www.${red}.com/results?q=MargenReal` })) };
  const fuentes = [...raw.competidores.flatMap(c => [c.url, ...c.muestras.map(v => v.url)]), ...raw.comprobaciones.map(c => c.url)];
  const web = normalizarCompetencia(raw, { ruta: 'codex', busqueda_real: true, fuentes_consultadas: fuentes }, 'Margen Real', ahora);
  const combinada = combinarCompetenciaYouTube(web, nativa, 'Margen Real', ahora);
  assert.equal(combinada.estado, 'listo'); assert.equal(combinada.competidores[0].outliers[0].multiplicador, 10);
  assert.equal(combinada.fuente, 'youtube_data_api_y_web');
  assert.equal(nativa.competidores[0].muestras[0].formato, 'sin_clasificar');
  web.comprobaciones = [];
  assert.equal(combinarCompetenciaYouTube(web, nativa, 'Margen Real', ahora).estado, 'parcial');
});
test('candidatos iniciales reales son por territorio; otros canales usan sus propias cuentas verificadas', () => {
  assert.equal(candidatosYouTubeCompetencia({ nombre: 'Margen Real' }).length, 3);
  assert.deepEqual(candidatosYouTubeCompetencia({ nombre: 'Otro canal' }), []);
  assert.deepEqual(candidatosYouTubeCompetencia({ nombre: 'Otro', competencia: { competidores: [{ url: perfil(ids[1]) }] } }), [ids[1]]);
});
test('subflujo nativo tiene ocho GET máximos, permiso por canal y cero registros privados', () => {
  const f = JSON.parse(fs.readFileSync(new URL('../workflows/v2/FabCompYouTube01.json', import.meta.url)));
  assert.equal(f.active, false);
  assert.ok(!f.nodes.some(n => /webhook|scheduleTrigger|telegram|dataTable/.test(n.type)));
  const llamadas = f.nodes.filter(n => n.type.endsWith('.executeWorkflow'));
  assert.equal(llamadas.length, 1); assert.equal(llamadas[0].parameters.workflowId.value, 'FabYouTube000001');
  for (const n of f.nodes.filter(n => n.type.endsWith('.httpRequest'))) {
    assert.equal(n.parameters.method, 'GET');
    assert.match(n.parameters.url, /^https:\/\/www.googleapis.com\/youtube\/v3\/(channels|playlistItems|videos|search)$/);
    assert.equal(n.parameters.options.timeout, 20000);
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
    assert.equal(n.retryOnFail, undefined);
  }
  assert.equal(f.settings.saveDataSuccessExecution, 'none'); assert.equal(f.settings.saveDataErrorExecution, 'none');
  assert.equal(f.settings.saveManualExecutions, false); assert.equal(f.settings.saveExecutionProgress, false);
  const radar = JSON.parse(fs.readFileSync(new URL('../workflows/v2/FabRadar00000001.json', import.meta.url)));
  assert.equal(radar.nodes.find(n => n.name === 'Consultar YouTube por canal').parameters.mode, 'each');
  assert.equal(radar.connections['Competencia comprobada'].main[0][0].node, 'Consultar YouTube por canal');
  assert.equal(radar.connections['Competencia con YouTube'].main[0][0].node, 'Solo tendencias');
  assert.match(f.nodes.find(n=>n.name==='Publicaciones de competidores').parameters.jsonQuery,/maxResults:10/);
  assert.match(f.nodes.find(n=>n.name==='IDs públicos observados').parameters.jsCode,/slice\(0,30\)/);
  assert.match(f.nodes.find(n=>n.name==='Métricas públicas de YouTube').parameters.jsonQuery,/liveStreamingDetails/);
});
