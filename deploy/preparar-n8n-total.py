#!/usr/bin/env python3
"""Combina un export real privado con el lote; solo informa IDs, nombres y hashes."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def preparar(actuales, entradas, origen):
    if origen != 'https://flujos.cooperestudio.com':
        raise ValueError('Origen no autorizado')
    by_id = {w['id']: w for w in actuales}
    by_name = {}
    for w in actuales:
        by_name.setdefault(w['name'], []).append(w)
    mapping, pairs = {}, []
    for nuevo in entradas:
        matches = [by_id[nuevo['id']]] if nuevo['id'] in by_id else by_name.get(nuevo['name'], [])
        if len(matches) > 1:
            raise ValueError('Nombre de workflow ambiguo')
        actual = matches[0] if matches else None
        mapping[nuevo['id']] = actual['id'] if actual else nuevo['id']
        pairs.append((nuevo, actual))
    output, report = [], []
    # Los identificadores no son claves. Sustituye únicamente referencias conocidas.
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True)))
    for nuevo, actual in pairs:
        data = json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(nuevo, ensure_ascii=False)))
        data['active'] = False
        data['pinData'] = {}
        data['settings']['saveDataSuccessExecution'] = 'none'
        data['settings']['saveDataErrorExecution'] = 'none'
        if actual:
            previous_nodes = {n['name']: n for n in actual['nodes']}
            for node in data['nodes']:
                old = previous_nodes.get(node['name'])
                if old and node['type'] == old['type']:
                    node['id'] = old['id']
                    if old.get('credentials'):
                        node['credentials'] = copy.deepcopy(old['credentials'])
                    if 'webhookId' in old:
                        node['webhookId'] = old['webhookId']
                if nuevo['id'] == 'FabAjustes000001' and node['name'] == 'Ajustes':
                    if not old:
                        raise ValueError('Falta nodo Ajustes real; no usar defaults')
                    node['parameters'] = copy.deepcopy(old['parameters'])
                    js = node['parameters']['jsCode']
                    # Solo dominios de referencia; conserva todo otro ajuste/identificador.
                    js = re.sub(r'https://[a-z0-9-]+\.ngrok-free\.dev', origen, js)
                    node['parameters']['jsCode'] = js
        output.append(data)
        report.append({'id': data['id'], 'nombre': data['name'], 'nuevo': actual is None,
                       'antes_sha256': digest(actual) if actual else None, 'despues_sha256': digest(data),
                       'publicado_antes': bool(actual and actual['active']), 'publicado_entrada': False,
                       'nodos_antes': len(actual['nodes']) if actual else 0, 'nodos_despues': len(data['nodes'])})
    return output, {'mapa_ids': mapping, 'flujos': report, 'republicar_originales': [r['id'] for r in report if r['publicado_antes']]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', dest='export', type=Path, required=True)
    parser.add_argument('--entrada', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    actuales = json.loads(args.export.read_text())
    entradas = [json.loads(p.read_text()) for p in sorted(args.entrada.glob('*.json'))]
    salida, diff = preparar(actuales, entradas, 'https://flujos.cooperestudio.com')
    for name, data in [('entrada.json', salida), ('diff.json', diff)]:
        target = args.salida / name
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        target.chmod(0o600)
    print(json.dumps({'preparados': len(salida), 'inactivos': True, 'diff': str(args.salida / 'diff.json')}))


if __name__ == '__main__':
    main()
