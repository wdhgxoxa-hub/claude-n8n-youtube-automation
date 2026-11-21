#!/usr/bin/env python3
"""Extra separado: cambia solo disabled del horario Radar, con CAS y reversa."""
import argparse
import copy
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import sys
from types import SimpleNamespace

ID = 'FabRadar00000001'
NAME = 'F · Radar de tendencias'
NODE = 'Cada mañana (radar)'
POLICY = 'solo_disabled_horario_radar'
FIELDS = ('name', 'nodes', 'connections', 'settings', 'staticData', 'pinData')
CODE = Path(__file__).resolve().parent


def module(name):
    spec = importlib.util.spec_from_file_location('horario_' + name.replace('-', '_'), CODE / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def configure(path):
    global CODE, op, total, api, activations, trial
    CODE = path.resolve()
    sys.path.insert(0, str(CODE))
    import operar
    op = operar
    total = module('preparar-n8n-total')
    api = module('preparar-resolver-api')
    activations = module('preparar-activaciones-n8n')
    trial = module('ensayar-n8n')


def schedule(flow):
    rows = [n for n in flow['nodes'] if n['type'] == 'n8n-nodes-base.scheduleTrigger']
    op.require(len(rows) == 1 and rows[0]['name'] == NODE, 'Horario Radar no único')
    op.require(rows[0]['parameters'] == {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 7, 'triggerAtMinute': 40}]}},
               'Horario distinto del certificado')
    return rows[0]


def state(flow):
    return {key: flow.get(key) for key in FIELDS}


def masked(flow):
    result = copy.deepcopy(state(flow))
    schedule(result)['disabled'] = '<UNICO_CAMBIO>'
    return total.digest(result)


def workflows(db):
    fields = ('id', *FIELDS, 'active', 'versionId', 'activeVersionId')
    result = {}
    for row in db.execute('SELECT ' + ','.join(fields) + ' FROM workflow_entity'):
        flow = dict(zip(fields, row))
        for key in FIELDS[1:]:
            flow[key] = json.loads(flow[key]) if flow[key] is not None else None
        flow['active'] = bool(flow['active'])
        result[flow['id']] = flow
    return result


def dependencies(all_flows):
    pending, seen = [ID], set()
    while pending:
        wid = pending.pop()
        if wid in seen:
            continue
        op.require(wid in all_flows, 'Dependencia ausente')
        flow = all_flows[wid]
        op.require(flow['active'] is True and flow['activeVersionId'], 'Dependencia no publicada')
        seen.add(wid)
        for node in flow['nodes']:
            if node.get('disabled') or node['type'] != 'n8n-nodes-base.executeWorkflow':
                continue
            p = node['parameters']
            ref = p.get('workflowId')
            ref = ref.get('value') if isinstance(ref, dict) else ref
            op.require(p.get('source', 'database') == 'database' and isinstance(ref, str)
                       and ref and not ref.startswith('='), 'Dependencia dinámica no certificada')
            pending.append(ref)
    return sorted(seen)


def references(db, flows):
    # Solo IDs/tipos; nunca selecciona valores de credentials_entity.
    credentials = set(db.execute('SELECT id,type FROM credentials_entity'))
    tables = {row[0] for row in db.execute('SELECT id FROM data_table')}
    used = set()
    for flow in flows:
        for node in flow['nodes']:
            if node.get('disabled'):
                continue
            for kind, ref in node.get('credentials', {}).items():
                op.require((ref.get('id'), kind) in credentials, 'Falta referencia de credencial existente')
                used.add((ref['id'], kind))
            table = node.get('parameters', {}).get('dataTableId')
            table = table.get('value') if isinstance(table, dict) else table
            if table:
                op.require(isinstance(table, str) and table in tables, 'Tabla ausente o dinámica')
        row = db.execute('SELECT nodes,connections FROM workflow_history WHERE workflowId=? AND versionId=?',
                         (flow['id'], flow['activeVersionId'])).fetchall()
        op.require(len(row) == 1 and all(json.loads(value) == flow[key]
                    for value, key in zip(row[0], ('nodes', 'connections'))), 'Borrador difiere de publicación')
    return {'credenciales_existentes': len(used), 'referencias_sha256': total.digest(sorted(used))}


def read_base(path):
    return closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True))


def helper_hashes():
    names = ('operar.py', 'preparar-n8n-total.py', 'preparar-resolver-api.py',
             'preparar-activaciones-n8n.py', 'preparar-ajuste-texto.py', 'ensayar-n8n.py',
             'aplicar-n8n-total.py', 'esquema-n8n.py', 'n8n-columnas.cjs', 'infra-imagenes.json')
    return {name: op.digest(CODE / name) for name in names}


def prepare(base, exported, reverse=None):
    activations.permiso_cerrado(base)
    with read_base(base) as db:
        flows = workflows(db)
        ids = dependencies(flows)
        refs = references(db, [flows[wid] for wid in ids])
    originals = total.indice_unico(exported, 'id')
    op.require(set(ids) <= set(originals), 'Export oficial incompleto')
    for wid in ids:
        op.require(state(originals[wid]) == state(flows[wid]), 'Export distinto de la copia consistente')
    original = copy.deepcopy(originals[ID])
    original.update({key: flows[ID][key] for key in total.CAMPOS_CAS})
    op.require(original['name'] == NAME and schedule(original).get('disabled') is (not bool(reverse)),
               'Estado previo del horario no autorizado')
    if reverse:
        op.require(reverse.get('estado') == 'PASS' and reverse.get('politica_disparadores') == POLICY
                   and reverse.get('disabled_despues') is False
                   and masked(original) == reverse.get('resto_sha256'), 'Reversa sin recibo exacto de activación')
    changed = copy.deepcopy(original)
    schedule(changed)['disabled'] = bool(reverse)
    changed['active'] = False
    diff = {'politica_disparadores': POLICY, 'plan_publicacion': [ID], 'republicar_originales': [ID],
            'credenciales_faltantes': [], 'bloqueos_explicitos': [], 'disparadores_preservados': [],
            'disparadores_nuevos_bloqueados': [], 'disabled_antes': not bool(reverse),
            'disabled_despues': bool(reverse), 'resto_sha256': masked(original),
            'estado_antes_sha256': total.digest(state(original)), 'estado_despues_sha256': total.digest(state(changed)),
            'fuentes_sha256': {wid: total.digest(total.estado_cas(flows[wid])) for wid in ids},
            'dependencias': [wid for wid in ids if wid != ID], **refs,
            'flujos': [{'id': ID, 'nuevo': False,
                        'estado_antes_sha256': total.digest(total.estado_cas(original)),
                        'contenido_despues_sha256': total.digest({key: changed[key] for key in total.CAMPOS_CONTENIDO})}],
            'reversa_recibo_sha256': total.digest(reverse) if reverse else None}
    validate_contract([changed], diff)
    return [changed], diff


def validate_contract(flows, diff):
    op.require(diff.get('politica_disparadores') == POLICY and 'modalidad' not in diff, 'Política ajena')
    op.require(len(flows) == 1 and flows[0].get('id') == ID and flows[0].get('name') == NAME
               and flows[0].get('active') is False, 'Solo Radar existente e importación inactiva')
    flow = flows[0]
    op.require(type(diff.get('disabled_antes')) is type(diff.get('disabled_despues')) is bool
               and diff['disabled_antes'] != diff['disabled_despues']
               and schedule(flow).get('disabled') is diff['disabled_despues'], 'Cambio distinto de disabled')
    op.require(masked(flow) == diff.get('resto_sha256')
               and total.digest(state(flow)) == diff.get('estado_despues_sha256'), 'Contenido ajeno al cambio mínimo')
    op.require(diff.get('plan_publicacion') == diff.get('republicar_originales') == [ID]
               and diff.get('credenciales_faltantes') == [], 'Publicación o credencial ajenas')
    rows = diff.get('flujos', [])
    op.require(len(rows) == 1 and rows[0].get('id') == ID and rows[0].get('nuevo') is False
               and rows[0].get('contenido_despues_sha256') == total.digest({key: flow[key] for key in total.CAMPOS_CONTENIDO}),
               'CAS incompleto')
    op.require(set(diff.get('fuentes_sha256', {})) == {ID, *diff.get('dependencias', [])}, 'Fuentes incompletas')
    return {ID}


def validate_current(base, diff, despues=False):
    activations.permiso_cerrado(base)
    total.validar_actual(base, diff, despues=despues)
    with read_base(base) as db:
        flows = workflows(db)
        ids = dependencies(flows)
        op.require(ids == sorted(diff['fuentes_sha256']), 'Cambió el grafo de dependencias')
        refs = references(db, [flows[wid] for wid in ids])
        op.require(all(refs[key] == diff[key] for key in refs), 'Cambió inventario de credenciales')
        for wid in ids:
            if despues and wid == ID:
                continue
            op.require(total.digest(total.estado_cas(flows[wid])) == diff['fuentes_sha256'][wid], 'Fuente o versión concurrente')
        flow = flows[ID]
        op.require(masked(flow) == diff['resto_sha256'] and total.digest(state(flow)) ==
                   diff['estado_despues_sha256' if despues else 'estado_antes_sha256'], 'Contenido concurrente fuera del horario')


def apply(operator, folder, proof, output):
    diff = json.loads((folder / 'diff.json').read_text())
    entry, manifest, plan = [folder / name for name in ('entrada.json', 'columnas.json', 'publicar.json')]
    op.require(json.loads(manifest.read_text()) == {'tablas': {}}, 'El horario no admite columnas')
    op.require(proof.get('extra_sha256') == op.digest(Path(__file__))
               and proof.get('diff_sha256') == op.digest(folder / 'diff.json')
               and proof.get('helpers_sha256') == helper_hashes(), 'Extra, helpers o diff distintos del ensayo')
    app = module('aplicar-n8n-total')
    # Adaptador de política cerrado. El aplicador certificado sigue haciendo respaldo,
    # doble CAS, importación, publicación, conservación de datos y reversa automática.
    app.modulo_conservacion = lambda: SimpleNamespace(validar_conservacion=validate_contract, validar_actual=validate_current)
    result = app.aplicar(operator, entry, diff, proof, manifest, output, plan)
    result.update({'disabled_antes': diff['disabled_antes'], 'disabled_despues': diff['disabled_despues'],
                   'resto_sha256': diff['resto_sha256'], 'diff_sha256': op.digest(folder / 'diff.json'),
                   'extra_sha256': op.digest(Path(__file__)), 'fuentes_sha256': diff['fuentes_sha256']})
    op.write_json(output, result)
    return result


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codigo', type=Path, default=CODE)
    sub = parser.add_subparsers(dest='action', required=True)
    p = sub.add_parser('preparar')
    p.add_argument('--base', type=Path, required=True)
    p.add_argument('--export', dest='exported', type=Path, required=True)
    p.add_argument('--salida', type=Path, required=True)
    p.add_argument('--reversa-de', type=Path)
    p = sub.add_parser('ensayar')
    p.add_argument('--base', type=Path, required=True)
    p.add_argument('--lote', type=Path, required=True)
    p.add_argument('--salida', type=Path, required=True)
    p = sub.add_parser('aplicar')
    p.add_argument('--lote', type=Path, required=True)
    p.add_argument('--ensayo', type=Path, required=True)
    p.add_argument('--salida', type=Path, required=True)
    p.add_argument('--deploy', type=Path, required=True)
    args = parser.parse_args()
    configure(args.codigo)
    if args.action == 'preparar':
        flows, diff = prepare(args.base, json.loads(args.exported.read_text()),
                              json.loads(args.reversa_de.read_text()) if args.reversa_de else None)
        args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
        for name, data in [('entrada.json', flows), ('diff.json', diff), ('publicar.json', [ID]), ('columnas.json', {'tablas': {}})]:
            op.write_json(args.salida / name, data)
        print(json.dumps({'estado': 'PREPARADO', 'objetivos': [ID], 'disabled_despues': diff['disabled_despues'],
                          'diff_sha256': op.digest(args.salida / 'diff.json'), 'export_sha256': op.digest(args.exported)}))
    elif args.action == 'ensayar':
        diff = json.loads((args.lote / 'diff.json').read_text())
        validate_contract(json.loads((args.lote / 'entrada.json').read_text()), diff)
        validate_current(args.base, diff)
        result = trial.rehearse(args.base, args.lote / 'entrada.json', args.lote / 'columnas.json', CODE / 'n8n-columnas.cjs',
                                 args.salida, args.lote / 'publicar.json')
        validate_current(args.salida / 'actualizada/database.sqlite', diff, despues=True)
        validate_current(args.salida / 'revertida/database.sqlite', diff)
        result.update({'extra_sha256': op.digest(Path(__file__)), 'diff_sha256': op.digest(args.lote / 'diff.json'),
                       'helpers_sha256': helper_hashes(),
                       'disabled_despues': diff['disabled_despues'], 'resto_sha256': diff['resto_sha256'],
                       'cas_y_cambio_minimo': 'PASS'})
        op.write_json(args.salida / 'resultado.json', result)
        print(json.dumps(result))
    else:
        env, filename = op.config('/etc/cooper/.env')
        op.DEPLOY = args.deploy.resolve()
        operator = op.Operator(env, filename)
        with operator.lock():
            result = apply(operator, args.lote, json.loads(args.ensayo.read_text()), args.salida)
        print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Horario Radar detenido; recibos privados conservados, sin imprimir datos.', file=sys.stderr)
        sys.exit(1)
