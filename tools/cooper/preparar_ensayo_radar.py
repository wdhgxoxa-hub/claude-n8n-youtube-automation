#!/usr/bin/env python3
"""Prepara una llamada manual al radar real de un canal, sin ideas ni publicación.

Requiere FabRadar00000001 publicado con su horario deshabilitado. Su acción
antes_idea fuerza búsqueda sin API y omite avisos/noticias. No accede a la red.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re

from preparar_sonda_vidiq import nodo, SETTINGS, RAIZ

ID = 'CoopRadarReal001'


def preparar(canal, tabla):
    f = {'id': ID, 'name': 'Ensayo Cooper · radar público de un canal', 'active': False,
         'nodes': [], 'connections': {}, 'settings': copy.deepcopy(SETTINGS),
         'staticData': None, 'pinData': {}, 'tags': []}
    f['settings']['executionTimeout'] = 480
    f['nodes'] = [
        nodo('Inicio manual', 'manualTrigger', {}, 1),
        nodo('Canal autorizado', 'code', {'jsCode': 'return [{json:{accion:"antes_idea",canal_id:' + json.dumps(canal) + '}}];'}),
        nodo('Radar real sin publicaciones', 'executeWorkflow', {
            'workflowId': {'__rl': True, 'mode': 'id', 'value': 'FabRadar00000001'},
            'workflowInputs': {'mappingMode': 'defineBelow', 'value': {}, 'matchingColumns': [], 'schema': [],
                              'attemptToConvertTypes': False, 'convertFieldsToString': True},
            'mode': 'each', 'options': {'waitForSubWorkflow': True}}, 1.2),
        nodo('Diagnóstico mínimo', 'code', {'jsCode': r"""
const canal=CANAL;
const respuestas=$input.all().map(i=>i.json);
const filas=respuestas.filter(x=>x.canal_id===canal);
const estados=filas.map(x=>{let c;try{c=JSON.parse(x.tendencias || '{}').competencia;}catch{}
 return {estado:['listo','parcial','sin_datos'].includes(c?.estado)?c.estado:'sin_respuesta',
  fecha:typeof c?.fecha==='string'?c.fecha:null,
  competidores:Array.isArray(c?.competidores)?c.competidores.length:0,
  fuente:['web_publica','youtube_data_api','youtube_data_api_y_web'].includes(c?.fuente)?c.fuente:null,
  muestras:Array.isArray(c?.competidores)?c.competidores.reduce((s,p)=>s+(Array.isArray(p.muestras)?p.muestras.length:0),0):0,
  outliers:Array.isArray(c?.competidores)?c.competidores.reduce((s,p)=>s+(Array.isArray(p.outliers)?p.outliers.length:0),0):0,
  homonimos:Array.isArray(c?.homonimos)?c.homonimos.length:0};});
return [{json:{job_id:'radar-real-diag-'+String($execution.id),video_id:'',canal_id:canal,modo:'radar_diagnostico',
 estado:filas.length===1?'listo':'bloqueado',resultado:JSON.stringify({fecha:new Date().toISOString(),
  canal_id:canal,respuestas:respuestas.length,estados,accion:'antes_idea',sin_api:true,
  publicacion_invocada:false,credencial_exportada:false})}}];
""".replace('CANAL', json.dumps(canal))}),
    ]
    f['nodes'][2]['onError'] = 'continueRegularOutput'
    registrar = copy.deepcopy(next(n for n in json.loads((RAIZ / 'workflows/v2/FabLlamarClaude1.json').read_text())['nodes'] if n['name'] == 'Registrar trabajo'))
    registrar['name'] = 'Guardar diagnóstico del radar'
    registrar['parameters']['dataTableId']['value'] = tabla
    f['nodes'].append(registrar)
    for a, b in zip(f['nodes'], f['nodes'][1:]):
        f['connections'][a['name']] = {'main': [[{'node': b['name'], 'type': 'main', 'index': 0}]]}
    return f


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--salida', type=Path, required=True)
    p.add_argument('--tabla-trabajos', required=True)
    p.add_argument('--canal-id', required=True)
    a = p.parse_args()
    if not all(re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', v) for v in [a.tabla_trabajos, a.canal_id]):
        p.error('ID inválido')
    a.salida.mkdir(parents=True, exist_ok=True, mode=0o700)
    contenido = json.dumps(preparar(a.canal_id, a.tabla_trabajos), ensure_ascii=False, indent=2) + '\n'
    (a.salida / (ID + '.json')).write_text(contenido)
    print(json.dumps({'preparado': True, 'id': ID, 'sha256': hashlib.sha256(contenido.encode()).hexdigest(), 'red': False}))


if __name__ == '__main__':
    main()
