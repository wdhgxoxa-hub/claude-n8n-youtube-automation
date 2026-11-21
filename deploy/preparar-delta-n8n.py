#!/usr/bin/env python3
"""Prepara únicamente el delta final de Cooper; conserva entradas pausadas."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

import operar

CANONICOS = {
    'FabLlamarClaude1': 'FX · Llamar a Claude',
    'FabRetornoClaud1': 'F · Retorno de Claude',
    'FabCooperAPI0001': 'FX · API de Cooper',
    'FabOrquestador01': 'F · Orquestador',
    'FabRadar00000001': 'F · Radar de tendencias',
    'FabCompYouTube01': 'FX · Competencia pública de YouTube',
}
NUEVO = 'FabCompYouTube01'


def modulo_lote():
    spec = importlib.util.spec_from_file_location('preparar_lote', Path(__file__).with_name('preparar-n8n-total.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def entrada_externa(node):
    tipo = node.get('type', '').split('.')[-1]
    return tipo not in ('executeWorkflowTrigger', 'manualTrigger') and (
        'trigger' in tipo.lower() or tipo in ('webhook', 'form'))


def validar_contrato(workflows, diff):
    mapping = diff.get('delta_canonicos', {})
    operar.require(set(mapping) == set(CANONICOS) and len(set(mapping.values())) == len(CANONICOS),
                    'El delta debe contener exactamente sus seis objetivos')
    by_id = {w['id']: w for w in workflows}
    operar.require(set(by_id) == set(mapping.values()), 'Objetivo ajeno al delta')
    for canonical, wid in mapping.items():
        operar.require(by_id[wid]['name'] == CANONICOS[canonical], 'Nombre ajeno al objetivo aprobado')
    nuevo = by_id[mapping[NUEVO]]
    permitidos = {'executeWorkflowTrigger', 'executeWorkflow', 'httpRequest', 'code', 'if', 'merge', 'noOp', 'set'}
    operar.require(all(n.get('type', '').startswith('n8n-nodes-base.') and n['type'].split('.')[-1] in permitidos
                       for n in nuevo['nodes']), 'Tipo de nodo no aprobado en el subflujo nuevo')
    operar.require(sum(n.get('type') == 'n8n-nodes-base.executeWorkflowTrigger' for n in nuevo['nodes']) == 1,
                    'El nuevo subflujo requiere una entrada interna')
    operar.require(not any(entrada_externa(n) for n in nuevo['nodes']), 'El nuevo subflujo no admite entradas externas')
    settings = nuevo.get('settings', {})
    operar.require(settings.get('saveDataSuccessExecution') == settings.get('saveDataErrorExecution') == 'none'
                    and settings.get('saveManualExecutions') is False and settings.get('saveExecutionProgress') is False,
                    'El subflujo no puede conservar respuestas de proveedores')
    for row in diff.get('disparadores_preservados', []):
        nodes = [n for n in by_id.get(row['workflow'], {}).get('nodes', []) if n.get('name') == row['nodo']]
        operar.require(len(nodes) == 1 and bool(nodes[0].get('disabled')) == row['deshabilitado'],
                        'Cambió una entrada externa preservada')
    operar.require(not diff.get('credenciales_faltantes'), 'Delta con credencial ausente')
    return set(diff['republicar_originales']) | {mapping[NUEVO]}


def preparar(actuales, fuentes, metadata):
    lote = modulo_lote()
    by_id = {w['id']: w for w in actuales}
    by_name = {}
    for w in actuales:
        by_name.setdefault(w['name'], []).append(w)
    canonical = {w['id']: w for w in fuentes}
    operar.require(set(CANONICOS) <= set(canonical), 'Falta un objetivo de la fuente congelada')
    mapping = {}
    for wid, w in canonical.items():
        matches = [by_id[wid]] if wid in by_id else by_name.get(w['name'], [])
        operar.require(len(matches) <= 1, 'Nombre real ambiguo')
        mapping[wid] = matches[0]['id'] if matches else wid
    operar.require(all(mapping[wid] in by_id for wid in CANONICOS if wid != NUEVO),
                    'No se permite crear otro workflow además del subflujo YouTube')
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True)))
    # Solo transforma referencias conocidas; el export privado nunca se imprime.
    selected = [json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(canonical[wid], ensure_ascii=False)))
                for wid in CANONICOS]
    output, diff = lote.preparar(actuales, selected, 'https://flujos.cooperestudio.com', metadata)
    preservados = []
    for w in output:
        actual = by_id.get(w['id'])
        anteriores = {n['name']: n for n in actual['nodes']} if actual else {}
        for n in w['nodes']:
            if not entrada_externa(n):
                continue
            old = anteriores.get(n['name'])
            operar.require(old is not None and old['type'] == n['type'], 'El delta no crea entradas externas')
            n['disabled'] = bool(old.get('disabled'))
            preservados.append({'workflow': w['id'], 'nodo': n['name'], 'deshabilitado': n['disabled']})
    diff.update({'modalidad': 'delta_cooper_total', 'delta_canonicos': {wid: mapping[wid] for wid in CANONICOS},
                 'disparadores_preservados': preservados})
    pending = validar_contrato(output, diff)
    flows = {w['id']: w for w in output}
    ready = {wid for wid, w in by_id.items() if w.get('active') and wid not in flows}
    order, visiting = [], set()

    def visit(wid):
        if wid in ready:
            return
        operar.require(wid in pending, 'Dependencia externa pendiente o inactiva')
        operar.require(wid not in visiting, 'Ciclo entre dependencias del delta')
        visiting.add(wid)
        for n in flows[wid]['nodes']:
            if n.get('disabled') or n['type'] != 'n8n-nodes-base.executeWorkflow':
                continue
            p = n.get('parameters', {})
            if p.get('source', 'database') != 'database':
                continue
            ref = p.get('workflowId')
            ref = ref.get('value') if isinstance(ref, dict) else ref
            if isinstance(ref, str) and ref and not ref.startswith('='):
                visit(ref)
        visiting.remove(wid)
        ready.add(wid)
        order.append(wid)

    for wid in sorted(pending):
        visit(wid)
    diff['plan_publicacion'] = order
    for flow, row in zip(output, diff['flujos']):
        row['despues_sha256'] = lote.digest(flow)
    return output, diff


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('export', 'metadata', 'fuente', 'salida'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    fuentes = [json.loads(p.read_text()) for p in sorted(args.fuente.glob('*.json'))]
    output, diff = preparar(json.loads(args.export.read_text()), fuentes, json.loads(args.metadata.read_text()))
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, value in [('entrada.json', output), ('diff.json', diff), ('publicar.json', diff['plan_publicacion'])]:
        operar.write_json(args.salida / name, value)
    print(json.dumps({'preparados': len(output), 'inactivos': True, 'publicar': diff['plan_publicacion'],
                      'entrada_sha256': operar.digest(args.salida / 'entrada.json')}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Delta no preparado; revisar objetivos, referencias y pausas. Salida privada omitida.', file=sys.stderr)
        sys.exit(1)
