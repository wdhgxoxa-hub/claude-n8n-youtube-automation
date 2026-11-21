#!/usr/bin/env python3
"""Ensaya una actualización real de esquema y la reversa en copias SQLite sin red."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid

import operar


def command(args, timeout=180):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    operar.require(result.returncode == 0, 'Falló un paso del ensayo; no se muestra salida privada')
    return result.stdout.strip()


def count(path):
    with contextlib.closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        operar.require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)], 'Integridad SQLite incorrecta')
        operar.require(db.execute('PRAGMA foreign_key_check').fetchall() == [], 'Claves foráneas incorrectas')
        names = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        return {name: db.execute('SELECT count(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0] for name in names}


def preserve(before, after):
    for name, rows in before.items():
        if name != '__drizzle_migrations' and not name.startswith('sqlite_'):
            operar.require(after.get(name) == rows, 'Cambió el conteo de una tabla anterior')


def boot(image, data, engine):
    # El ensayo nunca publica puertos ni tiene acceso a redes/proveedores externos.
    name = 'cooper-migracion-' + uuid.uuid4().hex[:12]
    command([engine, 'image', 'inspect', image, '--format', '{{.Id}}'])
    args = [engine, 'run', '-d', '--name', name, '--network', 'none', '--read-only',
            '--userns', 'keep-id', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
            '--tmpfs', '/tmp:rw,size=128m,mode=1777', '--tmpfs', '/app/.next/cache:rw,size=64m,mode=1777',
            '-v', str(data) + ':/data:rw', '-e', 'COOPER_DATABASE_PATH=/data/cooper.sqlite',
            '-e', 'COOPER_FABRICA=simulada', '-e', 'COOPER_CHAT=simulada',
            '-e', 'COOPER_MENSAJERIA_PAUSA=1', '-e', 'COOPER_CHAT_API_RESPALDO=0',
            '-e', 'AUTH_SECRET=' + secrets.token_hex(32), '-e', 'AUTH_TRUST_HOST=true', image]
    try:
        command(args)
        end = time.monotonic() + 90
        healthy = False
        while time.monotonic() < end:
            r = subprocess.run([engine, 'exec', name, 'node', '-e', "fetch('http://127.0.0.1:3000/api/salud').then(async r=>process.exit(r.ok&&(await r.json()).ok?0:1),()=>process.exit(1))"], capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                healthy = True
                break
            time.sleep(1)
        operar.require(healthy, 'La imagen no supera salud en la copia aislada')
        # Una segunda lectura prueba idempotencia de migraciones en el mismo proceso.
        command([engine, 'exec', name, 'node', '-e', "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"])
    finally:
        subprocess.run([engine, 'stop', '--time', '15', name], capture_output=True, timeout=30)
        subprocess.run([engine, 'rm', name], capture_output=True, timeout=30)


def rehearse(source, new_image, old_image, destination, engine='podman'):
    operar.require(engine == 'podman', 'Ensayo exclusivo en Podman rootless')
    operar.require(os.geteuid() != 0, 'No ejecutar este ensayo como root')
    for image in (new_image, old_image):
        operar.require(bool(re.fullmatch(r'localhost/cooper:[a-zA-Z0-9._-]+', image)), 'Usar imagen local explícita')
    source = source.resolve()
    destination = destination.resolve()
    operar.require(source.is_file() and not destination.exists(), 'Origen regular y destino nuevo requeridos')
    operar.require(not destination.is_relative_to(source.parent), 'El ensayo debe estar fuera del origen')
    destination.mkdir(parents=True, mode=0o700)
    original = destination / 'original'
    original.mkdir(mode=0o700)
    # Backup SQLite incorpora WAL de la copia restaurada; no consulta filas privadas.
    with contextlib.closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as read:
        with contextlib.closing(sqlite3.connect(original / 'cooper.sqlite')) as write:
            read.backup(write)
    baseline = count(original / 'cooper.sqlite')
    original_hash = operar.digest(original / 'cooper.sqlite')
    upgrade = destination / 'actualizada'
    shutil.copytree(original, upgrade)
    boot(new_image, upgrade, engine)
    after = count(upgrade / 'cooper.sqlite')
    preserve(baseline, after)
    operar.require(after.get('__drizzle_migrations', 0) >= baseline.get('__drizzle_migrations', 0), 'Diario de migraciones regresó')
    # Recuperar los bytes del respaldo a OTRO directorio; conservar copia actualizada.
    rollback = destination / 'revertida'
    shutil.copytree(original, rollback)
    operar.require(operar.digest(rollback / 'cooper.sqlite') == original_hash, 'Reversa no coincide con respaldo')
    boot(old_image, rollback, engine)
    reverted = count(rollback / 'cooper.sqlite')
    operar.require(reverted == baseline, 'La reversa cambió los conteos originales')
    result = {'actualizacion': 'PASS', 'reversion': 'PASS', 'red': 'none', 'puertos': [],
              'imagen_nueva': new_image, 'imagen_anterior': old_image, 'respaldo_sha256': original_hash,
              'migraciones_antes': baseline.get('__drizzle_migrations'), 'migraciones_despues': after.get('__drizzle_migrations'),
              'tablas_anteriores_conservadas': len([x for x in baseline if x != '__drizzle_migrations' and not x.startswith('sqlite_')]),
              'integridad': 'PASS', 'claves_foraneas': 'PASS'}
    operar.write_json(destination / 'resultado.json', result)
    return result


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True, type=Path, help='SQLite proveniente de copia restaurada, nunca volumen vivo')
    parser.add_argument('--imagen', required=True)
    parser.add_argument('--anterior', required=True)
    parser.add_argument('--salida', required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.base, args.imagen, args.anterior, args.salida)))
    except (OSError, ValueError, RuntimeError, sqlite3.Error, subprocess.SubprocessError):
        print('Ensayo fallido; copias conservadas, producción intacta', file=sys.stderr)
        sys.exit(1)
