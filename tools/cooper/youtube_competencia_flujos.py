"""Lecturas públicas acotadas de YouTube con el permiso existente de cada canal.

Sin OAuth interactivo, escritura social, servicio monetizado ni persistencia de tokens.
Un subflujo por canal evita mezclar permisos, identidades o métricas entre canales.
"""
W['competencia_yt'] = 'FabCompYouTube01'
f = Flow(W['competencia_yt'], 'FX · Competencia pública de YouTube')
trigger(f)
code(f, 'Candidatos del canal', COMPETENCIA_JS + r"""
const p=$('Inicio').first().json; let t;try{t=JSON.parse(p.tendencias||'{}');}catch{t={};}
return [{json:{accion:'token',canal_id:p.canal_id,candidatos:candidatosYouTubeCompetencia({nombre:p.nombre,competencia:t.competencia})}}];
""")
iff(f, '¿Hay candidatos YouTube?', '$json.candidatos.length > 0')
call(f, 'Permiso existente del canal', W['yt'])
f.nodes[-1]['onError'] = 'continueRegularOutput'
iff(f, '¿Permiso YouTube disponible?', "$json.ok === true && !!$json.access_token && /^UC[\\w-]{22}$/.test($json.canal_youtube_id || '')")
code(f, 'Tres cuentas públicas', "return $('Candidatos del canal').first().json.candidatos.map(candidato=>({json:{candidato}}));")

def lectura_competencia(nombre, recurso, consulta):
    http(f, nombre, 'GET', 'https://www.googleapis.com/youtube/v3/' + recurso, auth=False, timeout=20000,
         headers={'Authorization': "={{ 'Bearer ' + $('Permiso existente del canal').first().json.access_token }}"})
    n=f.nodes[-1]
    n['parameters'].update({'sendQuery':True,'specifyQuery':'json','jsonQuery':consulta})
    n['parameters']['options'].update({'redirect':{'redirect':{'followRedirects':False}},
        'response':{'response':{'fullResponse':True,'responseFormat':'json','neverError':True}},
        'batching':{'batch':{'batchSize':1,'batchInterval':200}}})
    n['onError']='continueRegularOutput'

lectura_competencia('Identidades de YouTube', 'channels', "={{ JSON.stringify({part:'snippet,contentDetails',id:$json.candidato,maxResults:1,fields:'items(id,snippet(title,customUrl,country),contentDetails/relatedPlaylists/uploads)'}) }}")
code(f, 'Listas de competidores', r"""
const candidatas=$('Candidatos del canal').first().json.candidatos, propia=$('Permiso existente del canal').first().json.canal_youtube_id;
const cuentas=$input.all().flatMap(i=>i.json.statusCode===200?(i.json.body?.items||[]):[])
 .filter(c=>candidatas.includes(c.id)&&c.id!==propia&&/^[\w-]{10,80}$/.test(c.contentDetails?.relatedPlaylists?.uploads||'')).slice(0,3);
return cuentas.length?cuentas.map(c=>({json:{cuenta:c.id,playlist:c.contentDetails.relatedPlaylists.uploads}})):[{json:{sin_listas:true}}];
""")
iff(f, '¿Hay listas de competidores?', '$json.sin_listas !== true')
lectura_competencia('Publicaciones de competidores', 'playlistItems', "={{ JSON.stringify({part:'contentDetails',playlistId:$json.playlist,maxResults:10,fields:'items(contentDetails/videoId)'}) }}")
code(f, 'IDs públicos observados', r"""
const ids=[...new Set($input.all().flatMap(i=>i.json.statusCode===200?(i.json.body?.items||[]):[])
 .map(v=>v.contentDetails?.videoId).filter(id=>/^[\w-]{11}$/.test(id||'')))].slice(0,30);
return [{json:{ids:ids.join(','),hay:ids.length>0}}];
""")
iff(f, '¿Hay publicaciones observadas?', '$json.hay === true')
lectura_competencia('Métricas públicas de YouTube', 'videos', "={{ JSON.stringify({part:'snippet,statistics,contentDetails,liveStreamingDetails',id:$json.ids,fields:'items(id,snippet(channelId,title,publishedAt,liveBroadcastContent),statistics(viewCount,likeCount,commentCount),contentDetails/duration,liveStreamingDetails/actualStartTime)'}) }}")
lectura_competencia('Homónimos de YouTube', 'search', "={{ JSON.stringify({part:'snippet',type:'channel',q:'\"'+$('Inicio').first().json.nombre+'\"',maxResults:5,fields:'items(id/channelId,snippet(channelTitle,title))'}) }}")
code(f, 'Competencia nativa comprobada', COMPETENCIA_JS + r"""
const salida=n=>$(n).isExecuted?$(n).all().map(i=>i.json):[];
const p=$('Inicio').first().json;let t;try{t=JSON.parse(p.tendencias||'{}');}catch{t={};}
const pedidos=salida('Listas de competidores');
const nativa=normalizarCompetenciaYouTube({candidatos:salida('Candidatos del canal')[0]?.candidatos,
 propia:salida('Permiso existente del canal')[0]?.canal_youtube_id,identidades:salida('Identidades de YouTube'),
 listas:salida('Publicaciones de competidores').map((respuesta,k)=>({...pedidos[k],respuesta})),
 videos:salida('Métricas públicas de YouTube')[0],busqueda:salida('Homónimos de YouTube')[0]},p.nombre);
const competencia=combinarCompetenciaYouTube(t.competencia,nativa,p.nombre);
return [{json:{canal_id:p.canal_id,nombre:p.nombre,ok:true,creditos:0,tendencias:JSON.stringify({...t,
 fecha:competencia.fecha,resumen:competencia.resumen,competencia,ideas:competenciaVigente(competencia)?(t.ideas||[]):[]})}}];
""")
f.chain('Inicio','Candidatos del canal','¿Hay candidatos YouTube?','Permiso existente del canal','¿Permiso YouTube disponible?',
        'Tres cuentas públicas','Identidades de YouTube','Listas de competidores','¿Hay listas de competidores?',
        'Publicaciones de competidores','IDs públicos observados','¿Hay publicaciones observadas?',
        'Métricas públicas de YouTube','Homónimos de YouTube','Competencia nativa comprobada')
f.link('¿Hay candidatos YouTube?','Competencia nativa comprobada',1)
f.link('¿Permiso YouTube disponible?','Competencia nativa comprobada',1)
f.link('¿Hay listas de competidores?','Homónimos de YouTube',1)
f.link('¿Hay publicaciones observadas?','Homónimos de YouTube',1)
COMPETENCIA_YOUTUBE=f.dump()
COMPETENCIA_YOUTUBE['settings'].update({'executionTimeout':240,'saveDataSuccessExecution':'none',
    'saveDataErrorExecution':'none','saveManualExecutions':False,'saveExecutionProgress':False})

f=reabrir(RADAR)
call(f,'Consultar YouTube por canal',W['competencia_yt'],each=True)
f.nodes[-1]['onError']='continueRegularOutput'
code(f,'Competencia con YouTube',r"""
const respuestas=$input.all();
return $('Competencia comprobada').all().map((p,k)=>respuestas[k]?.json?.canal_id===p.json.canal_id && respuestas[k].json.ok===true
 ? respuestas[k] : p);
""")
f.conn['Competencia comprobada']={'main':[[{'node':'Consultar YouTube por canal','type':'main','index':0}]]}
f.chain('Consultar YouTube por canal','Competencia con YouTube','Solo tendencias')
for nombre in ['Mensaje de radar','Resultado del radar público']:
    n=next(n for n in f.nodes if n['name']==nombre)
    n['parameters']['jsCode']=n['parameters']['jsCode'].replace("$('Competencia comprobada').all()", "($('Competencia con YouTube').isExecuted ? $('Competencia con YouTube').all() : $('Competencia comprobada').all())")
