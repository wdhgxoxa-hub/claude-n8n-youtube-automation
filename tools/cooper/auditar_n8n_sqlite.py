#!/usr/bin/env python3
"""Exportación estructural de auditoría: SQLite ro, sin credenciales ni payloads.

No es un backup importable. SQL proyecta únicamente los campos permitidos antes
de entregarlos a Python. Nunca SELECT * sobre workflows, ejecuciones o claves.
Se puede ejecutar por stdin en el host; no instala nada ni escribe en el VPS.
"""
import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


SETTING_KEYS = ('executionOrder', 'timezone', 'executionTimeout', 'errorWorkflow',
                'saveDataErrorExecution', 'saveDataSuccessExecution', 'callerPolicy')
NODE_KEYS = ('name', 'type', 'typeVersion', 'disabled', 'retryOnFail', 'maxTries',
             'waitBetweenTries', 'onError', 'continueOnFail')


def graph_findings(nodes, connections):
    names = {n['name'] for n in nodes}
    adjacent = {name: set() for name in names}
    broken = []
    linked = set()
    roots = {n['name'] for n in nodes if n['type'].endswith(
        ('Trigger', '.webhook', '.errorTrigger', '.manualTrigger', '.formTrigger'))}
    for origin, kinds in connections.items():
        for kind, outputs in kinds.items():
            for edges in outputs:
                for edge in edges:
                    target = edge['node']
                    if origin not in names or target not in names:
                        broken.append([origin, target])
                        continue
                    linked.update((origin, target))
                    # Modelos/herramientas AI son dependencias del consumidor.
                    adjacent[origin if kind == 'main' else target].add(
                        target if kind == 'main' else origin)
    reached, todo = set(), list(roots)
    while todo:
        name = todo.pop()
        if name not in reached:
            reached.add(name)
            todo.extend(adjacent[name] - reached)
    relevant = {n['name'] for n in nodes if not n['type'].endswith('.stickyNote')}
    return {'conexiones_rotas': broken, 'aislados': sorted(relevant - linked - roots),
            'inalcanzables_desde_disparador': sorted(relevant - reached)}


def projection(db, table, identity_column, identity):
    # Los identificadores SQL son constantes internas, nunca entrada del usuario.
    if (table, identity_column) not in [('workflow_entity', 'id'), ('workflow_history', 'versionId')]:
        raise ValueError('Proyección no permitida')
    source = f'{table} w, json_each(w.nodes) n'
    expressions = [f"json_extract(n.value, '$.{key}') AS \"{key}\"" for key in NODE_KEYS]
    expressions += [
        "CASE WHEN json_extract(n.value,'$.parameters.method') IN ('GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS') THEN json_extract(n.value,'$.parameters.method') ELSE NULL END AS method",
        "CASE WHEN typeof(json_extract(n.value,'$.parameters.options.timeout')) IN ('integer','real') THEN json_extract(n.value,'$.parameters.options.timeout') END AS timeout",
        "json_extract(n.value,'$.parameters.authentication') AS authentication",
        "json_extract(n.value,'$.parameters.genericAuthType') AS genericAuthType",
        "json_extract(n.value,'$.parameters.nodeCredentialType') AS nodeCredentialType",
        "json_extract(n.value,'$.parameters.workflowId.value') AS workflowId",
        "json_extract(n.value,'$.parameters.dataTableId.value') AS dataTableId",
        "json_extract(n.value,'$.parameters.operation') AS operation",
        "CASE WHEN json_extract(n.value,'$.type')='n8n-nodes-base.scheduleTrigger' THEN json_extract(n.value,'$.parameters.rule.interval') END AS schedule",
        "CASE WHEN json_extract(n.value,'$.type')='n8n-nodes-base.cron' THEN json_extract(n.value,'$.parameters.triggerTimes.item') END AS cron",
        "CASE WHEN json_extract(n.value,'$.parameters.options.batching.batch.batchSize') IS NOT NULL THEN 1 ELSE 0 END AS batching",
    ]
    nodes = [dict(row) for row in db.execute(
        f"SELECT {','.join(expressions)} FROM {source} WHERE w.{identity_column}=?", (identity,))]
    for node in nodes:
        for key in ('schedule', 'cron'):
            if node[key]:
                node[key] = json.loads(node[key])
        node['credentials'] = [dict(row) for row in db.execute(
            f"SELECT c.key AS type, json_extract(c.value,'$.id') AS id FROM {source}, json_each(n.value,'$.credentials') c WHERE w.{identity_column}=? AND json_extract(n.value,'$.name')=?",
            (identity, node['name']))]
    connections = json.loads(db.execute(
        f'SELECT connections FROM {table} WHERE {identity_column}=?', (identity,)).fetchone()[0] or '{}')
    return {'nodes': nodes, 'connections': connections, **graph_findings(nodes, connections)}


def error_summary(db, execution_id):
    """Resuelve solo índices flatted; clasifica mensaje en SQL, nunca lo exporta."""
    def pointer(path):
        row = db.execute("SELECT CASE WHEN json_type(data,?) IN ('text','integer') AND CAST(json_extract(data,?) AS TEXT) NOT GLOB '*[^0-9]*' THEN CAST(json_extract(data,?) AS INTEGER) END FROM execution_data WHERE executionId=?", (path, path, path, execution_id)).fetchone()
        return row[0] if row else None
    result = pointer('$[0].resultData')
    error = pointer(f'$[{result}].error') if result is not None else None
    node = pointer(f'$[{result}].lastNodeExecuted') if result is not None else None
    out = {'causa': 'sin_detalle_guardado' if error is None else 'no_clasificada', 'nodo': None}
    if node is not None:
        # Solo devolver nombre si coincide con un nodo del workflow guardado.
        row = db.execute("SELECT json_extract(n.value,'$.name') FROM execution_data e, json_each(e.workflowData,'$.nodes') n WHERE e.executionId=? AND json_extract(n.value,'$.name')=json_extract(e.data,?) LIMIT 1", (execution_id, f'$[{node}]')).fetchone()
        out['nodo'] = row[0] if row else None
    if error is None and result is not None:
        run = pointer(f'$[{result}].runData')
        if run is not None:
            # n8n puede conservar solamente runData al fallar. No exportar items.
            for row in db.execute("SELECT j.key, CAST(j.value AS INTEGER) AS idx FROM execution_data e,json_each(e.data,?) j WHERE executionId=? AND j.type='text' AND j.value NOT GLOB '*[^0-9]*'", (f'$[{run}]', execution_id)).fetchall():
                steps = db.execute("SELECT CAST(j.value AS INTEGER) AS idx FROM execution_data e,json_each(e.data,?) j WHERE executionId=? AND j.type='text' AND j.value NOT GLOB '*[^0-9]*'", (f"$[{row['idx']}]", execution_id)).fetchall()
                for step in steps:
                    candidate = pointer(f"$[{step['idx']}].error")
                    if candidate is not None:
                        error = candidate
                        out['nodo'] = row['key']
                        out['causa'] = 'no_clasificada'
    pointers = [pointer(f'$[{error}].{key}') for key in ('message', 'description', 'name')] if error is not None else []
    pointers = [p for p in pointers if p is not None]
    status = pointer(f'$[{error}].httpCode') if error is not None else None
    if status is not None:
        row = db.execute("SELECT CASE WHEN CAST(json_extract(data,?) AS TEXT) GLOB '[1-5][0-9][0-9]' THEN CAST(json_extract(data,?) AS INTEGER) END FROM execution_data WHERE executionId=?", (f'$[{status}]', f'$[{status}]', execution_id)).fetchone()
        out['http_status'] = row[0] if row else None
    if pointers:
        categories = [
            ('entorno_bloqueado', ['access to env vars denied', 'environment variable access', 'env access']),
            ('runner_no_disponible', ['task runner', 'task request timed out', 'task execution timed out']),
            ('rate_limit', ['rate limit', 'too many requests', '429']),
            ('autenticacion', ['unauthorized', 'forbidden', 'credential', '401', '403']),
            ('timeout', ['timed out', 'timeout', 'etimedout']),
            ('conexion', ['econnrefused', 'enotfound', 'econnreset', 'socket hang up']),
            ('expresion_o_referencia', ['referenced node', 'not been executed', 'cannot read properties', 'expression', 'syntaxerror', 'not defined', 'not a function', 'unexpected token']),
            ('esquema_tabla', ['column', 'data table', 'sqlite', 'constraint']),
            ('recurso_ausente', ['not found', 'does not exist', 'could not find', 'could not be found']),
            ('servicio_no_disponible', ['service unavailable', 'bad gateway', '502', '503']),
            ('validacion_peticion', ['bad request', 'invalid', 'required', '400', '422']),
            ('configuracion_ausente', ['falta ', 'configura', 'no hay ', 'missing']),
            ('respuesta_sin_datos', ['sin respuesta', 'no devolvió', 'empty', 'no output', 'no data']),
            ('conexion', ['connection', 'could not be established', 'conexión', 'refused']),
        ]
        for category, needles in categories:
            predicates = ' OR '.join("instr(lower(json_extract(data,?)),?) > 0" for _ in needles for _ in pointers)
            params = [x for needle in needles for p in pointers for x in (f'$[{p}]', needle)] + [execution_id]
            if db.execute(f'SELECT ({predicates}) FROM execution_data WHERE executionId=?', params).fetchone()[0]:
                out['causa'] = category
                break
    return out


def audit(path):
    db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA query_only=ON')
    db.execute('BEGIN')
    result = {'capturado_utc': datetime.now(timezone.utc).isoformat(),
              'formato': 'auditoria-estructural-v1', 'respaldo_restaurable': False,
              'limite': 'Sin parámetros libres, código, URLs, mensajes de error, datos, claves, staticData o pinData. La comparación no demuestra igualdad semántica completa.',
              'workflows': []}
    settings = ','.join(f"json_extract(settings,'$.{k}') AS \"{k}\"" for k in SETTING_KEYS)
    for row in db.execute(f'SELECT id,name,active,versionId,activeVersionId,updatedAt,isArchived,{settings} FROM workflow_entity ORDER BY id').fetchall():
        w = dict(row)
        if re.search(r'd\s*[&y]\s*s\s*factory', w['name'], re.I):
            result.setdefault('excluidos', []).append({'id': w['id'], 'motivo': 'fuera_de_alcance'})
            continue
        w['settings'] = {k: w.pop(k) for k in SETTING_KEYS}
        w['draft'] = projection(db, 'workflow_entity', 'id', w['id'])
        if w['activeVersionId']:
            exists = db.execute('SELECT 1 FROM workflow_history WHERE versionId=?', (w['activeVersionId'],)).fetchone()
            w['published'] = projection(db, 'workflow_history', 'versionId', w['activeVersionId']) if exists else None
            w['borrador_difiere_publicado'] = bool(db.execute('SELECT w.nodes != h.nodes OR w.connections != h.connections FROM workflow_entity w JOIN workflow_history h ON h.versionId=w.activeVersionId WHERE w.id=?', (w['id'],)).fetchone()[0]) if exists else None
        result['workflows'].append(w)
    # Excluir también sus recursos y ejecuciones: no basta con omitir el grafo.
    scoped_nodes = [node for workflow in result['workflows']
                    for side in ('draft', 'published')
                    for node in (workflow.get(side) or {}).get('nodes', [])]
    credential_ids = sorted({credential['id'] for node in scoped_nodes
                             for credential in node['credentials'] if credential.get('id')})
    table_ids = sorted({node['dataTableId'] for node in scoped_nodes if node.get('dataTableId')})
    workflow_ids = [workflow['id'] for workflow in result['workflows']]

    def scope(column, identities):
        return (column + ' IN (' + ','.join('?' for _ in identities) + ')') if identities else '0'

    # Solo IDs y tipos referenciados; jamás la columna cifrada data de credentials_entity.
    result['referencias_credenciales_existentes'] = [dict(r) for r in db.execute(
        'SELECT id,type FROM credentials_entity WHERE ' + scope('id', credential_ids) + ' ORDER BY id', credential_ids)]
    result['tablas'] = [dict(r) for r in db.execute(
        'SELECT id,name FROM data_table WHERE ' + scope('id', table_ids) + ' ORDER BY id', table_ids)]
    workflow_scope = scope('workflowId', workflow_ids)
    result['ejecuciones_7d'] = [dict(r) for r in db.execute(
        "SELECT status,count(*) AS total FROM execution_entity WHERE startedAt>=datetime('now','-7 days') AND " + workflow_scope + ' GROUP BY status', workflow_ids)]
    result['ejecuciones_en_vuelo'] = [dict(r) for r in db.execute(
        "SELECT id,workflowId,status,mode,startedAt,waitTill FROM execution_entity WHERE status IN ('new','running','waiting') AND " + workflow_scope + ' ORDER BY id', workflow_ids)]
    result['fallos_recientes'] = []
    for row in db.execute("SELECT id,workflowId,status,mode,startedAt,stoppedAt,retryOf FROM execution_entity WHERE status IN ('error','crashed','canceled') AND startedAt>=datetime('now','-7 days') AND " + workflow_scope + ' ORDER BY id DESC LIMIT 100', workflow_ids).fetchall():
        result['fallos_recientes'].append({**dict(row), **error_summary(db, row['id'])})
    db.rollback()
    db.close()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.database), ensure_ascii=False, indent=2))
