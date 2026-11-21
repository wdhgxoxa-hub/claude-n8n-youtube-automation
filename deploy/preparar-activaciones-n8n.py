#!/usr/bin/env python3
"""Prepara solo aprendizaje, vigilancia y consulta horaria, sin publicar contenido."""
import argparse
from contextlib import closing
import importlib.util
import json
import os
import re
from pathlib import Path
import sqlite3
import sys

import operar

OBJETIVOS = {'FabAprendizaje01': 'M7 · Aprendizaje (24 h, 72 h y 7 días)',
             'FabErrores000001': 'F · Vigilante de errores',
             'FabConfirmar0001': 'F · Confirmar publicaciones'}
ORDEN = ['FabErrores000001', 'FabAprendizaje01', 'FabConfirmar0001']
DEPENDENCIAS = {'FabAjustes000001', 'FabYouTube000001', 'FabCooperProgr01'}


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), Path(__file__).with_name(name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def validar_contrato(workflows, diff):
    by_id = {w['id']: w for w in workflows}
    operar.require(len(workflows) == 3 and set(by_id) == set(OBJETIVOS), 'Solo tres activaciones aprobadas')
    operar.require(diff.get('plan_publicacion') == ORDEN and not diff.get('credenciales_faltantes'), 'Plan o credenciales de activación inválidos')
    deps = diff.get('dependencias', {})
    operar.require(set(deps) == DEPENDENCIAS and len(set(deps.values())) == 3, 'Mapa de dependencias inválido')
    for wid, flow in by_id.items():
        operar.require(flow['name'] == OBJETIVOS[wid], 'Nombre distinto del objetivo')
        settings = flow['settings']
        operar.require(settings.get('saveDataSuccessExecution') == settings.get('saveDataErrorExecution') == 'none'
                        and settings.get('saveManualExecutions') is False and settings.get('saveExecutionProgress') is False,
                        'No conservar respuestas privadas')
        schedules = []
        for node in flow['nodes']:
            kind = node['type'].split('.')[-1]
            p = node.get('parameters', {})
            operar.require(kind in {'code', 'dataTable', 'if', 'executeWorkflow', 'executeWorkflowTrigger',
                                    'scheduleTrigger', 'errorTrigger', 'httpRequest', 'telegram'}, 'Tipo de nodo no aprobado')
            if kind == 'scheduleTrigger':
                schedules.append(node)
                intervals = p.get('rule', {}).get('interval', [])
                operar.require(not node.get('disabled') and len(intervals) == 1
                                and intervals[0].get('field') == 'hours' and intervals[0].get('hoursInterval') == 1,
                                'Horario debe ser exactamente cada hora')
            if kind == 'errorTrigger':
                operar.require(wid == 'FabErrores000001' and not node.get('disabled'), 'Disparador de error ajeno')
            if kind == 'executeWorkflow':
                ref = p.get('workflowId')
                ref = ref.get('value') if isinstance(ref, dict) else ref
                operar.require(ref in set(deps.values()), 'Dependencia no aprobada')
            if kind == 'telegram':
                operar.require(wid != 'FabAprendizaje01', 'Aprendizaje no necesita enviar avisos')
            if kind == 'httpRequest':
                if p.get('method', 'GET') == 'POST':
                    operar.require(wid == 'FabAprendizaje01' and node['name'] == 'Analizar con el plan de la PC'
                                    and p.get('url') == "={{ $json.url + '/v1/chat' }}", 'Solo POST al plan local de aprendizaje')
                else:
                    operar.require(p.get('method', 'GET') == 'GET', 'No se admiten escrituras a proveedores')
        operar.require(len(schedules) == (0 if wid == 'FabErrores000001' else 1), 'Cantidad de horarios no aprobada')
    return set(OBJETIVOS)


def permiso_cerrado(path):
    ajuste = module('preparar-ajuste-texto')
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        rows = db.execute('SELECT nodes FROM workflow_entity WHERE id=?', (ajuste.ID,)).fetchall()
        tables = db.execute("SELECT id FROM data_table WHERE name IN ('fab_eventos','eventos')").fetchall()
        operar.require(len(rows) == len(tables) == 1, 'Falta inventario del permiso de texto')
        _, match = ajuste.literal({'nodes': json.loads(rows[0][0])})
        operar.require(match[1] == 'false', 'Cerrar allowTextoApi antes de activar')
        table = '"' + ('data_table_user_' + tables[0][0]).replace('"', '""') + '"'
        count = db.execute("SELECT count(*) FROM " + table + " WHERE tipo=? AND json_valid(detalle) AND json_type(detalle,'$.valores.allowTextoApi')='true'", ('ajustes_cooper',)).fetchone()[0]
        operar.require(count == 0, 'Cerrar override administrativo de texto antes de activar')


def preparar(actuales, fuentes, metadata):
    by_id = {w['id']: w for w in actuales}
    source = {w['id']: w for w in fuentes}
    operar.require(set(OBJETIVOS) <= set(by_id) and set(OBJETIVOS) <= set(source), 'No crear workflows durante activación')
    lote = module('preparar-n8n-total')
    mapping = {}
    for wid, flow in source.items():
        matches = [by_id[wid]] if wid in by_id else [w for w in actuales if w['name'] == flow['name']]
        operar.require(len(matches) <= 1, 'Nombre real ambiguo')
        mapping[wid] = matches[0]['id'] if matches else wid
    operar.require(DEPENDENCIAS <= set(mapping), 'Falta fuente de dependencias')
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True)))
    selected = [json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(source[wid], ensure_ascii=False))) for wid in ORDEN]
    output, diff = lote.preparar(actuales, selected, 'https://flujos.cooperestudio.com', metadata)
    habilitados = []
    for w in output:
        old_nodes = {n['name']: n for n in by_id[w['id']]['nodes']}
        for node in w['nodes']:
            if node['type'] in ('n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.errorTrigger'):
                old = old_nodes.get(node['name'])
                operar.require(old is not None and old['type'] == node['type'], 'No crear disparadores nuevos')
                node['disabled'] = False
                if old.get('disabled'):
                    habilitados.append({'workflow': w['id'], 'nodo': node['name']})
        for node in w['nodes']:
            if node['type'] == 'n8n-nodes-base.executeWorkflow':
                ref = node['parameters']['workflowId']['value']
                operar.require(by_id.get(ref, {}).get('active'), 'Dependencia previa debe estar publicada')
    diff.update({'modalidad': 'activaciones_cooper_total', 'plan_publicacion': ORDEN,
                 'activar_previamente_pausados': [wid for wid in ORDEN if not by_id[wid]['active']],
                 'disparadores_habilitados': habilitados, 'requiere_allowTextoApi': False, 'dependencias': {wid: mapping[wid] for wid in DEPENDENCIAS}})
    validar_contrato(output, diff)
    for flow, row in zip(output, diff['flujos']):
        row['despues_sha256'] = lote.digest(flow)
    return output, diff


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('export', 'metadata', 'fuente', 'salida'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    sources = [json.loads(path.read_text()) for path in sorted(args.fuente.glob('*.json'))]
    output, diff = preparar(json.loads(args.export.read_text()), sources, json.loads(args.metadata.read_text()))
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, value in [('entrada.json', output), ('diff.json', diff), ('publicar.json', ORDEN)]:
        operar.write_json(args.salida / name, value)
    print(json.dumps({'preparados': len(output), 'plan_publicacion': ORDEN,
                      'previamente_pausados': diff['activar_previamente_pausados'],
                      'horarios_habilitados': diff['disparadores_habilitados'],
                      'entrada_sha256': operar.digest(args.salida / 'entrada.json')}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Activación detenida; revisar permiso, credenciales y alcance. Salida privada omitida.', file=sys.stderr)
        sys.exit(1)
