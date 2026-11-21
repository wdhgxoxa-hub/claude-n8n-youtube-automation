#!/usr/bin/env python3
"""Actualiza infraestructura ensayada; revierte datos y configuración pública juntos."""
import argparse
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import time

import operar

FILES = ('compose.yaml', 'Caddyfile', 'n8n-task-runners.json', 'infra-imagenes.json')
SERVICES = ('cooper', 'n8n', 'runner', 'caddy')


def motor_module():
    spec = importlib.util.spec_from_file_location('motor_infra_aplicar', Path(__file__).with_name('ensayar-motor-n8n.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_bundle(candidate, receipt):
    operar.require(receipt.get('estado') == 'PASS' and receipt.get('compose_bloques') == 8, 'Falta aceptación Compose completa')
    for name in FILES:
        path = candidate / name
        operar.require(path.is_file() and not path.is_symlink(), 'Falta configuración pública regular')
        operar.require(receipt.get('archivos', {}).get(name) == operar.digest(path), 'Configuración distinta del ensayo')
    images = json.loads((candidate / 'infra-imagenes.json').read_text())['servicios']
    operar.require(images == receipt.get('servicios'), 'Versiones distintas del ensayo')
    operar.require(images['n8n']['version'] == images['runner']['version'], 'Motor y runner deben coincidir')
    motor = receipt.get('motor', {})
    operar.require(all(motor.get(key) == 'PASS' for key in ('migracion', 'reversion', 'idempotencia')), 'Falta reversa del motor')
    operar.require(motor.get('imagen_nueva') == images['n8n']['imagen'], 'Motor distinto del ensayado')
    operar.require(motor.get('imagen_anterior') == images['n8n']['anterior'], 'Reversa distinta del ensayo')
    operar.require(bool(receipt.get('cooper_image_id')), 'Falta identidad de Cooper ensayado')
    return images


def inspect(op, identity, template):
    return operar.run([op.engine, 'inspect', '--format', template, identity], env=op.env).strip()


def healthy(op):
    result = {}
    names = list(SERVICES)
    if (op.state / 'chat-tunel.enabled').exists():
        names += ['chat-cooper', 'chat-n8n', 'chat-runner']
    for name in names:
        identity = op.compose('ps', '-q', name).strip()
        operar.require(bool(identity), 'Falta servicio del stack')
        state = inspect(op, identity, '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}')
        operar.require(state == 'running healthy', 'El stack debe estar saludable antes del cambio')
        result[name] = {'imagen': inspect(op, identity, '{{.Config.Image}}'), 'id': inspect(op, identity, '{{.Image}}')}
    return result


def no_running(op):
    path = op.data / 'n8n/database.sqlite'
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        count = db.execute("SELECT count(*) FROM execution_entity WHERE status IN ('new','running')").fetchone()[0]
    operar.require(count == 0, 'Hay ejecuciones n8n pendientes o en marcha')


def replace_files(source, destination):
    for name in FILES:
        # Archivos públicos únicamente; nunca se copia el entorno ni credenciales.
        target = destination / name
        temporary = target.with_name(target.name + '.infra-tmp')
        operar.require(not temporary.exists() and not temporary.is_symlink(), 'Temporal ocupado')
        shutil.copyfile(source / name, temporary)
        temporary.chmod(0o644)
        temporary.replace(target)


def restore_files(backup, destination, previous):
    for name in FILES:
        target = destination / name
        if previous[name] is None:
            target.unlink(missing_ok=True)
        else:
            shutil.copy2(backup / name, target)
            operar.require(operar.digest(target) == previous[name], 'No se restauró una configuración')
        target.with_name(target.name + '.infra-tmp').unlink(missing_ok=True)


def start(op):
    names = ['cooper', 'n8n', 'runner']
    if (op.state / 'chat-tunel.enabled').exists():
        names += ['chat-cooper', 'chat-n8n', 'chat-runner']
    op.compose('up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '240', *names)
    # Ingreso público al final, cuando dependencias y namespaces están recreados.
    op.compose('up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '180', 'caddy')


def apply(op, candidate, receipt, output, simulate_failure=False):
    images = validate_bundle(candidate, receipt)
    target = operar.DEPLOY
    operar.require(candidate.resolve() != target.resolve(), 'El candidato debe estar separado de la configuración activa')
    operar.require(not output.exists(), 'El recibo debe ser nuevo')
    operar.require(not simulate_failure or (op.env.get('COOPER_LAB') == '1' and op.engine == 'podman'), 'La inyección de fallo exige laboratorio Podman')
    marker = op.state / 'mantenimiento'
    operar.require(not marker.exists(), 'Hay mantenimiento o recuperación pendiente')
    previous_services = healthy(op)
    operar.require(previous_services['cooper']['id'].removeprefix('sha256:') == receipt['cooper_image_id'].removeprefix('sha256:'), 'Cooper no coincide con la aceptación')
    no_running(op)
    # Las imágenes deben precargarse antes del corte. No se confía en etiquetas mutables.
    image_ids = {}
    for name, value in images.items():
        operar.require('@sha256:' in value['imagen'], 'Referencia sin digest')
        image_ids[name] = operar.run([op.engine, 'image', 'inspect', value['imagen'], '--format', '{{.Id}}'], env=op.env).strip()
        old_id = operar.run([op.engine, 'image', 'inspect', value['anterior'], '--format', '{{.Id}}'], env=op.env).strip()
        operar.require(previous_services[name]['id'].removeprefix('sha256:') == old_id.removeprefix('sha256:'), 'La versión activa difiere de la reversa ensayada')
    # Validar la resolución efectiva sin mostrar su contenido privado.
    config = json.loads(operar.run(['docker', 'compose', '--env-file', str(op.env_file), '-f', str(candidate / 'compose.yaml'), 'config', '--format', 'json'], env=op.env))
    operar.require(all(config['services'][name]['image'] == item['imagen'] for name, item in images.items()), 'Compose no usa las imágenes ensayadas')
    del config
    directory = op.state / ('infra-' + str(time.time_ns()))
    backup = directory / 'configuracion-anterior'
    backup.mkdir(parents=True, mode=0o700)
    previous = {}
    for name in FILES:
        path = target / name
        operar.require(not path.is_symlink(), 'Configuración activa no regular')
        previous[name] = operar.digest(path) if path.exists() else None
        if path.exists():
            shutil.copy2(path, backup / name)
    result = {'estado': 'PREPARADO', 'configuracion_anterior': previous, 'servicios_anteriores': previous_services,
              'configuracion_ensayada': receipt['archivos'], 'servicios_nuevos': images,
              'respaldo_configuracion': str(backup), 'entorno_copiado': False}
    operar.write_json(output, result)
    snapshot = None
    marker.touch(mode=0o600)
    try:
        snapshot = op.snapshot(resume=False, tag='reversion')
        result['snapshot_previo'] = snapshot
        operar.write_json(output, {**result, 'estado': 'RESPALDADO'})
        no_running(op)
        replace_files(candidate, target)
        module = motor_module()
        before = module.inventory_module.inventory(op.data / 'n8n/database.sqlite')
        op.compose('config', '--quiet')
        # Inicializa migraciones sin arrancar triggers; no exporta definiciones a un archivo.
        op.compose('run', '--rm', '--no-deps', '-T', '--entrypoint', 'n8n', 'n8n', 'export:workflow', '--all', '--output=/dev/null')
        after = module.inventory_module.inventory(op.data / 'n8n/database.sqlite', before['columnas'])
        module.preserve(before, after)
        start(op)
        current = healthy(op)
        operar.require(current['cooper']['id'] == previous_services['cooper']['id'], 'Cambió la imagen Cooper')
        operar.require(all(current[name]['id'].removeprefix('sha256:') == image_ids[name].removeprefix('sha256:') for name in images), 'El stack no usa las imágenes verificadas')
        if simulate_failure:
            raise RuntimeError('Fallo deliberado del ensayo después del arranque nuevo')
        result.update(estado='PASS', salud='PASS', datos_preservados='PASS', migraciones_antes=before['conteos'].get('migrations'), migraciones_despues=after['conteos'].get('migrations'))
        operar.write_json(output, result)
        marker.unlink()
        return result
    except Exception:
        # El marcador permanece si falla la recuperación. No anunciar éxito parcial.
        op.compose('stop')
        restore_files(backup, target, previous)
        if snapshot:
            restored = op.restore(snapshot, directory / 'restauracion')
            op.data.rename(directory / 'datos-del-intento')
            operar.copy_data(restored, op.data)
            op.ownership()
            operar.verify(op.data)
            result['manifiesto_restaurado_sha256'] = operar.digest(op.data / 'manifiesto.json')
        start(op)
        reverted = healthy(op)
        operar.require(all(reverted[name]['id'] == value['id'] for name, value in previous_services.items()), 'La reversa no recuperó las imágenes anteriores')
        operar.write_json(output, {**result, 'estado': 'FALLO_REVERTIDO', 'reversion': 'PASS', 'configuracion_restaurada': 'PASS', 'datos_restaurados': bool(snapshot)})
        marker.unlink(missing_ok=True)
        raise


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidato', type=Path, required=True)
    parser.add_argument('--ensayo', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    parser.add_argument('--env', default='/etc/cooper/.env')
    parser.add_argument('--ensayar-reversa', action='store_true', help='Inyecta fallo solamente con COOPER_LAB=1 y Podman')
    args = parser.parse_args()
    try:
        env, environment = operar.config(args.env)
        operator = operar.Operator(env, environment)
        with operator.lock():
            print(json.dumps(apply(operator, args.candidato, json.loads(args.ensayo.read_text()), args.salida, args.ensayar_reversa)))
    except Exception:
        print('Actualización detenida; consultar recibo y marcador de mantenimiento. No se muestra salida privada.', file=sys.stderr)
        sys.exit(1)
