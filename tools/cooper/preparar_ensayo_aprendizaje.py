#!/usr/bin/env python3
"""Prepara flujos manuales acotados; no conecta n8n ni lee credenciales/entorno.

Captura: --salida DIR --video-id ID [--video-id ID]
Lección revisada: --salida DIR --job-id ID --lecciones propuesta.json
Las referencias de tablas/credenciales proceden de los JSON públicos del repositorio.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import uuid

RAIZ = Path(__file__).resolve().parents[2]
CAPTURA = 'CoopEnsayoApr01'
TOKEN = 'CoopEnsayoTok01'
LECCION = 'CoopEnsayoLec01'
SETTINGS = {'executionOrder': 'v1', 'timezone': 'America/Lima',
            'callerPolicy': 'workflowsFromSameOwner', 'executionTimeout': 1800,
            'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none',
            'saveManualExecutions': False, 'saveExecutionProgress': False}


def leer(wid):
    return json.loads((RAIZ / 'workflows/v2' / f'{wid}.json').read_text())


def nodo(f, nombre):
    return next(n for n in f['nodes'] if n['name'] == nombre)


def crear_nodo(nombre, tipo, parametros, version=2):
    return {'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'ensayo-aprendizaje/' + nombre)),
            'name': nombre, 'type': 'n8n-nodes-base.' + tipo,
            'typeVersion': version, 'parameters': parametros, 'position': [0, 0]}


def enlace(f, origen, destino, salida=0):
    rutas = f['connections'].setdefault(origen, {'main': []})['main']
    while len(rutas) <= salida:
        rutas.append([])
    rutas[salida].append({'node': destino, 'type': 'main', 'index': 0})


def base(wid, nombre, nodos):
    return {'id': wid, 'name': nombre, 'active': False, 'nodes': nodos,
            'connections': {}, 'settings': copy.deepcopy(SETTINGS),
            'staticData': None, 'pinData': {}, 'tags': []}


def preparar_captura(ids):
    origen = leer('FabAprendizaje01')
    f = base(CAPTURA, 'Ensayo Cooper · solo métricas de publicaciones existentes', origen['nodes'])
    f['connections'] = origen['connections']
    # El ensayo de captura termina antes del plan: la aceptación del modelo se hace aparte.
    retirar = {'Guardar trabajo de aprendizaje','Pedido al plan de aprendizaje',
               'Analizar con el plan de la PC','Validar aprendizaje del plan','Guardar lecciones del plan'}
    f['nodes'] = [n for n in f['nodes'] if n['name'] not in retirar]
    f['connections'] = {n: r for n, r in f['connections'].items() if n not in retirar}
    for rutas in f['connections'].values():
        for salida in rutas.get('main', []):
            salida[:] = [e for e in salida if e['node'] not in retirar]
    reloj = nodo(f, 'Cada día')
    reloj.update({'type': 'n8n-nodes-base.manualTrigger', 'typeVersion': 1, 'parameters': {}})
    ajustes = nodo(f, 'Leer ajustes')
    ajustes.update({'type': 'n8n-nodes-base.code', 'typeVersion': 2,
                    'parameters': {'jsCode': 'return [{json:{allowAnalytics:true}}];'}})
    for nombre in ['Toca medir', 'Toca medir en redes']:
        n = nodo(f, nombre)
        original = '$input.all().map(i=>i.json)'
        assert original in n['parameters']['jsCode']
        n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(
            original, original + '.filter(p=>' + json.dumps(ids) + '.includes(p.video_id))')
    nodo(f, 'Tokens de los canales')['parameters']['workflowId']['value'] = TOKEN
    # Conserva evidencia en un trabajo bloqueado: nadie lo envía a un proveedor automáticamente.
    pedido = nodo(f, 'Preparar trabajo de aprendizaje')
    pedido.update({'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'parameters': {'jsCode': """
return $input.all().map((i,k)=>({json:{job_id:'aprender-ensayo-'+String($execution.id)+'-'+k,
 canal_id:i.json.canal_id,video_id:'',modo:'aprender',estado:'bloqueado',
 resultado:JSON.stringify({_aprendizaje:{evidencias:i.json.datos.evidencias},
  _ensayo:{pendiente:'Analizar la evidencia observada; no se llamó ningún proveedor de IA'}})}}));
"""}})
    registrar = copy.deepcopy(nodo(leer('FabLlamarClaude1'), 'Registrar trabajo'))
    registrar['name'] = 'Guardar evidencia del ensayo'
    f['nodes'].append(registrar)
    enlace(f, pedido['name'], registrar['name'])
    # Rama de renovación solamente: no existe callback OAuth, enlace, subida ni Telegram.
    yt = leer('FabYouTube000001')
    nombres = ['Inicio', 'Conexión', '¿Conectado?', 'Renovar token', 'Token', 'Sin conexión']
    t = base(TOKEN, 'Ensayo Cooper · permiso existente solo para lectura',
             [copy.deepcopy(nodo(yt, n)) for n in nombres])
    enlace(t, 'Inicio', 'Conexión')
    enlace(t, 'Conexión', '¿Conectado?')
    enlace(t, '¿Conectado?', 'Renovar token')
    enlace(t, '¿Conectado?', 'Sin conexión', 1)
    enlace(t, 'Renovar token', 'Token')
    # No incluir descripciones de error del proveedor: la salida es mínima y permanece interna.
    nodo(t, 'Token')['parameters']['jsCode'] = """
const c=$('Conexión').first().json;
return [{json:$json.access_token?{ok:true,access_token:$json.access_token,canal_id:c.canal_id}:{ok:false,canal_id:c.canal_id}}];
"""
    return [t, f]


def preparar_leccion(job_id, propuesta):
    if not isinstance(propuesta, dict) or not isinstance(propuesta.get('lecciones'), list):
        raise ValueError('La propuesta requiere lecciones con regla, causa, correccion y origenes')
    f = base(LECCION, 'Ensayo Cooper · guardar lección revisada con evidencia', [
        crear_nodo('Inicio', 'manualTrigger', {}, 1)])
    buscar = copy.deepcopy(nodo(leer('FabAprendizaje01'), 'Trabajos para aprender'))
    buscar['name'] = 'Trabajo observado'
    buscar['parameters']['filters'] = {'conditions': [
        {'keyName': 'job_id', 'condition': 'eq', 'keyValue': job_id}]}
    f['nodes'].append(buscar)
    validar = (RAIZ / 'tools/cooper/aprendizaje.js').read_text() + '\n' + """
const trabajos=$input.all().map(i=>i.json);
if(trabajos.length!==1) throw new Error('Se necesita un único trabajo observado');
const t=trabajos[0], previo=parseAprendizaje(t.resultado);
if(t.job_id!==JOB_ID || t.modo!=='aprender' || t.estado!=='bloqueado' || !previo._ensayo || !previo._aprendizaje?.evidencias?.length)
 throw new Error('El trabajo no es un ensayo observado pendiente');
if(previo._aprendizaje.evidencias.some(e=>e.canal_id!==t.canal_id)) throw new Error('Evidencia de otro canal');
const propuesta=PROPUESTA;
const resultado=validarAprendizaje(propuesta,previo._aprendizaje,t.job_id);
if(!resultado.lecciones.length || resultado.lecciones.length!==propuesta.lecciones.length)
 throw new Error('Todas las lecciones requieren origen observado, causa y corrección');
return [{json:{estado:'listo',resultado:JSON.stringify({...previo,resultado,
 _ensayo:{revisado:true,fecha:new Date().toISOString(),fuente:'Revisión del operador sin llamada automática de IA'}})}}];
""".replace('JOB_ID', json.dumps(job_id)).replace('PROPUESTA', json.dumps(propuesta, ensure_ascii=False))
    f['nodes'].append(crear_nodo('Validar evidencia', 'code', {'jsCode': validar}))
    guardar = copy.deepcopy(nodo(leer('FabAprendizaje01'), 'Cooper · guardar métricas YouTube'))
    guardar['name'] = 'Guardar lección revisada'
    guardar['parameters']['dataTableId'] = buscar['parameters']['dataTableId']
    guardar['parameters']['filters'] = {'conditions': [
        {'keyName': 'job_id', 'condition': 'eq', 'keyValue': job_id},
        {'keyName': 'estado', 'condition': 'eq', 'keyValue': 'bloqueado'}]}
    f['nodes'].append(guardar)
    for a, b in [('Inicio', 'Trabajo observado'), ('Trabajo observado', 'Validar evidencia'),
                 ('Validar evidencia', 'Guardar lección revisada')]:
        enlace(f, a, b)
    return [f]


def validar_limites(f):
    tipos = {'manualTrigger', 'executeWorkflowTrigger', 'dataTable', 'code', 'if', 'executeWorkflow', 'httpRequest'}
    for n in f['nodes']:
        tipo = n['type'].removeprefix('n8n-nodes-base.')
        if tipo not in tipos:
            raise ValueError('Tipo fuera del ensayo: ' + tipo)
        p = n['parameters']
        if tipo == 'executeWorkflow' and p['workflowId']['value'] != TOKEN:
            raise ValueError('Solo se permite la renovación aislada del permiso')
        if tipo == 'httpRequest':
            seguro = (p.get('method', 'GET') == 'GET' and p['url'] in [
                'https://youtubeanalytics.googleapis.com/v2/reports',
                "={{ 'https://api.upload-post.com/api/uploadposts/post-analytics/' + encodeURIComponent($json.request_id) }}"])
            seguro |= p.get('method') == 'POST' and p['url'] == 'https://oauth2.googleapis.com/token'
            if not seguro:
                raise ValueError('Petición fuera de analytics/renovación')
        if tipo == 'dataTable' and p.get('operation') not in ['get', 'insert', 'update']:
            raise ValueError('Operación de datos fuera del ensayo')
    if f['active'] or f['settings'] != SETTINGS:
        raise ValueError('El ensayo debe estar inactivo y no conservar ejecuciones')


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--salida', required=True, type=Path)
    a.add_argument('--video-id', action='append', default=[])
    a.add_argument('--job-id')
    a.add_argument('--lecciones', type=Path)
    args = a.parse_args()
    patron = r'[a-zA-Z0-9_-]{1,100}'
    if args.job_id and args.lecciones and not args.video_id:
        if not re.fullmatch(patron, args.job_id):
            a.error('ID del trabajo inválido')
        if args.lecciones.stat().st_size > 50000:
            a.error('Propuesta demasiado grande')
        flujos = preparar_leccion(args.job_id, json.loads(args.lecciones.read_text()))
    elif 1 <= len(args.video_id) <= 10 and not args.job_id and not args.lecciones:
        if any(not re.fullmatch(patron, v) for v in args.video_id):
            a.error('ID del video inválido')
        flujos = preparar_captura(list(dict.fromkeys(args.video_id)))
    else:
        a.error('Elegir 1–10 videos existentes o job-id con propuesta de lecciones')
    args.salida.mkdir(parents=True, exist_ok=True, mode=0o700)
    archivos = []
    for f in flujos:
        validar_limites(f)
        destino = args.salida / (f['id'] + '.json')
        contenido = json.dumps(f, ensure_ascii=False, indent=2) + '\n'
        destino.write_text(contenido)
        archivos.append({'archivo': destino.name, 'id': f['id'],
                         'sha256': hashlib.sha256(contenido.encode()).hexdigest(), 'nodos': len(f['nodes'])})
    (args.salida / 'manifest.json').write_text(json.dumps({
        'tipo': 'ensayo-manual-aprendizaje', 'videos': args.video_id, 'archivos': archivos,
        'originales_modificados': False, 'publica': False, 'llama_ia': False,
        'nota': 'Remapear IDs públicos con el lote. Respaldar métricas/trabajos y no imprimir salida cruda de n8n execute.'},
        ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'preparado': True, 'flujos': len(flujos), 'red': False}))


if __name__ == '__main__':
    main()
