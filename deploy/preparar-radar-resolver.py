#!/usr/bin/env python3
"""Delta cerrado: Resolver, salida del Radar y consulta interna de competencia."""
import argparse
import copy
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

import operar

CANONICOS = {'FabCooperAPI0001': 'FX · API de Cooper', 'FabRadar00000001': 'F · Radar de tendencias',
             'FabCompYouTube01': 'FX · Competencia pública de YouTube'}
CODIGOS = {'FabCooperAPI0001': 'Resolver', 'FabRadar00000001': 'Competencia con YouTube'}
HIJO = 'FabCompYouTube01'


def modulo(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


api = modulo('preparar-resolver-api')
total = modulo('preparar-n8n-total')


def codigo(flow, name):
    nodes = [n for n in flow['nodes'] if n.get('name') == name and n.get('type') == 'n8n-nodes-base.code']
    operar.require(len(nodes) == 1 and isinstance(nodes[0].get('parameters', {}).get('jsCode'), str), 'Nodo de código no único')
    return nodes[0]


def masked(flow, name):
    result = copy.deepcopy(flow)
    codigo(result, name)['parameters']['jsCode'] = '<CODIGO_CERTIFICADO>'
    return api.digest(api.state(result))


def preparar(actuales, fuentes, metadata):
    total.indice_unico(actuales, 'id')
    total.indice_unico(fuentes, 'id')
    total.indice_unico(fuentes, 'name')
    by_id = {w['id']: w for w in actuales}
    by_name = {}
    for w in actuales:
        by_name.setdefault(w['name'], []).append(w)
    canonical = {w['id']: w for w in fuentes}
    operar.require(set(CANONICOS) <= set(canonical), 'Falta fuente de un objetivo')
    mapping = {}
    for wid, w in canonical.items():
        matches = [by_id[wid]] if wid in by_id else by_name.get(w['name'], [])
        operar.require(len(matches) <= 1, 'Nombre real ambiguo')
        mapping[wid] = matches[0]['id'] if matches else wid
    originals = {}
    for cid, name in CANONICOS.items():
        w = by_id.get(mapping[cid])
        operar.require(w is not None and w['name'] == name and w.get('active') is True, 'Los tres objetivos deben existir y estar publicados')
        originals[cid] = w
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True)))
    child = json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(canonical[HIJO], ensure_ascii=False)))
    child_output, child_diff = total.preparar(actuales, [child], 'https://flujos.cooperestudio.com', metadata)
    operar.require(not child_diff['credenciales_faltantes'], 'Falta referencia de credencial del hijo')
    output = child_output
    cert = {}
    for cid, node in CODIGOS.items():
        original = originals[cid]
        changed = copy.deepcopy(original)
        codigo(changed, node)['parameters']['jsCode'] = codigo(canonical[cid], node)['parameters']['jsCode']
        changed['active'] = False
        output.append(changed)
        cert[cid] = {'id': original['id'], 'nodo': node, 'resto_sha256': masked(original, node),
                     'antes_sha256': api.digest(api.state(original)), 'despues_sha256': api.digest(api.state(changed)),
                     'codigo_antes_sha256': api.digest(codigo(original, node)['parameters']['jsCode']),
                     'codigo_despues_sha256': api.digest(codigo(changed, node)['parameters']['jsCode'])}
    order = [mapping[HIJO], mapping['FabRadar00000001'], mapping['FabCooperAPI0001']]
    diff = {'modalidad': 'radar_resolver', 'objetivos': {cid: mapping[cid] for cid in CANONICOS},
            'plan_publicacion': order, 'republicar_originales': order, 'credenciales_faltantes': [],
            'codigos': cert, 'hijo_antes_sha256': api.digest(api.state(originals[HIJO])),
            'hijo_despues_sha256': api.digest(api.state(child_output[0])),
            'hijo_fuente_sha256': api.digest(canonical[HIJO]),
            'referencias_hijo': sorted({n['parameters']['workflowId']['value'] for n in child_output[0]['nodes']
                                       if n['type'] == 'n8n-nodes-base.executeWorkflow'})}
    # Misma huella CAS que el lote conservador: incluye versiones y activo.
    # Se mantiene separado del certificado de cambios mínimos (incluye pin/staticData).
    diff['flujos_cas'] = [
        {'id': original['id'], 'nuevo': False,
         'estado_antes_sha256': total.digest(total.estado_cas(original)),
         'contenido_despues_sha256': total.digest({key: changed[key] for key in total.CAMPOS_CONTENIDO})}
        for cid, original in originals.items()
        for changed in output if changed['id'] == original['id']]
    # El hijo solo llama dependencias que ya estaban publicadas. No se abre ninguna otra.
    operar.require(all(ref in by_id and by_id[ref].get('active') for ref in diff['referencias_hijo']), 'Dependencia interna inactiva')
    validar_contrato(output, diff)
    return output, diff


def validar_contrato(workflows, diff):
    mapping = diff.get('objetivos', {})
    operar.require(set(mapping) == set(CANONICOS) and len(set(mapping.values())) == 3, 'Solo se admiten Radar, hijo y API')
    operar.require(all(isinstance(v, str) and re.fullmatch(r'[A-Za-z0-9_-]+', v) for v in mapping.values()), 'ID no válido')
    flows = {w['id']: w for w in workflows}
    operar.require(len(workflows) == 3 and set(flows) == set(mapping.values()), 'Lote ajeno o duplicado')
    rows = diff.get('flujos_cas', [])
    operar.require(len(rows) == 3 and {r.get('id') for r in rows} == set(flows), 'Falta CAS completo de los tres objetivos')
    for row in rows:
        operar.require(row.get('nuevo') is False and isinstance(row.get('estado_antes_sha256'), str)
                       and re.fullmatch('[a-f0-9]{64}', row['estado_antes_sha256']), 'Falta huella CAS anterior')
        operar.require(row.get('contenido_despues_sha256') == total.digest({key: flows[row['id']][key] for key in total.CAMPOS_CONTENIDO}),
                       'Contenido distinto del contrato CAS')
    order = [mapping[HIJO], mapping['FabRadar00000001'], mapping['FabCooperAPI0001']]
    operar.require(diff.get('plan_publicacion') == diff.get('republicar_originales') == order, 'Orden o publicación ajenos')
    operar.require(not diff.get('credenciales_faltantes'), 'Credencial ausente')
    for cid, name in CANONICOS.items():
        operar.require(flows[mapping[cid]].get('name') == name, 'Nombre ajeno')
    operar.require(set(diff.get('codigos', {})) == set(CODIGOS), 'Falta certificado de cambios mínimos')
    for cid, node in CODIGOS.items():
        row = diff['codigos'][cid]; flow = flows[mapping[cid]]
        operar.require(row.get('id') == mapping[cid] and row.get('nodo') == node, 'Nodo ajeno al cambio mínimo')
        operar.require(masked(flow, node) == row.get('resto_sha256'), 'Cambió contenido fuera del nodo autorizado')
        operar.require(api.digest(api.state(flow)) == row.get('despues_sha256') and
                       api.digest(codigo(flow, node)['parameters']['jsCode']) == row.get('codigo_despues_sha256'), 'Código distinto del certificado')
        operar.require(all(isinstance(row.get(k), str) and re.fullmatch('[a-f0-9]{64}', row[k])
                           for k in ('antes_sha256', 'codigo_antes_sha256')), 'Falta estado previo')
    child = flows[mapping[HIJO]]
    operar.require(api.digest(api.state(child)) == diff.get('hijo_despues_sha256'), 'Hijo distinto del certificado')
    operar.require(total.validar_conexiones(child), 'Conexiones del hijo con nodos ausentes')
    settings = child.get('settings', {})
    operar.require(settings.get('saveDataSuccessExecution') == settings.get('saveDataErrorExecution') == 'none'
                    and settings.get('saveManualExecutions') is False and settings.get('saveExecutionProgress') is False,
                    'El hijo no conserva respuestas de proveedores')
    allowed = {'executeWorkflowTrigger', 'executeWorkflow', 'httpRequest', 'code', 'if'}
    operar.require(all(n.get('type', '').startswith('n8n-nodes-base.') and n['type'].split('.')[-1] in allowed for n in child['nodes']), 'Entrada o tipo ajeno en el hijo')
    operar.require(sum(n['type'] == 'n8n-nodes-base.executeWorkflowTrigger' for n in child['nodes']) == 1, 'Una entrada interna obligatoria')
    refs = []
    for n in child['nodes']:
        p = n['parameters']
        if n['type'] == 'n8n-nodes-base.executeWorkflow':
            ref = p.get('workflowId'); ref = ref.get('value') if isinstance(ref, dict) else ref
            operar.require(p.get('source', 'database') == 'database' and isinstance(ref, str) and re.fullmatch(r'[A-Za-z0-9_-]+', ref), 'Referencia dinámica no autorizada')
            refs.append(ref)
        if n['type'] == 'n8n-nodes-base.httpRequest':
            method, url = p.get('method', 'GET'), p.get('url', '')
            operar.require((method == 'GET' and url in {'https://www.googleapis.com/youtube/v3/'+x for x in ('channels','playlistItems','videos','search')})
                            or (method == 'POST' and url == 'https://mcp.vidiq.com/mcp' and n.get('retryOnFail', False) is False), 'Destino, método o reintento ajenos')
    operar.require(sorted(set(refs)) == diff.get('referencias_hijo'), 'Dependencia distinta del certificado')
    return set(order)


def validar_actual(path, diff, despues=False):
    total.validar_actual(path, {'flujos': diff['flujos_cas']}, despues=despues)
    with closing(sqlite3.connect(path.resolve().as_uri()+'?mode=ro', uri=True)) as db:
        for cid, wid in diff['objetivos'].items():
            rows = db.execute('SELECT name,nodes,connections,settings,staticData,pinData FROM workflow_entity WHERE id=?', (wid,)).fetchall()
            operar.require(len(rows) == 1, 'Objetivo ausente')
            flow = dict(zip(api.FIELDS, rows[0]))
            for key in api.FIELDS[1:]:
                flow[key] = json.loads(flow[key]) if flow[key] is not None else None
            expected = diff['hijo_despues_sha256' if despues else 'hijo_antes_sha256'] if cid == HIJO else diff['codigos'][cid]['despues_sha256' if despues else 'antes_sha256']
            operar.require(api.digest(api.state(flow)) == expected, 'Objetivo cambió desde la copia')
            if cid in CODIGOS:
                operar.require(masked(flow, CODIGOS[cid]) == diff['codigos'][cid]['resto_sha256'], 'Cambió contenido fuera del nodo autorizado')


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('export','metadata','fuente','salida'):
        parser.add_argument('--'+name, required=True, type=Path)
    args=parser.parse_args()
    flows,diff=preparar(json.loads(args.export.read_text()), [json.loads(p.read_text()) for p in sorted(args.fuente.glob('*.json'))], json.loads(args.metadata.read_text()))
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name,value in [('entrada.json',flows),('diff.json',diff),('publicar.json',diff['plan_publicacion'])]:
        operar.write_json(args.salida/name,value)
    print(json.dumps({'preparados':3,'plan':diff['plan_publicacion'],'entrada_sha256':operar.digest(args.salida/'entrada.json')}))


if __name__ == '__main__':
    try:main()
    except Exception:
        print('Delta cerrado detenido; salida privada omitida.',file=sys.stderr)
        sys.exit(1)
