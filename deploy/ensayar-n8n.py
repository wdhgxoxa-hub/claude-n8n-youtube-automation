#!/usr/bin/env python3
"""Ensaya columnas/importación n8n y restaura bytes de SQLite, siempre sin red."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import uuid

import operar

IMAGE = 'ghcr.io/n8n-io/n8n:2.47.4'
DUMMY_KEY = 'clave-ficticia-ensayo-offline-sin-credenciales-00000000'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=lambda x: {'bytes': x.hex()}).encode()).hexdigest()


def identifier(value):
    return '"' + value.replace('"', '""') + '"'


def inventory(path, original_columns=None):
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        operar.require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)], 'Integridad incorrecta')
        operar.require(db.execute('PRAGMA foreign_key_check').fetchall() == [], 'Claves foráneas incorrectas')
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        counts = {name: db.execute('SELECT count(*) FROM ' + identifier(name)).fetchone()[0] for name in tables}
        # Nunca selecciona datos de credentials_entity ni configuraciones privadas.
        flows = {r[0]: list(r[1:]) for r in db.execute('SELECT id,active,versionId,activeVersionId,versionCounter FROM workflow_entity ORDER BY id')}
        columns, hashes = {}, {}
        for name in tables:
            if not name.startswith('data_table_user_'):
                continue
            columns[name] = original_columns[name] if original_columns and name in original_columns else [r[1] for r in db.execute('PRAGMA table_info(' + identifier(name) + ')')]
            fields = ','.join(identifier(c) for c in columns[name])
            # Solo huellas; las filas de las tablas de negocio nunca se imprimen ni guardan.
            rows = sorted(digest(list(row)) for row in db.execute('SELECT ' + fields + ' FROM ' + identifier(name)))
            hashes[name] = digest(rows)
        return {'conteos': counts, 'flujos': flows, 'columnas': columns, 'datos': hashes}


def run_container(data, entry, manifest, column_script, entrypoint, args):
    name = 'cooper-ensayo-n8n-' + uuid.uuid4().hex[:12]
    command = ['podman', 'run', '--rm', '--pull', 'never', '--name', name,
               '--network', 'none', '--read-only', '--userns', 'keep-id',
               '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
               '--tmpfs', '/tmp:rw,size=128m,mode=1777',
               '-v', str(data) + ':/home/node/.n8n:rw',
               '-v', str(entry) + ':/entrada/workflows.json:ro',
               '-v', str(manifest) + ':/entrada/columnas.json:ro',
               '-v', str(column_script) + ':/ensayo/n8n-columnas.cjs:ro',
               '-e', 'N8N_ENCRYPTION_KEY=' + DUMMY_KEY,
               '-e', 'N8N_DIAGNOSTICS_ENABLED=false', '-e', 'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
               '-e', 'N8N_TEMPLATES_ENABLED=false', '-e', 'N8N_LOG_LEVEL=error',
               '--entrypoint', entrypoint, IMAGE, *args]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=180)
        operar.require(result.returncode == 0, 'Falló paso CLI aislado; salida privada suprimida')
        return result.stdout
    finally:
        subprocess.run(['podman', 'rm', '-f', name], capture_output=True, timeout=30)


def column_result(output):
    for line in reversed(output.splitlines()):
        try:
            result = json.loads(line)
        except ValueError:
            continue
        if isinstance(result, dict) and 'columnas' in result:
            return result
    raise RuntimeError('No hubo resultado de columnas')


def validate_import(before, after, target_ids):
    operar.require(set(before['flujos']) | target_ids == set(after['flujos']), 'Cambió un ID ajeno al lote')
    for flow_id, metadata in before['flujos'].items():
        if flow_id not in target_ids:
            operar.require(after['flujos'][flow_id] == metadata, 'Cambió un workflow ajeno al lote')
    for flow_id in target_ids:
        metadata = after['flujos'][flow_id]
        operar.require(not metadata[0] and bool(metadata[1]), 'Importación activa o sin versión')
    operar.require(before['datos'] == after['datos'], 'Cambió contenido de tablas de negocio')
    for name in ('credentials_entity', 'execution_entity', 'execution_data', 'user'):
        operar.require(before['conteos'].get(name) == after['conteos'].get(name), 'Cambió conteo ajeno al lote')


def rehearse(source, entry, manifest, column_script, destination):
    operar.require(os.geteuid() != 0, 'Solo Podman rootless')
    source, entry, manifest, column_script, destination = [p.resolve() for p in (source, entry, manifest, column_script, destination)]
    operar.require(all(p.is_file() for p in (source, entry, manifest, column_script)), 'Falta entrada regular')
    operar.require(not destination.exists() and not destination.is_relative_to(source.parent), 'Destino nuevo fuera del origen requerido')
    # La entrada se consume opacamente; no se muestra contenido ni referencias de credenciales.
    workflows = json.loads(entry.read_text())
    operar.require(isinstance(workflows, list) and workflows, 'Lote vacío o inválido')
    ids = {flow['id'] for flow in workflows}
    operar.require(len(ids) == len(workflows) and all(isinstance(x, str) and x for x in ids), 'IDs inválidos o duplicados')
    operar.require(all(flow.get('active') is False for flow in workflows), 'El lote debe entrar inactivo')
    destination.mkdir(mode=0o700, parents=True)
    original = destination / 'original'
    original.mkdir(mode=0o700)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as read:
        with closing(sqlite3.connect(original / 'database.sqlite')) as write:
            read.backup(write)
    baseline = inventory(original / 'database.sqlite')
    original_hash = operar.digest(original / 'database.sqlite')
    work = destination / 'actualizada'
    shutil.copytree(original, work)
    def cli(entrypoint, *args):
        return run_container(work, entry, manifest, column_script, entrypoint, list(args))
    planned = column_result(cli('node', '/ensayo/n8n-columnas.cjs', '/entrada/columnas.json'))
    applied = column_result(cli('node', '/ensayo/n8n-columnas.cjs', '/entrada/columnas.json', '--aplicar', '--diario', '/home/node/.n8n/columnas-diario.json'))
    operar.require(planned['columnas'] == applied['columnas'], 'Cambió el plan de columnas')
    again = column_result(cli('node', '/ensayo/n8n-columnas.cjs', '/entrada/columnas.json'))
    operar.require(not again['columnas'], 'Columnas no idempotentes')
    cli('n8n', 'import:workflow', '--input=/entrada/workflows.json')
    upgraded = inventory(work / 'database.sqlite', baseline['columnas'])
    validate_import(baseline, upgraded, ids)
    rollback = destination / 'revertida'
    shutil.copytree(original, rollback)
    restored_hash = operar.digest(rollback / 'database.sqlite')
    operar.require(restored_hash == original_hash, 'Reversa distinta del respaldo')
    restored = inventory(rollback / 'database.sqlite')
    operar.require(restored == baseline, 'Reversa distinta en conteos, datos o IDs/active/version')
    result = {'aplicacion': 'PASS', 'reversion': 'PASS', 'red': 'none', 'puertos': [], 'imagen': IMAGE,
              'columnas_agregadas': len(applied['columnas']), 'idempotencia_columnas': 'PASS',
              'flujos_importados': len(ids), 'flujos_antes': len(baseline['flujos']), 'flujos_despues': len(upgraded['flujos']),
              'flujos_importados_inactivos': True, 'flujos_ajenos_preservados': 'PASS',
              'tablas_negocio_preservadas': len(baseline['datos']), 'filas_tablas_negocio': sum(baseline['conteos'][n] for n in baseline['datos']),
              'tablas_restauradas': len(baseline['conteos']), 'integridad_y_claves_foraneas': 'PASS',
              'respaldo_sha256': original_hash, 'restauracion_sha256': restored_hash,
              'workflow_ids_active_version_sha256': digest(baseline['flujos']),
              'tablas_negocio_sha256': digest(baseline['datos']), 'entrada_sha256': operar.digest(entry), 'manifiesto_sha256': operar.digest(manifest)}
    operar.write_json(destination / 'resultado.json', result)
    return result


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ('base', 'entrada', 'manifiesto', 'columnas', 'salida'):
        parser.add_argument('--' + arg, required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.base, args.entrada, args.manifiesto, args.columnas, args.salida)))
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, sqlite3.Error, subprocess.SubprocessError):
        print('Ensayo n8n fallido; copias conservadas y producción intacta. No se muestra salida privada.', file=sys.stderr)
        sys.exit(1)
