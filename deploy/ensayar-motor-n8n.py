#!/usr/bin/env python3
"""Migra una copia n8n con el CLI oficial y prueba reversa sin red ni ejecución."""
import argparse
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import uuid

import operar

DEPLOY = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('ensayo_n8n_motor_inventario', DEPLOY / 'ensayar-n8n.py')
inventory_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory_module)
IMAGES = json.loads((DEPLOY / 'infra-imagenes.json').read_text())['servicios']['n8n']


def initialize(image, data):
    name = 'cooper-motor-ensayo-' + uuid.uuid4().hex[:12]
    command = ['podman', 'run', '--rm', '--pull=never', '--name', name,
               '--network=none', '--read-only', '--userns=keep-id', '--cpus=0.5',
               '--memory=1g', '--pids-limit=200', '--cap-drop=ALL',
               '--security-opt=no-new-privileges', '--tmpfs=/tmp:rw,size=128m,mode=1777',
               '-v', str(data) + ':/home/node/.n8n:rw',
               '-e', 'N8N_ENCRYPTION_KEY=' + inventory_module.DUMMY_KEY,
               '-e', 'N8N_DIAGNOSTICS_ENABLED=false', '-e', 'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
               '-e', 'N8N_TEMPLATES_ENABLED=false', '-e', 'N8N_LOG_LEVEL=error',
               '--entrypoint=n8n', image, 'export:workflow', '--all', '--output=/dev/null']
    # El CLI inicializa/migra la base, pero no arranca triggers ni descifra credenciales.
    # Descarta las definiciones sin copiar/exportar valores a un artefacto.
    try:
        result = subprocess.run(command, capture_output=True, timeout=240)
        operar.require(result.returncode == 0, 'Falló inicialización CLI aislada; salida privada suprimida')
    finally:
        subprocess.run(['podman', 'rm', '-f', name], capture_output=True, timeout=30)


def preserve(before, after):
    operar.require(before['flujos'] == after['flujos'], 'Cambió estado o versión de workflows')
    operar.require(before['datos'] == after['datos'], 'Cambió contenido de tablas de negocio')
    for table, count in before['conteos'].items():
        if table not in ('migrations', 'sqlite_sequence'):
            operar.require(after['conteos'].get(table) == count, 'Cambió un conteo previo')
    operar.require(after['conteos'].get('migrations', 0) >= before['conteos'].get('migrations', 0), 'Regresó el diario de migraciones')


def rehearse(source, destination):
    operar.require(os.geteuid() != 0, 'Solo Podman rootless')
    source, destination = source.resolve(), destination.resolve()
    operar.require(source.is_file() and not destination.exists(), 'Origen regular y destino nuevo requeridos')
    operar.require(not destination.is_relative_to(source.parent), 'Destino fuera del origen requerido')
    destination.mkdir(parents=True, mode=0o700)
    original = destination / 'original'
    original.mkdir(mode=0o700)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as read:
        with closing(sqlite3.connect(original / 'database.sqlite')) as write:
            read.backup(write)
    baseline = inventory_module.inventory(original / 'database.sqlite')
    before_hash = operar.digest(original / 'database.sqlite')
    updated = destination / 'actualizada'
    shutil.copytree(original, updated)
    initialize(IMAGES['imagen'], updated)
    after = inventory_module.inventory(updated / 'database.sqlite', baseline['columnas'])
    preserve(baseline, after)
    initialize(IMAGES['imagen'], updated)
    again = inventory_module.inventory(updated / 'database.sqlite', baseline['columnas'])
    operar.require(after == again, 'Inicialización no idempotente')
    rollback = destination / 'revertida'
    shutil.copytree(original, rollback)
    restored_hash = operar.digest(rollback / 'database.sqlite')
    operar.require(restored_hash == before_hash, 'Reversa no coincide con los bytes del respaldo')
    initialize(IMAGES['anterior'], rollback)
    restored = inventory_module.inventory(rollback / 'database.sqlite')
    operar.require(restored == baseline, 'La imagen anterior no conserva el inventario restaurado')
    result = {'migracion': 'PASS', 'reversion': 'PASS', 'idempotencia': 'PASS',
              'imagen_nueva': IMAGES['imagen'], 'imagen_anterior': IMAGES['anterior'],
              'red': 'none', 'puertos': [], 'cpus': 0.5, 'triggers_arrancados': False,
              'integridad_y_claves_foraneas': 'PASS', 'flujos_preservados': len(baseline['flujos']),
              'tablas_negocio_preservadas': len(baseline['datos']),
              'filas_negocio_preservadas': sum(baseline['conteos'][table] for table in baseline['datos']),
              'migraciones_antes': baseline['conteos'].get('migrations', 0),
              'migraciones_despues': after['conteos'].get('migrations', 0),
              'respaldo_sha256': before_hash, 'restauracion_sha256': restored_hash,
              'workflow_ids_active_version_sha256': inventory_module.digest(baseline['flujos']),
              'tablas_negocio_sha256': inventory_module.digest(baseline['datos'])}
    operar.write_json(destination / 'resultado.json', result)
    return result


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True, help='Copia SQLite restaurada, nunca base viva')
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.base, args.salida)))
    except (OSError, RuntimeError, ValueError, sqlite3.Error, subprocess.SubprocessError):
        print('Ensayo de motor detenido; copia conservada, producción intacta.', file=sys.stderr)
        sys.exit(1)
