#!/usr/bin/env python3
"""Sonda de lectura pública YouTube: tres perfiles, cuatro videos por perfil y homónimos.

Reutiliza exclusivamente CoopEnsayoTok01 (renovación aislada del permiso existente).
No hace login, publica ni descifra/exporta credenciales. La salida es un trabajo diagnóstico.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re

from preparar_sonda_vidiq import nodo, SETTINGS, RAIZ

ID = 'CoopSondaYtComp1'
TOKEN = 'CoopEnsayoTok01'


def preparar(canal, candidatos, nombre, tabla):
    f = {'id': ID, 'name': 'Sonda Cooper · competencia pública de YouTube', 'active': False,
         'nodes': [], 'connections': {}, 'settings': copy.deepcopy(SETTINGS),
         'staticData': None, 'pinData': {}, 'tags': []}

    def agregar(nombre, tipo, p, version=2):
        n = nodo(nombre, tipo, p, version)
        f['nodes'].append(n)
        return n

    def unir(a, b, salida=0):
        rutas = f['connections'].setdefault(a, {'main': []})['main']
        while len(rutas) <= salida:
            rutas.append([])
        rutas[salida].append({'node': b, 'type': 'main', 'index': 0})

    def http(nombre, recurso, consulta):
        n = agregar(nombre, 'httpRequest', {'method': 'GET',
            'url': 'https://www.googleapis.com/youtube/v3/' + recurso,
            'sendHeaders': True, 'headerParameters': {'parameters': [
                {'name': 'Authorization', 'value': "={{ 'Bearer ' + $('Permiso existente').first().json.access_token }}"}]},
            'sendQuery': True, 'specifyQuery': 'json', 'jsonQuery': consulta,
            'options': {'timeout': 20000, 'redirect': {'redirect': {'followRedirects': False}},
                        'response': {'response': {'fullResponse': True, 'responseFormat': 'json', 'neverError': True}},
                        'batching': {'batch': {'batchSize': 1, 'batchInterval': 200}}}}, 4.2)
        n['onError'] = 'continueRegularOutput'

    agregar('Inicio', 'manualTrigger', {}, 1)
    agregar('Canal propio', 'code', {'jsCode': 'return [{json:{canal_id:' + json.dumps(canal) + '}}];'})
    agregar('Permiso existente', 'executeWorkflow', {'workflowId': {'__rl': True, 'mode': 'id', 'value': TOKEN},
        'workflowInputs': {'mappingMode': 'defineBelow', 'value': {}, 'matchingColumns': [], 'schema': [],
                           'attemptToConvertTypes': False, 'convertFieldsToString': True},
        'mode': 'each', 'options': {'waitForSubWorkflow': True}}, 1.2)

    def puerta(nombre, expresion):
        agregar(nombre, 'if', {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'loose', 'version': 2},
            'conditions': [{'leftValue': '={{ ' + expresion + ' }}', 'rightValue': '',
                            'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
            'combinator': 'and'}, 'options': {}}, 2.2)

    puerta('¿Permiso disponible?', '$json.ok === true && !!$json.access_token')
    agregar('Candidatos públicos', 'code', {'jsCode': 'return ' + json.dumps(candidatos) + '.map(candidato=>({json:{candidato}}));'})
    http('Identidad pública', 'channels', "={{ JSON.stringify({part:'snippet,contentDetails',...($json.candidato.startsWith('@')?{forHandle:$json.candidato}:{id:$json.candidato}),maxResults:1,fields:'items(id,snippet(title,customUrl,country),contentDetails/relatedPlaylists/uploads)'}) }}")
    agregar('Listas públicas', 'code', {'jsCode': r"""
const cuentas=$input.all().flatMap(i=>i.json.statusCode===200?(i.json.body?.items || []):[])
 .filter(c=>/^UC[\w-]{22}$/.test(c.id)&&/^[\w-]{10,80}$/.test(c.contentDetails?.relatedPlaylists?.uploads || '')).slice(0,3);
return cuentas.length?cuentas.map(c=>({json:{channel_id:c.id,playlist_id:c.contentDetails.relatedPlaylists.uploads}})):[{json:{sin_listas:true}}];
"""})
    puerta('¿Hay listas públicas?', '$json.sin_listas !== true')
    http('Cuatro publicaciones', 'playlistItems', "={{ JSON.stringify({part:'contentDetails',playlistId:$json.playlist_id,maxResults:4,fields:'items(contentDetails/videoId)'}) }}")
    agregar('Videos observados', 'code', {'jsCode': r"""
const ids=[...new Set($input.all().flatMap(i=>i.json.statusCode===200?(i.json.body?.items || []):[])
 .map(v=>v.contentDetails?.videoId).filter(id=>/^[\w-]{11}$/.test(id || '')))].slice(0,12);
return [{json:{ids:ids.join(','),hay:ids.length>0}}];
"""})
    puerta('¿Hay videos públicos?', '$json.hay === true')
    http('Métricas públicas', 'videos', "={{ JSON.stringify({part:'snippet,statistics,contentDetails',id:$json.ids,fields:'items(id,snippet(channelId,title,publishedAt,liveBroadcastContent),statistics(viewCount,likeCount,commentCount),contentDetails/duration)'}) }}")
    http('Buscar nombre exacto', 'search', json.dumps({'part': 'snippet', 'type': 'channel', 'q': '"' + nombre + '"',
        'maxResults': 5, 'fields': 'items(id/channelId,snippet(channelTitle,title))'}))
    agregar('Diagnóstico público', 'code', {'jsCode': r"""
const salida=n=>$(n).isExecuted?$(n).all().map(i=>i.json):[];
const numero=v=>typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;
const texto=v=>typeof v==='string'?v.slice(0,180):'';
const errores=['quotaExceeded','dailyLimitExceeded','accessNotConfigured','insufficientPermissions','forbidden','authError','keyInvalid','channelNotFound','playlistNotFound','videoNotFound'];
const estado=n=>salida(n).map(r=>({http:Number(r.statusCode || 0),error:!!r.error||!!r.body?.error,
 razones:(r.body?.error?.errors || []).map(e=>errores.includes(e.reason)?e.reason:'otra').slice(0,5)}));
const cuentas=salida('Identidad pública').flatMap(r=>r.statusCode===200?(r.body?.items || []):[])
 .filter(c=>/^UC[\w-]{22}$/.test(c.id)).slice(0,3);
const pedidos=salida('Videos observados')[0]?.ids?.split(',') || [];
const videos=salida('Métricas públicas').flatMap(r=>r.statusCode===200?(r.body?.items || []):[])
 .filter(v=>pedidos.includes(v.id)&&cuentas.some(c=>c.id===v.snippet?.channelId));
const competidores=cuentas.map(c=>({id:c.id,nombre:texto(c.snippet?.title),url:'https://www.youtube.com/channel/'+c.id,
 pais:/^[A-Z]{2}$/.test(c.snippet?.country || '')?c.snippet.country:null,
 publicaciones:videos.filter(v=>v.snippet.channelId===c.id).slice(0,4).map(v=>({id:v.id,url:'https://www.youtube.com/watch?v='+v.id,
  titulo:texto(v.snippet.title),fecha:texto(v.snippet.publishedAt),vistas:numero(v.statistics?.viewCount),
  likes:numero(v.statistics?.likeCount),comentarios:numero(v.statistics?.commentCount),
  duracion:texto(v.contentDetails?.duration),formato:'sin_clasificar'}))}));
const busqueda=salida('Buscar nombre exacto').flatMap(r=>r.statusCode===200?(r.body?.items || []):[])
 .filter(c=>/^UC[\w-]{22}$/.test(c.id?.channelId)).slice(0,5)
 .map(c=>({id:c.id.channelId,nombre:texto(c.snippet?.channelTitle || c.snippet?.title),url:'https://www.youtube.com/channel/'+c.id.channelId}));
const diagnostico={fecha:new Date().toISOString(),fuente:'youtube_data_api',permiso_disponible:salida('Permiso existente')[0]?.ok===true,
 peticiones:Object.fromEntries(['Identidad pública','Cuatro publicaciones','Métricas públicas','Buscar nombre exacto'].map(n=>[n,estado(n)])),
 competidores,candidatos_homonimos:busqueda,cuota_acotada:{channels:3,playlistItems:3,videos:1,search:1},
 limitaciones:['La duración por sí sola no identifica un Short: no se clasificaron formatos ni calcularon outliers.',
 'Los resultados del nombre son candidatos; requieren diferenciar el canal propio y completar TikTok.'],
 publicacion_invocada:false,credencial_exportada:false};
return [{json:{job_id:'youtube-competencia-diag-'+String($execution.id),video_id:'',canal_id:CANAL,
 modo:'youtube_competencia_diagnostico',estado:competidores.length===3?'listo':'bloqueado',resultado:JSON.stringify(diagnostico)}}];
""".replace('CANAL', json.dumps(canal))})
    guardar = copy.deepcopy(next(n for n in json.loads((RAIZ / 'workflows/v2/FabLlamarClaude1.json').read_text())['nodes'] if n['name'] == 'Registrar trabajo'))
    guardar['name'] = 'Guardar diagnóstico público'
    guardar['parameters']['dataTableId']['value'] = tabla
    f['nodes'].append(guardar)
    for a,b in [('Inicio','Canal propio'),('Canal propio','Permiso existente'),('Permiso existente','¿Permiso disponible?'),
                ('¿Permiso disponible?','Candidatos públicos'),('Candidatos públicos','Identidad pública'),('Identidad pública','Listas públicas'),
                ('Listas públicas','¿Hay listas públicas?'),('¿Hay listas públicas?','Cuatro publicaciones'),
                ('Cuatro publicaciones','Videos observados'),('Videos observados','¿Hay videos públicos?'),
                ('¿Hay videos públicos?','Métricas públicas'),('Métricas públicas','Buscar nombre exacto'),
                ('Buscar nombre exacto','Diagnóstico público'),('Diagnóstico público','Guardar diagnóstico público')]:
        unir(a,b)
    unir('¿Permiso disponible?','Diagnóstico público',1)
    unir('¿Hay listas públicas?','Buscar nombre exacto',1)
    unir('¿Hay videos públicos?','Buscar nombre exacto',1)
    return f


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--salida',type=Path,required=True)
    p.add_argument('--tabla-trabajos',required=True)
    p.add_argument('--canal-id',required=True)
    p.add_argument('--nombre',required=True)
    p.add_argument('--competidor',action='append',required=True)
    a=p.parse_args()
    if not all(re.fullmatch(r'[a-zA-Z0-9_-]{1,100}',v) for v in [a.tabla_trabajos,a.canal_id]):
        p.error('ID inválido')
    if len(set(a.competidor))!=3 or not all(re.fullmatch(r'UC[\w-]{22}|@[\w.-]{3,100}',v) for v in a.competidor):
        p.error('Se requieren tres candidatos distintos con ID o handle público')
    if not 1<=len(a.nombre)<=100:
        p.error('Nombre inválido')
    f=preparar(a.canal_id,a.competidor,a.nombre,a.tabla_trabajos)
    a.salida.mkdir(parents=True,exist_ok=True,mode=0o700)
    contenido=json.dumps(f,ensure_ascii=False,indent=2)+'\n'
    (a.salida/(ID+'.json')).write_text(contenido)
    print(json.dumps({'preparado':True,'id':ID,'nodos':len(f['nodes']),
                      'sha256':hashlib.sha256(contenido.encode()).hexdigest(),'red':False}))


if __name__=='__main__':
    main()
