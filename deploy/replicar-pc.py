#!/usr/bin/env python3
"""Replica el repositorio cifrado del VPS a la PC y prueba recuperación antes de promoverlo."""
import argparse
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time

import operar


def execute(command, **kwargs):
    result = subprocess.run(command, capture_output=True, text=True, timeout=3600, **kwargs)
    operar.require(result.returncode == 0, 'Falló réplica o recuperación; salida privada omitida')
    return result.stdout


def validate_repo(repo, password, restic, destination):
    operar.private_file(password)  # El binario recibe la ruta, nunca se lee la contraseña aquí.
    env = {**os.environ, 'RESTIC_REPOSITORY': str(repo), 'RESTIC_PASSWORD_FILE': str(password)}
    command = [str(restic), '--no-cache']
    execute(command + ['check', '--read-data'], env=env)
    snapshots = json.loads(execute(command + ['snapshots', '--host', 'cooper-vps', '--tag', 'cooper-vps', '--json'], env=env))
    operar.require(bool(snapshots), 'No hay snapshots de Cooper')
    latest = max(snapshots, key=lambda row: row['time'])
    snapshot = latest['id']
    operar.require(re.fullmatch('[0-9a-f]{64}', snapshot), 'ID snapshot inválido')
    execute(command + ['restore', snapshot, '--target', str(destination)], env=env)
    manifest = operar.verify(destination / 'datos')
    return {'snapshot': snapshot, 'restauracion': 'PASS', 'archivos': len(manifest['archivos']), 'bases': len(manifest['tablas']), 'snapshot_fecha': latest['time']}


def replicate(args):
    root = args.destino.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    operar.require(root != Path('/') and not root.is_relative_to(operar.DEPLOY.parent), 'Destino fuera del checkout requerido')
    operar.require(re.fullmatch(r'[a-z_][a-z0-9_-]*@[a-zA-Z0-9.-]+', args.servidor), 'Servidor SSH inválido')
    key = args.llave.expanduser().resolve()
    operar.private_file(key)
    ssh = ['ssh', '-i', str(key), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15']
    with (root / 'replica.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        generations = root / 'generaciones'
        generations.mkdir(mode=0o700, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='pendiente-', dir=generations) as tmp:
            candidate = Path(tmp) / 'repo'
            candidate.mkdir(mode=0o700)
            current = root / 'actual'
            extra = ['--link-dest', str(current.resolve())] if current.is_symlink() else []
            execute(['rsync', '-a', '--no-owner', '--no-group', '--exclude=locks/*', *extra, '-e', shlex.join(ssh), '--rsync-path=sudo -n flock -w 120 /var/lib/cooper-operacion/operacion.lock rsync', args.servidor + ':/var/backups/cooper-restic/', str(candidate) + '/'])
            verified = validate_repo(candidate, args.password.expanduser(), args.restic.expanduser(), Path(tmp) / 'restaurado')
            generation = generations / ('verificada-' + str(time.time_ns()))
            candidate.rename(generation)
            # El único puntero de recuperación cambia atómicamente tras restaurar/comparar.
            new_link = root / '.actual-nuevo'
            with contextlib.suppress(FileNotFoundError):
                new_link.unlink()
            new_link.symlink_to(generation.relative_to(root), target_is_directory=True)
            new_link.replace(current)
            verified['fecha'] = int(time.time())
            operar.write_json(root / 'ultima-replica.json', verified)
            if args.confirmar_vps:
                execute(ssh + [args.servidor, 'sudo -n python3 /opt/cooper/deploy/registrar-replica.py'], input=json.dumps(verified))
            # Dos generaciones verificadas; una caída o corrupción nunca sustituye la vigente.
            for old in sorted(generations.glob('verificada-*'), reverse=True)[2:]:
                if old.is_dir() and not old.is_symlink():
                    shutil.rmtree(old)
            return verified


def main():
    os.umask(0o077)
    home = Path.home()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--servidor', default='operador@144.91.88.253')
    parser.add_argument('--llave', type=Path, default=home / '.ssh/cooper_vps')
    parser.add_argument('--password', type=Path, default=home / '.config/cooper/restic-password')
    parser.add_argument('--restic', type=Path, default=home / '.cache/cooper-vps/bin/restic')
    parser.add_argument('--destino', type=Path, default=home / '.local/share/cooper-copias-vps')
    parser.add_argument('--confirmar-vps', action='store_true')
    print(json.dumps(replicate(parser.parse_args()), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.SubprocessError):
        print('Réplica no completada; la última copia verificada se conserva', file=sys.stderr)
        sys.exit(1)
