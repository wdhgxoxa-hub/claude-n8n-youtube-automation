#!/usr/bin/env python3
"""Salud local y alertas firmadas; nunca imprime entornos ni salida de proveedores."""
import argparse
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import sys
import time
import urllib.request

import operar
import observabilidad

SERVICES = ('cooper', 'n8n', 'runner', 'caddy')
# El webhook es interno: Caddy no permite esta ruta y no se publica ningún puerto nuevo.
SEND = """let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{try{const r=await fetch('http://127.0.0.1:5678/webhook/cooper/v1/monitor',{method:'POST',headers:{'content-type':'application/json'},body:s,signal:AbortSignal.timeout(15000)});const j=await r.json();process.exit(r.ok&&j.ok===true?0:1)}catch{process.exit(1)}});"""


def age(path, now):
    try:
        row = json.loads(Path(path).read_text())
        if row.get('restauracion') != 'PASS':
            return None
        elapsed = now - int(row['fecha'])
        return elapsed if elapsed >= -300 else None
    except (OSError, ValueError, KeyError, TypeError):
        return None


def certificates_ok(env, now, observed=None):
    """Verifica ambos dominios públicos con CA/SNI y margen de renovación de 14 días."""
    try:
        context = ssl.create_default_context()
        healthy = True
        for key, name in (('COOPER_DOMAIN', 'cooper'), ('N8N_DOMAIN', 'n8n')):
            try:
                host = env[key]
                if not host:
                    raise ValueError('Dominio ausente')
                with socket.create_connection((host, 443), timeout=10) as connection:
                    with context.wrap_socket(connection, server_hostname=host) as secure:
                        expires = ssl.cert_time_to_seconds(secure.getpeercert()['notAfter'])
                        if observed is not None:
                            observed.setdefault('certificates', {})[name] = expires
                        if expires - now <= 14 * 86400:
                            healthy = False
            except (OSError, ValueError, KeyError, TypeError):
                healthy = False
        return healthy
    except (OSError, ValueError, KeyError, TypeError):
        return False


def issues(env, now, observed=None):
    problems = []
    project = env.get('COMPOSE_PROJECT_NAME', 'cooper')
    for service in SERVICES:
        try:
            result = subprocess.run(['docker', 'inspect', '--format', '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{.HostConfig.RestartPolicy.Name}}', f'{project}-{service}-1'], capture_output=True, text=True, timeout=15)
            healthy = result.returncode == 0 and result.stdout.strip() == 'running healthy unless-stopped'
        except (OSError, subprocess.SubprocessError):
            healthy = False
        if observed is not None:
            observed.setdefault('services', {})[service] = 'ok' if healthy else 'down'
        if not healthy:
            problems.append('servicio_' + service)
    # Código ya admitido por el workflow vivo: evita modificar flujos n8n.
    if not certificates_ok(env, now, observed):
        problems.append('servicio_caddy')
    data = Path(env['DATA_ROOT'])
    disk = shutil.disk_usage(data)
    if observed is not None:
        observed['disk'] = {'totalBytes': disk.total, 'freeBytes': disk.free}
    if disk.free < max(2 * 1024**3, disk.total * .1):
        problems.append('disco_bajo')
    state = Path(env['STATE_ROOT'])
    for filename, maximum, label in [('ultima-copia.json', 30 * 3600, 'copia_local'), ('ultima-replica.json', 36 * 3600, 'copia_remota')]:
        elapsed = age(state / filename, now)
        if observed is not None:
            observed.setdefault('backups', {})['copy' if label == 'copia_local' else 'replica'] = elapsed
        if elapsed is None or elapsed > maximum:
            problems.append(label)
    try:
        request = urllib.request.Request(env['COOPER_ORIGIN'].rstrip('/') + '/api/salud')
        with urllib.request.urlopen(request, timeout=15) as response:
            body = json.load(response)
            if response.status != 200 or not isinstance(body, dict) or body.get('ok') is not True:
                problems.append('https_cooper')
    except (OSError, ValueError):
        problems.append('https_cooper')
    return sorted(set(problems))


def public_snapshot(env, now, observed=None, maintenance=False):
    # El snapshot es aditivo: un montaje no disponible no impide alertas previas.
    # La web detecta explícitamente archivo ausente o fecha antigua.
    try:
        observabilidad.write_snapshot(env['STATE_ROOT'], now, observed, maintenance)
    except (OSError, ValueError):
        pass


def envelope(problems, now, secret, prueba=False):
    payload = json.dumps({'version': 1, 'fecha': now, 'problemas': problems, 'prueba': prueba}, ensure_ascii=True, separators=(',', ':'))
    signature = hmac.new(secret.encode(), ('cooper-monitor-v1\n' + payload).encode(), hashlib.sha256).hexdigest()
    return {'payload': payload, 'firma': signature}


def notify(env, problems, now, prueba=False):
    packet = envelope(problems, now, env['COOPER_WEBHOOK_SECRET'], prueba)
    try:
        result = subprocess.run(['docker', 'exec', '-i', env.get('COMPOSE_PROJECT_NAME', 'cooper') + '-n8n-1', 'node', '-e', SEND], input=json.dumps(packet), capture_output=True, text=True, timeout=25)
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def monitor(env, now=None, force=False, probe=False):
    now = int(time.time()) if now is None else now
    state = Path(env['STATE_ROOT'])
    state.mkdir(mode=0o700, exist_ok=True, parents=True)
    with (state / 'monitor.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # No alertar por la parada deliberada de una copia/migración. No mantener
        # el candado: las copias conservan prioridad sobre el sondeo periódico.
        with (state / 'operacion.lock').open('a') as operation:
            try:
                fcntl.flock(operation, fcntl.LOCK_SH | fcntl.LOCK_NB)
            except BlockingIOError:
                public_snapshot(env, now, maintenance=True)
                return {'fecha': now, 'problemas': [], 'entrega': None, 'salud': 'MANTENIMIENTO'}
        if (state / 'mantenimiento').exists():
            public_snapshot(env, now, maintenance=True)
            return {'fecha': now, 'problemas': [], 'entrega': None, 'salud': 'MANTENIMIENTO'}
        observed = {'memory': observabilidad.memory()}
        try:
            found = issues(env, now, observed)
        finally:
            public_snapshot(env, now, observed)
        path = state / 'monitor.json'
        previous = json.loads(path.read_text()) if path.exists() else {}
        changed = previous.get('notificados') != found
        due = now - previous.get('aviso_en', 0) >= 6 * 3600
        send = force or probe or previous.get('entrega') is False or (found and (changed or due)) or (not found and bool(previous.get('notificados')))
        delivered = notify(env, found, now, probe) if send else None
        result = {'fecha': now, 'problemas': found, 'notificados': previous.get('notificados'), 'aviso_en': previous.get('aviso_en', 0), 'entrega': delivered, 'salud': 'FAIL' if found else 'PASS'}
        # Un fallo de transporte conserva lo pendiente: se reintenta al próximo tick.
        if delivered and not probe:
            result.update(notificados=found, aviso_en=now)
        operar.write_json(path, result)
        return result


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', default='/etc/cooper/.env')
    parser.add_argument('--avisar', action='store_true')
    parser.add_argument('--prueba', action='store_true', help='Valida firma y transporte sin enviar Telegram')
    args = parser.parse_args()
    env, _ = operar.config(args.env)
    result = monitor(env, force=args.avisar, probe=args.prueba)
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result['problemas'] or result['entrega'] is False else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.SubprocessError):
        print('Monitor no disponible; revisar configuración o conexión', file=sys.stderr)
        sys.exit(1)
