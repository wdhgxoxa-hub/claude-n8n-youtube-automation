#!/usr/bin/env python3
"""Ensaya fallo y actualización infra en un fixture Compose ya aceptado, sin render."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
import operar

SPEC = importlib.util.spec_from_file_location('infra_aceptacion', DEPLOY / 'aplicar-infra.py')
infra = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(infra)


def rehearse(fixture, proof, image_archive=None, relay_previous_image=None):
    operar.require(fixture.name == 'ensayo.env' and fixture.parent.name.startswith('e2e-vps-') and '.cache' in fixture.parts, 'Solo fixture privado de Compose')
    env, filename = operar.config(fixture)
    operar.require(env.get('COOPER_LAB') == '1' and env.get('CONTAINER_ENGINE') == 'podman', 'Solo laboratorio Podman')
    operar.require(env.get('PUBLIC_BIND') == '127.0.0.1' and re.fullmatch(r'cooper-vps-[a-f0-9]+', env.get('COMPOSE_PROJECT_NAME', '')), 'Solo proyecto aleatorio en loopback')
    socket = Path(env['DOCKER_HOST'].removeprefix('unix://'))
    operar.require(socket.parent == fixture.parent, 'Socket fuera del fixture')
    receipt = json.loads(proof.read_text())
    directory = fixture.parent / ('aceptacion-infra-' + str(time.time_ns()))
    candidate = directory / 'candidato'
    candidate.mkdir(parents=True, mode=0o700)
    for name in infra.FILES:
        shutil.copyfile(DEPLOY / name, candidate / name)
    images = infra.validate_bundle(candidate, receipt)
    # Solo checkout aislado; jamás se instala este arnés en el VPS.
    operar.require(os.geteuid() != 0 and DEPLOY.is_relative_to(Path.home() / '.cache'), 'Usar checkout de ensayo corto bajo ~/.cache')
    original = (DEPLOY / 'compose.yaml').read_text()
    old = original
    for value in images.values():
        operar.require(old.count(value['imagen']) == 1, 'Referencia candidata no única')
        old = old.replace(value['imagen'], value['anterior'])
    relay_services = ('chat-cooper', 'chat-n8n', 'chat-runner')

    class RelayLabOperator(operar.Operator):
        def compose(self, *args, **kwargs):
            # Docker Compose no retira primero los dependientes de namespace
            # que exige Podman. Adaptar solo ese orden del laboratorio conserva
            # el namespace real y los mismos argumentos/overrides del aplicador.
            if relay_previous_image and args and (args[0] == 'down' or (
                    args[0] == 'up' and '--force-recreate' in args and
                    any(name in args for name in ('cooper', 'n8n', 'runner')))):
                if args[0] == 'down':
                    super().compose('stop', *relay_services, **kwargs)
                running = super().compose('ps', '--status', 'running', '--services', **kwargs).split()
                operar.require(not set(relay_services).intersection(running), 'Retirar solo relés detenidos en el laboratorio')
                super().compose('rm', '--force', *relay_services, **kwargs)
            return super().compose(*args, **kwargs)

    operator = RelayLabOperator(env, filename)
    relay_marker = operator.state / 'chat-tunel.enabled'
    lab_override = Path(env['COOPER_COMPOSE_OVERRIDE']) if relay_previous_image else None
    original_override = None
    if relay_previous_image:
        operar.require(bool(re.fullmatch(r'localhost/cooper:[a-f0-9]{40}', relay_previous_image)), 'Usar imagen anterior local por commit completo')
        operar.require(not relay_marker.exists(), 'El fixture de partida no debe tener relés habilitados')
        operar.require(lab_override.is_file() and not lab_override.is_symlink() and lab_override.parent == fixture.parent, 'Override de laboratorio fuera del fixture')
        old_relay_id = operar.run(['podman', 'image', 'inspect', relay_previous_image, '--format', '{{.Id}}'], env=env).strip()
        operar.require(old_relay_id.removeprefix('sha256:') != receipt['cooper_image_id'].removeprefix('sha256:'), 'El ensayo exige imágenes Cooper diferentes')
        original_override = lab_override.read_bytes()
        override = json.loads(original_override)
        socket_directory = directory / 'tunel-ficticio'
        socket_directory.mkdir(mode=0o700)
        # Solo el proceso hijo recibe una clave efímera. No se escribe un entorno.
        env.update(PUENTE_CODEX_TOKEN=secrets.token_hex(32), COOPER_RELE_UID=str(os.getuid()), COOPER_RELE_GID=str(os.getgid()))
        override['services']['cooper'].setdefault('environment', {})['COOPER_CHAT'] = 'simulada'
        for name in relay_services:
            override['services'][name] = {
                'userns_mode': 'keep-id', 'runtime': 'runc', 'pull_policy': 'never',
                'stop_grace_period': '15s', 'cpus': 0.5,
                # runc rootless no puede montar sysfs del namespace de red
                # ajeno. El relé solo usa Node/loopback y no necesita /sys.
                'tmpfs': ['/sys:ro,size=1m'],
                'volumes': [str(socket_directory) + ':/tunel:ro'],
                'healthcheck': {'start_period': '2s', 'interval': '3s', 'retries': 30},
            }
            if os.getenv('COOPER_ENSAYO_CPUSET'):
                override['services'][name]['cpuset'] = os.environ['COOPER_ENSAYO_CPUSET']
            if name != 'chat-cooper':
                override['services'][name]['image'] = relay_previous_image
        operar.write_json(lab_override, override)
        relay_marker.touch(mode=0o600)
    socket.unlink(missing_ok=True)
    process = subprocess.Popen(['podman','--runtime','runc','system','service','--time=0', 'unix://' + str(socket)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            if socket.exists(): break
            time.sleep(0.1)
        operar.require(socket.exists(), 'No arrancó el socket privado')
        with operator.lock():
            # Compose termina su prueba de reversa con un alias de la MISMA imagen.
            # Acreditar ambos IDs antes de fijar la etiqueta exacta del artefacto final.
            artifact = receipt.get('cooper_artefacto')
            if artifact:
                current = json.loads(operator.release.read_text())['image'] if operator.release.exists() else env['COOPER_IMAGE']
                for reference in (current, artifact['etiqueta']):
                    actual = operar.run(['podman', 'image', 'inspect', reference, '--format', '{{.Id}}'], env=env).strip()
                    operar.require(actual.removeprefix('sha256:') == receipt['cooper_image_id'].removeprefix('sha256:'), 'El fixture no usa Cooper ensayado')
                operar.write_json(operator.release, {'image': artifact['etiqueta']})
            (DEPLOY / 'compose.yaml').write_text(old)
            before = {name: operar.digest(DEPLOY / name) for name in infra.FILES}
            operator.compose('up','-d','--no-build','--wait','--wait-timeout','240')
            initial_services = infra.healthy(operator)
            if relay_previous_image:
                for name in ('cooper', 'chat-cooper'):
                    operar.require(initial_services[name]['id'].removeprefix('sha256:') == receipt['cooper_image_id'].removeprefix('sha256:'), 'Cooper y su relé deben usar imagen nueva')
                for name in ('chat-n8n', 'chat-runner'):
                    operar.require(initial_services[name]['id'].removeprefix('sha256:') == old_relay_id.removeprefix('sha256:'), 'Los relés del motor deben usar imagen anterior')
                # El aplicador debe recrear los relés con la imagen global nueva.
                # Mantener el pin antiguo ocultaría el fallo que se quiere cubrir.
                for name in ('chat-n8n', 'chat-runner'):
                    del override['services'][name]['image']
                operar.write_json(lab_override, override)
            effective_override_hash = operar.digest(lab_override) if lab_override else None
            failed = directory / 'fallo-inyectado.json'
            try:
                infra.apply(operator, candidate, receipt, failed, simulate_failure=True, image_archive=image_archive)
                raise AssertionError('La inyección debe terminar en error')
            except RuntimeError:
                if not failed.exists():
                    raise
                result = json.loads(failed.read_text())
                operar.require(result.get('estado') == 'FALLO_REVERTIDO' and result.get('reversion') == 'PASS', 'No se completó reversa real')
            operar.require(before == {name: operar.digest(DEPLOY / name) for name in infra.FILES}, 'No se recuperaron archivos originales')
            operar.require(not (operator.state / 'mantenimiento').exists(), 'Quedó mantenimiento tras reversa')
            reverted_services = infra.healthy(operator)
            operar.require({name: value['id'] for name, value in initial_services.items()} ==
                           {name: value['id'] for name, value in reverted_services.items()}, 'La reversa no conservó las imágenes por servicio')
            if lab_override:
                operar.require(operar.digest(lab_override) == effective_override_hash, 'El aplicador modificó el override de laboratorio')
            successful = directory / 'actualizacion.json'
            result = infra.apply(operator, candidate, receipt, successful, image_archive=image_archive)
            operar.require(result['estado'] == 'PASS', 'La actualización real no terminó')
            final_services = infra.healthy(operator)
            if relay_previous_image:
                for name in relay_services:
                    operar.require(final_services[name]['id'].removeprefix('sha256:') == receipt['cooper_image_id'].removeprefix('sha256:'), 'Un relé no adoptó la imagen nueva tras actualizar')
            output = {'aplicador':'PASS','fallo_inyectado_y_reversa':'PASS','archivos_restaurados':'PASS',
                      'datos_restaurados_con_huellas':'PASS','actualizacion':'PASS','red':'interna y loopback',
                      'recibo_reversa':str(failed),'recibo_actualizacion':str(successful),
                      'codigo_aplicador_sha256':result['codigo_aplicador_sha256'],
                      'codigo_operar_sha256':result['codigo_operar_sha256']}
            if relay_previous_image:
                output.update(reles_previos_mezclados='PASS', reversion_imagenes_por_servicio='PASS',
                              reles_finales_actualizados='PASS',
                              adaptacion_podman='Relés con /sys vacío de solo lectura; comprobar que los dependientes de namespace están detenidos y retirarlos antes de recrear padres.',
                              servicios_antes=initial_services, servicios_revertidos=reverted_services,
                              servicios_finales=final_services,
                              codigo_arnes_sha256=operar.digest(Path(__file__)))
            operar.write_json(directory / 'resultado.json', output)
            return output
    finally:
        try:
            operator.compose('down','--timeout','30')
        finally:
            (DEPLOY / 'compose.yaml').write_text(original)
            if original_override is not None:
                lab_override.write_bytes(original_override)
                relay_marker.unlink(missing_ok=True)
            process.terminate()
            try: process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, required=True)
    parser.add_argument('--ensayo', type=Path, required=True)
    parser.add_argument('--imagen-archivo', type=Path)
    parser.add_argument('--imagen-reles-anterior', help='Ensayar Cooper nuevo con relés n8n/runner aún en la imagen local anterior')
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.fixture, args.ensayo, args.imagen_archivo, args.imagen_reles_anterior)))
    except Exception:
        print('Ensayo infra detenido; revisar recibos privados del fixture.', file=sys.stderr)
        sys.exit(1)
