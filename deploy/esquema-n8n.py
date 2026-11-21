"""Puerta de nombres/tipos y referencias DataTable; nunca consulta filas de negocio."""
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / 'contratos/cooper-tablas-produccion.json'
CHECKER = ROOT / 'tools/cooper/comparar_esquema_productivo.py'


def references(workflows):
    result = []
    for workflow in workflows:
        for node in workflow.get('nodes', []):
            if node.get('disabled') or node.get('type') != 'n8n-nodes-base.dataTable':
                continue
            p = node.get('parameters', {})
            table = p.get('dataTableId', {})
            result.append({'workflow': workflow['id'], 'nodo': node['name'],
                           'tabla_id': table.get('value') if isinstance(table, dict) else table,
                           'filtros': [f.get('keyName') for f in p.get('filters', {}).get('conditions', [])],
                           'campos_mapeados': list(p.get('columns', {}).get('value', {}))})
    return result


def inventory(path, workflows=()):
    target_ids = {w['id'] for w in workflows}
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        tables = [{'id': wid, 'nombre': name, 'columnas': dict(db.execute(
            'SELECT name,type FROM data_table_column WHERE dataTableId=?', (wid,)))}
            for wid, name in db.execute('SELECT id,name FROM data_table')]
        # SQL proyecta exclusivamente nombres de tabla, nodo y columnas; no valores mapeados.
        query = """SELECT w.id,json_extract(n.value,'$.name'),
          coalesce(json_extract(n.value,'$.parameters.dataTableId.value'),json_extract(n.value,'$.parameters.dataTableId')),
          (SELECT json_group_array(json_extract(f.value,'$.keyName')) FROM json_each(n.value,'$.parameters.filters.conditions') f),
          (SELECT json_group_array(c.key) FROM json_each(n.value,'$.parameters.columns.value') c)
          FROM workflow_entity w JOIN workflow_history h ON h.workflowId=w.id AND h.versionId=w.activeVersionId,
          json_each(h.nodes) n WHERE json_extract(n.value,'$.type')='n8n-nodes-base.dataTable'
          AND coalesce(json_extract(n.value,'$.disabled'),0)=0"""
        refs = [{'workflow': wid, 'nodo': node, 'tabla_id': tid, 'filtros': json.loads(filters),
                 'campos_mapeados': json.loads(mapped)} for wid, node, tid, filters, mapped in db.execute(query)
                if wid not in target_ids]
    return {'tablas': tables, 'referencias': refs + references(workflows)}


def validate(path, workflows=(), planned=()):
    contract = json.loads(CONTRACT.read_text())
    actual = inventory(path, workflows)
    by_id = {t['id']: t for t in actual['tablas']}
    for column in planned:
        table = by_id.get(column['tableId'])
        if not table or table['nombre'] != column['table'] or column['name'] in table['columnas']:
            raise RuntimeError('Plan de columnas incompatible con esquema actual')
        table['columnas'][column['name']] = column['type']
    spec = importlib.util.spec_from_file_location('comparador_esquema', CHECKER)
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    result = checker.comparar(actual, contract)
    if not result['ok']:
        raise RuntimeError('Esquema productivo incompleto, tipo incompatible o referencia no resuelta; no se aplicó el lote')
    return result
