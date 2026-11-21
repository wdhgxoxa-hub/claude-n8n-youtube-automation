#!/usr/bin/env python3
"""Ensayo local de siete servicios: infra PASS → recuperar infra-only.

Solo Podman rootless, datos sintéticos, red interna, puertos loopback y un
checkout desechable bajo ~/.cache. No acepta ni copia entornos existentes.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler
from socketserver import ThreadingUnixStreamServer

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
import operar


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, DEPLOY / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


infra = load('infra_mixta', 'aplicar-infra.py')
recovery = load('recuperacion_mixta', 'recuperar-infra.py')
RELAYS = ('chat-cooper', 'chat-n8n', 'chat-runner')
ALL = ('cooper', 'n8n', 'runner', 'caddy', *RELAYS)


class LabOperator(operar.Operator):
    def compose(self, *args, **kwargs):
        # Adaptación exclusiva del laboratorio, heredada de infra-aplicador:
        # Podman exige eliminar dependientes detenidos antes de recrear padres.
        parents = ('cooper', 'n8n', 'runner')
        whole_up = args and args[0] == 'up' and (not any(name in args for name in ALL) or any(name in args for name in parents))
        if args and (args[0] == 'down' or whole_up):
            if args[0] == 'down':
                super().compose('stop', *RELAYS, **kwargs)
            running = super().compose('ps', '--status', 'running', '--services', **kwargs).split()
            operar.require(not set(RELAYS).intersection(running), 'No retirar relés activos del laboratorio')
            super().compose('rm', '--force', *RELAYS, **kwargs)
        return super().compose(*args, **kwargs)


class FakeBridge(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'{"ensayo":true}'
        self.send_response(200); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def log_message(self, *_):
        pass


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); return s.getsockname()[1]


def setup(old_image, restic):
    base = Path.home() / '.cache/cooper-r7'
    base.mkdir(parents=True, exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix='e2e-vps-recuperacion-', dir=base))
    root.chmod(0o700)
    for directory in ('datos', 'operacion', 'repositorio', 'tunel'):
        (root / directory).mkdir(mode=0o700)
    for directory in operar.VOLUMENES:
        (root / 'datos' / directory).mkdir(mode=0o700)
    env = {
        'PATH': os.environ['PATH'], 'HOME': str(Path.home()),
        'DOCKER_HOST': 'unix://' + str(root / 'podman.sock'), 'CONTAINER_ENGINE': 'podman',
        'COOPER_LAB': '1', 'COMPOSE_PROJECT_NAME': 'cooper-vps-' + secrets.token_hex(5),
        'COOPER_IMAGE': old_image, 'DATA_ROOT': str(root / 'datos'), 'STATE_ROOT': str(root / 'operacion'),
        'PUBLIC_BIND': '127.0.0.1', 'COOPER_DOMAIN': 'cooper.test', 'N8N_DOMAIN': 'flujos.test',
        'HTTP_PORT': str(free_port()), 'HTTPS_PORT': str(free_port()), 'EDITOR_PORT': str(free_port()),
        'CADDY_TLS': 'internal', 'COOPER_ORIGIN': 'https://cooper.test', 'N8N_EDITOR_ORIGIN': 'https://flujos.test',
        'AUTH_GOOGLE_ID': '', 'AUTH_GOOGLE_SECRET': '', 'COOPER_ADMIN_EMAIL': 'fixture@example.test',
        'COOPER_FABRICA': 'simulada', 'COOPER_MARCAS': 'simulada', 'COOPER_MARCAS_HABILITAR': '0',
        'COOPER_MENSAJERIA_PAUSA': '1', 'COOPER_BIBLIOTECA_PAUSA': '1', 'COOPER_CHAT_API_RESPALDO': '0',
        'COOPER_RELE_UID': str(os.getuid()), 'COOPER_RELE_GID': str(os.getgid()),
        'COOPER_COMPOSE_OVERRIDE': str(root / 'compose.local.json'),
        'RESTIC_REPOSITORY': str(root / 'repositorio'), 'RESTIC_PASSWORD_FILE': str(root / 'restic-password'),
        'RESTIC_BIN': str(restic),
    }
    if os.environ.get('XDG_RUNTIME_DIR'): env['XDG_RUNTIME_DIR'] = os.environ['XDG_RUNTIME_DIR']
    for name in ('AUTH_SECRET', 'COOPER_N8N_TOKEN', 'COOPER_WEBHOOK_SECRET', 'N8N_ENCRYPTION_KEY', 'N8N_RUNNERS_AUTH_TOKEN', 'COOPER_MARCAS_WORKER_SECRET', 'PUENTE_CODEX_TOKEN'):
        env[name] = secrets.token_hex(32)
    filename = root / 'ensayo.env'
    filename.write_text(''.join(k + '=' + v + '\n' for k, v in env.items())); filename.chmod(0o600)
    (root / 'restic-password').write_text(secrets.token_hex(32)); (root / 'restic-password').chmod(0o600)
    local_caddy = root / 'Caddyfile.local'
    local_caddy.write_text((DEPLOY / 'Caddyfile').read_text().replace('{\n', '{\n\tocsp_stapling off\n', 1))
    override = {'networks': {'salida': {'internal': True}}, 'services': {}}
    for name in ALL:
        row = {'userns_mode': 'keep-id', 'runtime': 'runc', 'pull_policy': 'never',
               'cpus': 0.5, 'cpuset': '0-1', 'stop_grace_period': '15s',
               'healthcheck': {'start_period': '5s', 'interval': '3s', 'retries': 60}}
        if name in RELAYS:
            row.update(tmpfs=['/sys:ro,size=1m'], volumes=[str(root / 'tunel') + ':/tunel:ro'])
        elif name == 'cooper':
            row.update(memswap_limit='1g', environment={'COOPER_CHAT': 'simulada'})
        elif name == 'caddy':
            row['volumes'] = [str(local_caddy) + ':/etc/caddy/Caddyfile:ro']
        override['services'][name] = row
    operar.write_json(Path(env['COOPER_COMPOSE_OVERRIDE']), override)
    (root / 'operacion/chat-tunel.enabled').touch(mode=0o600)
    return LabOperator(env, filename), root, override


def check(op):
    identities = infra.healthy(op)
    result = {}
    for parent in ('cooper', 'n8n', 'runner'):
        ns = {}
        for name in (parent, 'chat-' + parent):
            cid = op.compose('ps', '-q', name).strip()
            code = "console.log(require('fs').readlinkSync('/proc/self/ns/net'))"
            ns[name] = operar.run([op.engine, 'exec', cid, 'node', '-e', code], env=op.env).strip()
        operar.require(len(set(ns.values())) == 1, 'Namespace del relé incorrecto')
        code = "Promise.all([fetch('http://127.0.0.1:8789/salud'),fetch('http://127.0.0.1:8789/salud',{headers:{authorization:'Bearer '+process.env.PUENTE_CODEX_TOKEN}})]).then(async r=>{if(r[0].status!==401||r[1].status!==200||(await r[1].json()).ensayo!==true)process.exit(1);console.log('PASS')}).catch(()=>process.exit(1))"
        cid = op.compose('ps', '-q', 'chat-' + parent).strip()
        operar.require(operar.run([op.engine, 'exec', cid, 'node', '-e', code], env=op.env).strip() == 'PASS', 'Falla transporte ficticio')
        result[parent] = ns
    cid = op.compose('ps', '-q', 'cooper').strip()
    code = "let f=require('fs');console.log(JSON.stringify([f.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),f.readFileSync('/sys/fs/cgroup/memory.swap.max','utf8').trim()]))"
    limits = json.loads(operar.run([op.engine, 'exec', cid, 'node', '-e', code], env=op.env))
    operar.require(limits == ['1073741824', '0'], 'Límite 1 GiB/swap0 incumplido')
    return {'servicios': identities, 'namespaces': result, 'reles_401_200': 'PASS', 'limites': limits}


def rehearse(proof, archive, old_image, restic):
    operar.require(os.geteuid() != 0 and DEPLOY.is_relative_to(Path.home() / '.cache'), 'Solo checkout local desechable y rootless')
    receipt = json.loads(proof.read_text()); images = infra.validate_bundle(DEPLOY, receipt)
    image = receipt['cooper_artefacto']['etiqueta']
    operar.require(operar.digest(archive) == receipt['cooper_artefacto']['sha256'], 'Artefacto de imagen diferente')
    op, root, override = setup(image, restic)
    print(json.dumps({'fixture': str(root)}), flush=True)
    originals = {name: (DEPLOY / name).read_bytes() for name in infra.FILES}
    candidate = root / 'candidato'; candidate.mkdir(mode=0o700)
    for name in infra.FILES: shutil.copyfile(DEPLOY / name, candidate / name)
    old = originals['compose.yaml'].decode()
    for item in images.values(): old = old.replace(item['imagen'], item['anterior'])
    server = ThreadingUnixStreamServer(str(root / 'tunel/puente.sock'), FakeBridge)
    server.daemon_threads = True
    (root / 'tunel/puente.sock').chmod(0o600)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    process = subprocess.Popen(['podman', '--runtime', 'runc', 'system', 'service', '--time=0', op.env['DOCKER_HOST']], env=op.env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = {'estado': 'INICIADO', 'fuente_imagen': image, 'imagen_archivo_sha256': operar.digest(archive),
              'codigo': {name: operar.digest(DEPLOY / name) for name in ('operar.py', 'aplicar-infra.py', 'recuperar-infra.py')},
              'codigo_arnes_sha256': operar.digest(Path(__file__)), 'vps_accedido': False, 'datos_sinteticos': True}
    try:
        for _ in range(100):
            if (root / 'podman.sock').exists(): break
            time.sleep(.1)
        with op.lock():
            op.restic('init')
            (DEPLOY / 'compose.yaml').write_text(old)
            # Estado mixto del scoped real; no crear anterior.json global ficticio.
            operar.write_json(op.release, {'image': image})
            for name in ('chat-n8n', 'chat-runner'): override['services'][name]['image'] = old_image
            operar.write_json(Path(op.env['COOPER_COMPOSE_OVERRIDE']), override)
            op.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '240')
            # n8n export:workflow exige al menos un flujo. Semilla manual,
            # inactiva y sin credenciales/proveedores, exclusivamente del fixture.
            seed = op.data / 'n8n/recuperacion-ficticia.json'
            operar.write_json(seed, [{'id': 'CoopRecovery0001', 'name': 'Recuperación ficticia local', 'active': False,
                'nodes': [{'id': 'inicio', 'name': 'Inicio', 'type': 'n8n-nodes-base.manualTrigger', 'typeVersion': 1, 'position': [0, 0], 'parameters': {}}],
                'connections': {}, 'settings': {'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none'}}])
            op.compose('stop')
            op.compose('run', '--rm', '--no-deps', '-T', '--entrypoint', 'n8n', 'n8n', 'import:workflow', '--input=/home/node/.n8n/recuperacion-ficticia.json')
            seed.unlink()
            op.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '240')
            result['mixto_previo'] = check(op)
            for name in ('chat-n8n', 'chat-runner'): del override['services'][name]['image']
            operar.write_json(Path(op.env['COOPER_COMPOSE_OVERRIDE']), override)
            pointer_hashes = {name: recovery.pointer_hash(op.state / name) for name in ('release.json', 'anterior.json')}
            applied_path = op.state / 'infra-pass.json'
            applied = infra.apply(op, candidate, receipt, applied_path, image_archive=archive)
            operar.require(applied['estado'] == 'PASS', 'Aplicación no aceptada')
            result['infra_aplicada'] = check(op)
            late = op.data / 'cooper/posterior-pass.txt'; late.write_text('Escritura ficticia posterior al PASS.\n')
            late_hash = operar.digest(late)
            recovered_path = op.state / 'recuperacion-pass.json'
            recovered = recovery.recover(op, applied_path, operar.digest(applied_path), recovered_path)
            result['infra_recuperada'] = check(op)
            operar.require(result['infra_recuperada']['servicios'] == result['mixto_previo']['servicios'], 'No se restauraron siete identidades mixtas')
            operar.require(pointer_hashes == {name: recovery.pointer_hash(op.state / name) for name in pointer_hashes}, 'Cambió puntero Cooper')
            archived = Path(recovered['datos_desplazados']) / 'cooper' / late.name
            operar.require(operar.digest(archived) == late_hash, 'Se perdió escritura posterior')
            restored = op.restore(recovered['snapshot_desplazado'], op.state / 'restauracion-desplazado')
            operar.require(operar.digest(restored / 'cooper' / late.name) == late_hash, 'Snapshot desplazado no restaurable')
            # Infra-only: reiniciar con el override explícito del recibo. No usar
            # Operator.rollback: el scoped no creó el puntero global anterior.
            operar.require(not (op.state / 'anterior.json').exists(), 'Se inventó un puntero global')
            rollback_images = Path(applied['respaldo_configuracion']).parent / 'imagenes-reversa.json'
            op.compose('stop')
            recovery.start_restored(op, rollback_images)
            result['arranque_explicito_infra_only'] = check(op)
            operar.require(result['arranque_explicito_infra_only']['servicios'] == result['mixto_previo']['servicios'], 'Arranque explícito cambió imágenes')
            operar.require(not (op.state / 'mantenimiento').exists(), 'Mantenimiento no retirado')
            result.update(estado='PASS', escritura_posterior_preservada='PASS', snapshot_desplazado_restaurable='PASS', punteros_cooper_conservados='PASS',
                          recuperacion_infra_only='PASS', arranque_explicito_infra_only_pass='PASS', anterior_global_ausente=True, override_transitorio_requerido=True, recibo_aplicacion=str(applied_path), recibo_recuperacion=str(recovered_path),
                          alcance='Podman real con adaptación de retirada de relés detenidos y /sys vacío solo lectura; no prueba Docker productivo ni SSH.')
            return result
    except Exception:
        result['estado'] = 'FALLO'
        import traceback
        (root / 'error-privado.log').write_text(traceback.format_exc())
        raise
    finally:
        try:
            op.compose('down', '--timeout', '30')
            result['limpieza'] = 'PASS'
        finally:
            for name, raw in originals.items(): (DEPLOY / name).write_bytes(raw)
            server.shutdown(); server.server_close(); thread.join(timeout=5)
            process.terminate()
            try: process.wait(timeout=15)
            except subprocess.TimeoutExpired: process.kill(); process.wait()
            operar.write_json(root / 'resultado.json', result)


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('ensayo', 'imagen-archivo', 'restic-bin'): parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--imagen-anterior', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.ensayo, args.imagen_archivo, args.imagen_anterior, args.restic_bin)))
    except Exception:
        print('Ensayo detenido; consultar el recibo privado sintético.', file=sys.stderr); sys.exit(1)
