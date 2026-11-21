#!/usr/bin/env python3
"""Ejecuta la confirmación con respuesta ficticia en n8n aislado, sin red ni publicación."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import sys
from contextlib import closing

import operar


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base', 'workflow', 'salida'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--anterior', action='store_true')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('ensayar_n8n', Path(__file__).with_name('ensayar-n8n.py'))
    engine = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(engine)
    if args.anterior:
        engine.IMAGE = json.loads(Path(__file__).with_name('infra-imagenes.json').read_text())['servicios']['n8n']['anterior']
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    data = args.salida.resolve() / 'datos'
    data.mkdir(mode=0o700)
    with closing(sqlite3.connect(args.base.resolve().as_uri() + '?mode=ro', uri=True)) as source:
        with closing(sqlite3.connect(data / 'database.sqlite')) as destination:
            source.backup(destination)
    original = engine.inventory(data / 'database.sqlite')
    flow = json.loads(args.workflow.read_text())
    code = {n['name']: n['parameters']['jsCode'] for n in flow['nodes'] if n['type'] == 'n8n-nodes-base.code'}
    nodes, connections = [], {}
    def node(name, text):
        nodes.append({'id': name, 'name': name, 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
                      'position': [len(nodes)*200, 0], 'parameters': {'jsCode': text}})
    nodes.append({'id': 'inicio', 'name': 'Inicio', 'type': 'n8n-nodes-base.manualTrigger', 'typeVersion': 1, 'position': [0,0], 'parameters': {}})
    node('Por confirmar', "return [{json:{request_id:'solicitud-ficticia',video_id:'video-ficticio',plataformas:'youtube,tiktok',tipo:'video'}}];")
    node('Publicaciones recientes', "return $('Por confirmar').all();")
    node('Respuesta ficticia', "return [{json:{status:'completed',results:[{platform:'youtube',success:false,error_message:'401 CREDENCIAL_FICTICIA_NO_PROPAGAR',url:'https://api.upload-post.com/status?token=CREDENCIAL_FICTICIA_NO_PROPAGAR'},{platform:'tiktok',success:true,post_url:'https://www.tiktok.com/@canal/video/1234567890123?token=CREDENCIAL_FICTICIA_NO_PROPAGAR'}]}}];")
    node('Leer resultados', code['Leer resultados'])
    node('Aviso corto', code['Aviso corto'])
    node('Verificar privacidad', "const dato=$('Leer resultados').first().json, aviso=$input.first().json.texto; if(JSON.stringify({dato,aviso}).includes('CREDENCIAL_FICTICIA_NO_PROPAGAR') || aviso.includes('http') || dato.estado!=='error' || JSON.parse(dato.resultado).publicaciones[1].url!=='https://www.tiktok.com/@canal/video/1234567890123') throw new Error('La confirmación no superó la privacidad'); return [{json:{confirmacion_sintetica:'PASS',sin_secretos:true,sin_publicacion:true}}];")
    for first, second in zip(nodes, nodes[1:]):
        connections[first['name']] = {'main': [[{'node': second['name'], 'type': 'main', 'index': 0}]]}
    fixture = {'id': 'CoopConfirmarPrueba01', 'name': 'Ensayo privado de confirmación', 'active': False,
               'nodes': nodes, 'connections': connections, 'settings': {'executionOrder': 'v1',
                   'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none',
                   'saveManualExecutions': False, 'saveExecutionProgress': False}}
    entry = args.salida.resolve() / 'entrada.json'
    manifest = args.salida.resolve() / 'columnas.json'
    operar.write_json(entry, [fixture])
    operar.write_json(manifest, {'tablas': {}})
    def cli(*command):
        wrapper = "require('node:child_process').execFileSync('n8n',process.argv.slice(1),{stdio:'inherit',env:{...process.env,N8N_LOG_LEVEL:'info'}})"
        return engine.run_container(data, entry, manifest, Path(__file__).with_name('n8n-columnas.cjs').resolve(), 'node', ['-e', wrapper, *command])
    cli('import:workflow', '--input=/entrada/workflows.json')
    result = cli('execute', '--id=CoopConfirmarPrueba01', '--rawOutput')
    operar.require('"confirmacion_sintetica": "PASS"' in result or '"confirmacion_sintetica":"PASS"' in result,
                    'Falta resultado de confirmación sintética')
    after = engine.inventory(data / 'database.sqlite', original['columnas'])
    operar.require(original['datos'] == after['datos'], 'Cambió una tabla de negocio')
    operar.require(all(after['flujos'][wid] == state for wid, state in original['flujos'].items()), 'Cambió un workflow original')
    receipt = {'estado': 'PASS', 'imagen': engine.IMAGE, 'red': 'none', 'puertos': [],
               'credenciales': 'ficticias', 'publicaciones_reales': 0, 'confirmacion_sintetica': 'PASS',
               'mensaje_privado_descartado': 'PASS', 'query_sensible_eliminada': 'PASS',
               'tablas_negocio_preservadas': len(original['datos']), 'flujos_originales_preservados': len(original['flujos']),
               'workflow_fuente_sha256': operar.digest(args.workflow)}
    operar.write_json(args.salida / 'resultado.json', receipt)
    print(json.dumps(receipt))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Ensayo sintético detenido; salida privada omitida. Producción intacta.', file=sys.stderr)
        sys.exit(1)
