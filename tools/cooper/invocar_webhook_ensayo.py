"""Invoca una sonda revisada por loopback después de comprobar su bloqueo público.

Se ejecuta en el host VPS. Solo consulta metadata de ejecución, nunca runData,
credenciales, entorno ni cuerpos HTTP. El prefijo debe estar bloqueado por Caddy.
"""
from contextlib import closing
import argparse
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import time
import urllib.error
import urllib.request

from preparar_webhook_ensayo import IDS

DB = 'file:/var/lib/cooper/n8n/database.sqlite?mode=ro'
TERMINALES = {'success', 'error', 'canceled', 'crashed'}


def entrada(workflow):
    wid = workflow.get('id')
    if wid not in IDS:
        raise ValueError('ID fuera de sondas autorizadas')
    webhooks = [n for n in workflow['nodes'] if n['type'] == 'n8n-nodes-base.webhook']
    if len(webhooks) != 1:
        raise ValueError('Se requiere una entrada temporal única')
    parameters = webhooks[0]['parameters']
    path = parameters.get('path', '')
    if (not re.fullmatch(r'cooper/v1/ensayo-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', path)
            or parameters.get('httpMethod') != 'POST'
            or parameters.get('responseMode') != 'onReceived'):
        raise ValueError('Entrada fuera del contrato interno')
    return wid, path


def metadata(wid):
    with closing(sqlite3.connect(DB, uri=True)) as connection:
        return connection.execute(
            'SELECT id,status FROM execution_entity WHERE workflowId=? ORDER BY id',
            [wid],
        ).fetchall()


def publico(path):
    request = urllib.request.Request(
        'https://flujos.cooperestudio.com/webhook/' + path,
        data=b'{}', headers={'Content-Type': 'application/json'}, method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def interno(path):
    js = ('fetch(' + json.dumps('http://127.0.0.1:5678/webhook/' + path)
          + ',{method:"POST",headers:{"content-type":"application/json"},body:"{}",'
          + 'signal:AbortSignal.timeout(10000)}).then(r=>console.log(r.status))'
          + '.catch(()=>process.exit(1));')
    response = subprocess.run(
        ['docker', 'exec', 'cooper-n8n-1', 'node', '-e', js],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15, check=True,
    )
    return int(response.stdout)


def invocar(workflow):
    wid, path = entrada(workflow)
    previous = metadata(wid)
    public_status = publico(path)
    if public_status != 404 or metadata(wid) != previous:
        raise ValueError('Bloqueo público no comprobado; no se invocó por loopback')
    internal_status = interno(path)
    if internal_status != 200:
        raise ValueError('La entrada interna no respondió 200')
    previous_ids = {item[0] for item in previous}
    executions = []
    # Radar encadena investigación web (180 s) y lecturas nativas (hasta 240 s).
    for _ in range(96 if wid == 'CoopRadarReal001' else 36):
        executions = [{'id': eid, 'estado': status} for eid, status in metadata(wid)
                      if eid not in previous_ids]
        if executions and all(e['estado'] in TERMINALES for e in executions):
            break
        time.sleep(5)
    return {'workflow': wid, 'publico_http': public_status, 'publico_sin_ejecucion': True,
            'interno_http': internal_status, 'ejecuciones': executions,
            'ok': len(executions) == 1 and executions[0]['estado'] == 'success'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workflow', type=Path)
    args = parser.parse_args()
    try:
        result = invocar(json.loads(args.workflow.read_text()))
    except ValueError as error:
        # Los ValueError anteriores solo contienen mensajes estáticos del contrato.
        result = {'ok': False, 'error': str(error) if not isinstance(error, json.JSONDecodeError)
                  else 'JSON de la sonda inválido'}
    except Exception:
        result = {'ok': False, 'error': 'No se pudo completar la invocación interna'}
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
