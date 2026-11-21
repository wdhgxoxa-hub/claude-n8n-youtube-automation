#!/usr/bin/env python3
"""Anexa configuración privada de Marcas sin abrir el entorno para lectura."""
import argparse
from contextlib import closing
import fcntl
import json
import os
from pathlib import Path
import secrets
import sqlite3
import stat
import sys

WORKFLOWS = ('CooperMarcasPub1', 'CooperMarcasMet1')
VARIABLES = ['COOPER_MARCAS_WORKER_SECRET', 'COOPER_MARCAS', 'COOPER_MARCAS_HABILITAR']


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def write_marker(path, value):
    temporary = path.with_suffix('.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'w') as output:
            json.dump(value, output)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def preflight(cooper, n8n):
    with closing(sqlite3.connect(n8n.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        rows = db.execute('SELECT id,active,activeVersionId FROM workflow_entity WHERE id IN (?,?)', WORKFLOWS).fetchall()
        require(len(rows) == 2 and all(not active and version is None for _, active, version in rows), 'Los trabajadores deben existir y permanecer sin publicar')
    with closing(sqlite3.connect(cooper.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        counts = {table: db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in ('cuentas_marca', 'piezas_marca', 'marca_ingestas')}
    require(not any(counts.values()), 'Hay cuentas o trabajos Marcas; revisar antes de configurar')
    return counts


def configure(environment, state, cooper, n8n):
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    marker = state / 'marcas-worker-configurado.json'
    lock = os.open(state / 'operacion.lock', os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        metadata = environment.lstat()
        require(stat.S_ISREG(metadata.st_mode) and stat.S_IMODE(metadata.st_mode) == 0o600 and metadata.st_uid == os.geteuid(), 'El entorno debe ser regular, propio y 0600')
        identity = [metadata.st_dev, metadata.st_ino]
        if marker.exists():
            previous = json.loads(marker.read_text())
            require(previous.get('estado') == 'configurado', 'Configuración interrumpida: revisar marcador, sin regenerar')
            require(previous.get('archivo') == str(environment) and previous.get('identidad') == identity and metadata.st_size >= previous.get('bytes_despues', 0), 'El entorno cambió de archivo o fue truncado: revisar sin regenerar')
            return {'estado': 'YA_CONFIGURADO', 'variables': VARIABLES, 'entorno_leido': False}
        counts = preflight(cooper, n8n)
        receipt = {'version': 1, 'estado': 'preparado', 'archivo': str(environment), 'identidad': identity, 'bytes_antes': metadata.st_size, 'variables': VARIABLES}
        # Un corte entre anexo y recibo deja "preparado": la siguiente ejecución no regenera.
        write_marker(marker, receipt)
        fd = os.open(environment, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
        try:
            current = os.fstat(fd)
            require([current.st_dev, current.st_ino] == identity and current.st_size == metadata.st_size, 'El entorno cambió durante la preparación')
            payload = ('\nCOOPER_MARCAS_WORKER_SECRET=' + secrets.token_hex(32) + '\nCOOPER_MARCAS=simulada\nCOOPER_MARCAS_HABILITAR=0\n').encode()
            with os.fdopen(fd, 'ab', closefd=False) as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            receipt.update(estado='configurado', bytes_despues=os.fstat(fd).st_size)
        finally:
            os.close(fd)
        write_marker(marker, receipt)
        return {'estado': 'CONFIGURADO', 'variables': VARIABLES, 'workers_publicados': 0, 'conteos_previos': counts, 'entorno_leido': False, 'proveedor': 'simulada', 'interruptor': '0'}
    finally:
        os.close(lock)


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--entorno', type=Path, default=Path('/etc/cooper/.env'))
    parser.add_argument('--estado', type=Path, default=Path('/var/lib/cooper-operacion'))
    parser.add_argument('--cooper-db', type=Path, default=Path('/var/lib/cooper/cooper/cooper.sqlite'))
    parser.add_argument('--n8n-db', type=Path, default=Path('/var/lib/cooper/n8n/database.sqlite'))
    args = parser.parse_args()
    try:
        print(json.dumps(configure(args.entorno, args.estado, args.cooper_db, args.n8n_db)))
    except (OSError, ValueError, RuntimeError, sqlite3.Error):
        print('Configuración detenida: comprobar condiciones y marcador. No se leyó ni mostró el entorno.', file=sys.stderr)
        sys.exit(1)
