#!/usr/bin/env python3
"""Actualiza únicamente el código Resolver de la API existente; conserva el resto opacamente."""
import argparse
import copy
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

import operar

CANONICAL = 'FabCooperAPI0001'
NAME = 'FX · API de Cooper'
FIELDS = ('name', 'nodes', 'connections', 'settings', 'staticData', 'pinData')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def state(flow):
    return {field: flow.get(field) for field in FIELDS}


def resolver(flow):
    nodes = [n for n in flow['nodes'] if n.get('name') == 'Resolver' and n.get('type') == 'n8n-nodes-base.code']
    operar.require(len(nodes) == 1 and isinstance(nodes[0].get('parameters', {}).get('jsCode'), str), 'Falta el único nodo Resolver')
    return nodes[0]


def code_hash(flow):
    return hashlib.sha256(resolver(flow)['parameters']['jsCode'].encode()).hexdigest()


def masked_hash(flow):
    result = copy.deepcopy(flow)
    resolver(result)['parameters']['jsCode'] = '<RESOLVER>'
    return digest(state(result))


def preparar(actuales, fuente):
    selected = [w for w in actuales if w.get('name') == NAME]
    operar.require(len(selected) == 1 and selected[0].get('active') is True, 'API real debe existir una sola vez y estar publicada')
    operar.require(fuente.get('id') == CANONICAL and fuente.get('name') == NAME, 'Fuente canónica de API incorrecta')
    original = selected[0]
    result = copy.deepcopy(original)
    resolver(result)['parameters']['jsCode'] = resolver(fuente)['parameters']['jsCode']
    result['active'] = False
    wid = original['id']
    diff = {'modalidad': 'resolver_api', 'api_id': wid, 'republicar_originales': [wid], 'plan_publicacion': [wid],
            'credenciales_faltantes': [], 'resolver_antes_sha256': code_hash(original),
            'resolver_despues_sha256': code_hash(result), 'resto_estado_sha256': masked_hash(original),
            'estado_antes_sha256': digest(state(original)), 'estado_despues_sha256': digest(state(result))}
    validar_contrato([result], diff)
    return [result], diff


def validar_contrato(workflows, diff):
    wid = diff.get('api_id')
    operar.require(isinstance(wid, str) and re.fullmatch(r'[A-Za-z0-9_-]+', wid), 'ID de API inválido')
    operar.require(len(workflows) == 1 and workflows[0].get('id') == wid and workflows[0].get('name') == NAME,
                    'El delta admite únicamente la API existente')
    flow = workflows[0]
    operar.require(masked_hash(flow) == diff.get('resto_estado_sha256'), 'Cambió otro nodo, parámetro o ajuste')
    operar.require(code_hash(flow) == diff.get('resolver_despues_sha256')
                    and digest(state(flow)) == diff.get('estado_despues_sha256'), 'Código Resolver distinto del certificado')
    operar.require(all(isinstance(diff.get(k), str) and re.fullmatch('[a-f0-9]{64}', diff[k])
                       for k in ('resolver_antes_sha256', 'estado_antes_sha256')), 'Faltan hashes del estado previo')
    operar.require(diff.get('republicar_originales') == diff.get('plan_publicacion') == [wid]
                    and not diff.get('credenciales_faltantes'), 'Publicación ajena al Resolver')
    return {wid}


def validar_actual(path, diff, despues=False):
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        rows = db.execute('SELECT name,nodes,connections,settings,staticData,pinData FROM workflow_entity WHERE id=?', (diff['api_id'],)).fetchall()
    operar.require(len(rows) == 1, 'API real ausente')
    values = dict(zip(FIELDS, rows[0]))
    for key in FIELDS[1:]:
        values[key] = json.loads(values[key]) if values[key] is not None else None
    key = 'estado_despues_sha256' if despues else 'estado_antes_sha256'
    operar.require(digest(values) == diff[key], 'API cambió desde la copia; preparar de nuevo')
    operar.require(masked_hash(values) == diff['resto_estado_sha256'], 'Cambió contenido ajeno al Resolver')
    code_key = 'resolver_despues_sha256' if despues else 'resolver_antes_sha256'
    operar.require(code_hash(values) == diff[code_key], 'Hash del Resolver distinto del certificado')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', required=True, type=Path)
    parser.add_argument('--salida', required=True, type=Path)
    parser.add_argument('--fuente', required=True, type=Path)
    args = parser.parse_args()
    workflows, diff = preparar(json.loads(args.export.read_text()), json.loads(args.fuente.read_text()))
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, value in [('entrada.json', workflows), ('diff.json', diff), ('publicar.json', diff['plan_publicacion'])]:
        operar.write_json(args.salida / name, value)
    print(json.dumps({'preparados': 1, 'resolver_antes_sha256': diff['resolver_antes_sha256'], 'resolver_despues_sha256': diff['resolver_despues_sha256'],
                      'unico_cambio_de_contenido': 'PASS', 'entrada_sha256': operar.digest(args.salida / 'entrada.json')}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Delta Resolver detenido; contenido privado omitido.', file=sys.stderr)
        sys.exit(1)
