#!/usr/bin/env python3
"""Actualiza solo Cooper y su relé, con copia y reversa; no opera n8n ni Caddy.

Ejecutar en el VPS como root. Docker consume el entorno existente; este script
no lo lee, exporta ni copia. El bloqueo es el mismo que usa operar.py.
"""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import time
import urllib.request

STATE = Path('/var/lib/cooper-operacion')
DATA = Path('/var/lib/cooper/cooper')
DEPLOY = Path('/opt/cooper/deploy')
SERVICES = ('cooper', 'chat-cooper')
UNCHANGED = ('cooper-n8n-1', 'cooper-runner-1', 'cooper-caddy-1',
             'cooper-chat-n8n-1', 'cooper-chat-runner-1')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(args, timeout=240, env=None):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
    require(p.returncode == 0, 'Falló un comando operativo; salida privada omitida')
    return p.stdout.strip()


def inspect(name, fmt):
    return run(['docker', 'inspect', '--format', fmt, name])


def compose(image, *args):
    env = dict(os.environ, COOPER_IMAGE=image)
    command = ['docker', 'compose', '--env-file', '/etc/cooper/.env',
               '-f', str(DEPLOY / 'compose.yaml')]
    if (STATE / 'chat-tunel.enabled').exists():
        command += ['-f', str(DEPLOY / 'compose.chat.yaml')]
    return run(command + list(args), env=env)


def start(image):
    # Enumerar solo estos servicios, nunca ejecutar up/stop sobre todo el stack.
    services = SERVICES if (STATE / 'chat-tunel.enabled').exists() else SERVICES[:1]
    compose(image, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never',
            '--wait', '--wait-timeout', '180', *services)


def stop():
    names = ['cooper-cooper-1']
    if (STATE / 'chat-tunel.enabled').exists():
        names.insert(0, 'cooper-chat-cooper-1')
    for name in names:
        run(['docker', 'stop', '--time', '150', name])


def counts(path):
    with contextlib.closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
        require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)], 'SQLite no íntegra')
        require(not db.execute('PRAGMA foreign_key_check').fetchall(), 'Claves foráneas incorrectas')
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        return {name: db.execute('SELECT count(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0]
                for name in tables}


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def boot_isolated(image, directory):
    name = 'cooper-reversa-' + str(time.time_ns())
    # AUTH_SECRET es ficticio, exclusivo del ensayo sin red; nunca usa el del VPS.
    env = dict(os.environ, AUTH_SECRET=os.urandom(32).hex())
    try:
        run(['docker', 'run', '-d', '--name', name, '--network', 'none', '--read-only',
             '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
             '--tmpfs', '/tmp:size=128m,mode=1777', '--tmpfs', '/app/.next/cache:size=64m,mode=1777',
             '-v', str(directory) + ':/data', '-e', 'AUTH_SECRET', '-e', 'AUTH_TRUST_HOST=true',
             '-e', 'COOPER_DATABASE_PATH=/data/cooper.sqlite', '-e', 'COOPER_FABRICA=simulada',
             '-e', 'COOPER_CHAT=simulada', '-e', 'COOPER_MENSAJERIA_PAUSA=1',
             '-e', 'COOPER_CHAT_API_RESPALDO=0', image], env=env)
        end = time.monotonic() + 90
        while time.monotonic() < end:
            p = subprocess.run(['docker', 'exec', name, 'node', '-e',
                                "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"],
                               capture_output=True, timeout=10)
            if p.returncode == 0:
                return
            time.sleep(1)
        raise RuntimeError('La copia aislada no arranca')
    finally:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=30)


def owned_copy(source, target):
    shutil.copytree(source, target, ignore=shutil.ignore_patterns('*-shm'))
    for path in [target, *target.rglob('*')]:
        require(not path.is_symlink(), 'No se admiten enlaces en los datos')
        os.chown(path, 1000, 1000)


def save(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    temp.replace(path)


def deploy(image, expected):
    require(os.geteuid() == 0, 'Ejecutar como root en el VPS')
    require(re.fullmatch(r'localhost/cooper:[0-9a-f]{40}', image), 'Exigir SHA Git completo')
    require(re.fullmatch(r'sha256:[0-9a-f]{64}', expected), 'Exigir imagen anterior explícita')
    require(not (STATE / 'mantenimiento').exists(), 'Otra misión mantiene el VPS cerrado')
    previous = inspect('cooper-cooper-1', '{{.Config.Image}}')
    require(inspect('cooper-cooper-1', '{{.Image}}') == expected, 'Cooper cambió desde la revisión')
    run(['docker', 'image', 'inspect', image, '--format', '{{.Id}}'])
    identity = '{{.Id}}|{{.Image}}|{{.State.StartedAt}}'
    before = {name: inspect(name, identity) for name in UNCHANGED}
    output = STATE / ('solo-cooper-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()))
    output.mkdir(mode=0o700)
    release = STATE / 'release.json'
    prior_release = json.loads(release.read_text()) if release.exists() else None
    save(output / 'anterior.json', {'image': previous, 'id': expected, 'release': prior_release})
    # Caddy no cambia. Se conserva su configuración de referencias, no certificados ni claves.
    caddy_hash = digest(DEPLOY / 'Caddyfile')
    shutil.copy2(DEPLOY / 'Caddyfile', output / 'Caddyfile')
    (STATE / 'mantenimiento').touch(mode=0o600)
    backed_up = False
    try:
        stop()
        owned_copy(DATA, output / 'respaldo')
        backed_up = True
        baseline = counts(output / 'respaldo/cooper.sqlite')
        # Ensayar la imagen nueva y arrancar la anterior restaurada ANTES de abrir tráfico.
        owned_copy(output / 'respaldo', output / 'ensayo-nueva')
        boot_isolated(image, output / 'ensayo-nueva')
        migrated = counts(output / 'ensayo-nueva/cooper.sqlite')
        for table, rows in baseline.items():
            if table != '__drizzle_migrations' and not table.startswith('sqlite_'):
                require(migrated.get(table) == rows, 'La migración alteró conteos anteriores')
        owned_copy(output / 'respaldo', output / 'ensayo-reversa')
        require(digest(output / 'respaldo/cooper.sqlite') == digest(output / 'ensayo-reversa/cooper.sqlite'),
                'La restauración difiere del respaldo')
        boot_isolated(previous, output / 'ensayo-reversa')
        require(counts(output / 'ensayo-reversa/cooper.sqlite') == baseline, 'La reversa alteró los conteos')
        start(image)
        with urllib.request.urlopen('https://cooper.cooperestudio.com/api/salud', timeout=30) as r:
            require(r.status == 200 and json.load(r).get('ok') is True, 'Salud pública incorrecta')
        after = {name: inspect(name, identity) for name in UNCHANGED}
        require(before == after, 'Cambió un servicio ajeno durante el corte')
        require(digest(DEPLOY / 'Caddyfile') == caddy_hash, 'Caddy cambió durante el corte')
        actual = counts(DATA / 'cooper.sqlite')
        require(actual.get('__drizzle_migrations') == migrated.get('__drizzle_migrations'),
                'El diario desplegado difiere del ensayo')
        save(release, {'image': image})
        result = {'resultado': 'PASS', 'imagen': image, 'anterior': previous, 'respaldo': str(output / 'respaldo'),
                  'respaldo_sha256': digest(output / 'respaldo/cooper.sqlite'), 'reversa_aislada': 'PASS',
                  'migraciones_antes': baseline.get('__drizzle_migrations'),
                  'migraciones_despues': migrated.get('__drizzle_migrations'),
                  'tablas_anteriores_conservadas': sum(t != '__drizzle_migrations' and not t.startswith('sqlite_') for t in baseline),
                  'servicios_antes': before, 'servicios_despues': after,
                  'imagen_id_desplegada': inspect('cooper-cooper-1', '{{.Image}}'),
                  'servicios_ajenos_sin_cambios': before == after, 'caddy_sin_cambios': True,
                  'fecha_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        save(output / 'resultado.json', result)
        return result
    except Exception:
        # Conservar escrituras del intento antes de recuperar el respaldo frío.
        stop()
        if backed_up:
            DATA.rename(output / 'datos-del-intento')
            owned_copy(output / 'respaldo', DATA)
        start(previous)
        if prior_release is None:
            release.unlink(missing_ok=True)
        else:
            save(release, prior_release)
        save(output / 'resultado.json', {'resultado': 'REVERTIDO', 'anterior': previous})
        raise
    finally:
        # Solo retirar mantenimiento si Cooper vuelve a estar saludable.
        if inspect('cooper-cooper-1', '{{.State.Health.Status}}') == 'healthy':
            (STATE / 'mantenimiento').unlink(missing_ok=True)


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--imagen', required=True)
    parser.add_argument('--anterior-id', required=True)
    args = parser.parse_args()
    try:
        with (STATE / 'operacion.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            print(json.dumps(deploy(args.imagen, args.anterior_id)))
    except BlockingIOError:
        print('VPS ocupado por otra operación; no se modificó ningún servicio.')
        raise SystemExit(2) from None
    except RuntimeError as error:
        # Estos mensajes se construyen exclusivamente aquí, nunca con stderr privado.
        print(str(error))
        raise SystemExit(1) from None
    except (OSError, ValueError, subprocess.SubprocessError):
        print('No se completó el despliegue. Revisar el recibo seguro; no se muestran datos privados.')
        raise SystemExit(1) from None
