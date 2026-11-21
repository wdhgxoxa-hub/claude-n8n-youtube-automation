#!/usr/bin/env python3
"""Compara exportación estructural sanitizada con fuentes Git, sin red."""
import argparse
import json
import re
import subprocess
from pathlib import Path
from auditar_n8n_sqlite import graph_findings, SETTING_KEYS

ROOT = Path(__file__).resolve().parents[2]


def literal_ref(value):
    if not isinstance(value, str):
        return None
    if not value.startswith('='):
        return value
    match = re.fullmatch(r"=\{\{\s*['\"]([A-Za-z0-9_-]+)['\"]\s*\}\}", value)
    return match[1] if match else None


def compare(snapshot, ref):
    files = subprocess.check_output(['git', '-C', str(ROOT), 'ls-tree', '-r', '--name-only', ref, '--', 'workflows'], text=True).splitlines()
    local = []
    for path in files:
        if not path.endswith('.json'):
            continue
        data = json.loads(subprocess.check_output(['git', '-C', str(ROOT), 'show', f'{ref}:{path}']))
        for w in data if isinstance(data, list) else [data]:
            local.append((path, w))
    live = snapshot['workflows']
    by_name = {w['name']: w for w in live}
    by_id = {w['id']: w for w in live}
    credential_ids = {c['id'] for c in snapshot['referencias_credenciales_existentes']}
    table_ids = {t['id'] for t in snapshot['tablas']}
    aliases = {w['id']: by_name[w['name']]['id'] for _, w in local if w.get('id') and w['name'] in by_name}
    compared, matched = [], set()
    for path, w in local:
        remote = by_id.get(w.get('id')) or by_name.get(w['name'])
        if not remote:
            compared.append({'archivo': path, 'id': w.get('id'), 'nombre': w['name'], 'estado': 'ausente_en_destino'})
            continue
        matched.add(remote['id'])
        rn = {n['name']: n for n in remote['draft']['nodes']}
        ln = {n['name']: n for n in w['nodes']}
        fields = {}
        for name in sorted(rn.keys() & ln.keys()):
            a, b = ln[name], rn[name]
            old = {k: a.get(k) for k in ('type','typeVersion','disabled','retryOnFail','maxTries','waitBetweenTries','onError','continueOnFail')}
            old['timeout'] = a.get('parameters', {}).get('options', {}).get('timeout')
            # Expresión de timeout se considera presente, pero no se exportó su texto.
            changes = {k: {'versionado': v, 'vivo': b.get(k)} for k, v in old.items() if v != b.get(k)}
            if changes:
                fields[name] = changes
        settings = {k: {'versionado': w.get('settings', {}).get(k), 'vivo': remote['settings'].get(k)} for k in SETTING_KEYS if w.get('settings', {}).get(k) != remote['settings'].get(k)}
        compared.append({'archivo': path, 'id_versionado': w.get('id'), 'id_destino': remote['id'], 'nombre': w['name'],
            'activo_destino': bool(remote['active']), 'nodos_solo_versionado': sorted(ln.keys()-rn.keys()),
            'nodos_solo_destino': sorted(rn.keys()-ln.keys()), 'nodos_configuracion_distinta': fields,
            'conexiones_distintas': w.get('connections', {}) != remote['draft']['connections'], 'settings_distintos': settings,
            'grafo_versionado': graph_findings(w['nodes'], w.get('connections', {}))})
    findings = []
    for w in live:
        nodes = w['draft']['nodes']
        http = [n for n in nodes if n['type'].endswith('.httpRequest')]
        refs = []
        for n in nodes:
            wid = literal_ref(n['workflowId'])
            if wid and wid not in by_id:
                refs.append({'nodo': n['name'], 'id': wid})
        cron = [n for n in nodes if n['schedule'] or n['cron']]
        findings.append({'id': w['id'], 'nombre': w['name'], 'activo': bool(w['active']), 'nodos': len(nodes),
            'solo_destino': w['id'] not in matched,
            'error_workflow': w['settings']['errorWorkflow'], 'timeout_s': w['settings']['executionTimeout'],
            'reintentos_http_mutantes': [n['name'] for n in http if n['retryOnFail'] and n['method'] not in (None,'GET','HEAD','OPTIONS')],
            'timeout_http_no_numerico_o_ausente': [n['name'] for n in http if n['timeout'] is None],
            'credenciales_no_resueltas': [{'nodo': n['name'], **c} for n in nodes for c in n['credentials'] if c['id'] not in credential_ids],
            'autenticacion_sin_asociar': [n['name'] for n in nodes if n['authentication'] in ('genericCredentialType','predefinedCredentialType') and not n['credentials']],
            'tablas_no_resueltas': [{'nodo': n['name'], 'id': n['dataTableId']} for n in nodes if n['dataTableId'] and n['dataTableId'] not in table_ids],
            'subflujos_no_resueltos': refs,
            'crons': [{'nodo': n['name'], 'schedule': n['schedule'], 'cron': n['cron']} for n in cron],
            'grafo': {k: w['draft'][k] for k in ('conexiones_rotas','aislados','inalcanzables_desde_disparador')},
            'borrador_difiere_publicado': w.get('borrador_difiere_publicado')})
    return {'captura_utc': snapshot['capturado_utc'], 'referencia_git': ref,
        'limite': 'Diff estructural, no compara código/parámetros libres ni acredita credenciales vigentes. IDs mapeados por nombre y confirmables por el operador.',
        'mapa_ids': aliases, 'comparacion': compared, 'inventario_destino': findings,
        'resumen': {'workflows_vivos': len(live), 'activos': sum(bool(w['active']) for w in live),
            'nodos': sum(len(w['draft']['nodes']) for w in live), 'versionados': len(local),
            'solo_destino': len(live)-len(matched), 'ejecuciones_7d': snapshot['ejecuciones_7d']}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--ref', default='HEAD')
    args = parser.parse_args()
    print(json.dumps(compare(json.loads(args.snapshot.read_text()), args.ref), ensure_ascii=False, indent=2))
