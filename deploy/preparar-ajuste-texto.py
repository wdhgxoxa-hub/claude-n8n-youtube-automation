#!/usr/bin/env python3
"""Cierra exclusivamente el permiso de texto de pago; nunca muestra el código privado."""
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

ID = 'FabAjustes000001'
NAME = 'F · Ajustes de la fábrica'
PROPERTY = re.compile(r'''(?<![\w])['"]?allowTextoApi['"]?\s*:\s*(true|false)\b''')
FIELDS = ('name', 'nodes', 'connections', 'settings', 'staticData', 'pinData')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def state(flow):
    return {field: flow.get(field) for field in FIELDS}


def literal(flow):
    nodes = [n for n in flow['nodes'] if n.get('name') == 'Ajustes' and n.get('type') == 'n8n-nodes-base.code']
    operar.require(len(nodes) == 1, 'Falta el único nodo Ajustes')
    code = nodes[0]['parameters']['jsCode']
    matches = list(PROPERTY.finditer(code))
    operar.require(len(matches) == 1, 'El permiso debe ser un único literal booleano')
    return nodes[0], matches[0]


def preparar(actuales):
    selected = [w for w in actuales if w.get('id') == ID and w.get('name') == NAME]
    operar.require(len(selected) == 1 and selected[0].get('active') is True, 'Ajustes real debe existir y estar publicado')
    original = selected[0]
    result = copy.deepcopy(original)
    node, match = literal(result)
    previous = match[1] == 'true'
    code = node['parameters']['jsCode']
    node['parameters']['jsCode'] = code[:match.start(1)] + 'false' + code[match.end(1):]
    result['active'] = False
    diff = {'modalidad': 'ajuste_texto_api', 'republicar_originales': [ID], 'plan_publicacion': [ID],
            'credenciales_faltantes': [], 'allowTextoApi_antes': previous, 'allowTextoApi_despues': False,
            'estado_antes_sha256': digest(state(original)), 'estado_despues_sha256': digest(state(result))}
    validar_contrato([result], diff)
    return [result], diff


def validar_contrato(workflows, diff):
    operar.require(len(workflows) == 1 and workflows[0].get('id') == ID and workflows[0].get('name') == NAME,
                    'El ajuste admite únicamente Ajustes')
    flow = workflows[0]
    _, match = literal(flow)
    operar.require(match[1] == 'false' and diff.get('allowTextoApi_despues') is False, 'El permiso de pago debe quedar cerrado')
    operar.require(type(diff.get('allowTextoApi_antes')) is bool, 'Falta estado booleano previo')
    restored = copy.deepcopy(flow)
    node, match = literal(restored)
    code = node['parameters']['jsCode']
    node['parameters']['jsCode'] = code[:match.start(1)] + str(diff['allowTextoApi_antes']).lower() + code[match.end(1):]
    operar.require(digest(state(restored)) == diff.get('estado_antes_sha256')
                    and digest(state(flow)) == diff.get('estado_despues_sha256'), 'Cambió otro ajuste o parámetro')
    operar.require(diff.get('republicar_originales') == diff.get('plan_publicacion') == [ID]
                    and not diff.get('credenciales_faltantes'), 'Publicación ajena al ajuste')
    return {ID}


def validar_actual(path, diff, despues=False):
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        rows = db.execute('SELECT name,nodes,connections,settings,staticData,pinData FROM workflow_entity WHERE id=?', (ID,)).fetchall()
        tables = db.execute("SELECT id FROM data_table WHERE name IN ('fab_eventos','eventos')").fetchall()
        operar.require(len(tables) == 1, 'Falta tabla única de ajustes administrativos')
        table = 'data_table_user_' + tables[0][0]
        quoted = '"' + table.replace('"', '""') + '"'
        overrides = db.execute("SELECT count(*) FROM " + quoted + " WHERE tipo=? AND json_valid(detalle) AND json_type(detalle,'$.valores.allowTextoApi')='true'", ('ajustes_cooper',)).fetchone()[0]
        operar.require(overrides == 0, 'Existe un permiso administrativo de pago; requiere cierre específico')
    operar.require(len(rows) == 1, 'Ajustes real ausente')
    values = dict(zip(FIELDS, rows[0]))
    for key in FIELDS[1:]:
        values[key] = json.loads(values[key]) if values[key] is not None else None
    key = 'estado_despues_sha256' if despues else 'estado_antes_sha256'
    operar.require(digest(values) == diff[key], 'Ajustes cambió desde la copia; preparar de nuevo')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', required=True, type=Path)
    parser.add_argument('--salida', required=True, type=Path)
    args = parser.parse_args()
    workflows, diff = preparar(json.loads(args.export.read_text()))
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, value in [('entrada.json', workflows), ('diff.json', diff), ('publicar.json', diff['plan_publicacion'])]:
        operar.write_json(args.salida / name, value)
    print(json.dumps({'preparados': 1, 'allowTextoApi_antes': diff['allowTextoApi_antes'], 'allowTextoApi_despues': False,
                      'unico_cambio_de_contenido': 'PASS', 'entrada_sha256': operar.digest(args.salida / 'entrada.json')}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Ajuste detenido; contenido privado omitido.', file=sys.stderr)
        sys.exit(1)
