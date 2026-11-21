#!/usr/bin/env python3
"""Revierte una aplicación de infraestructura PASS usando su recibo exacto.

Conserva la imagen de Cooper. Su reversa de aplicación, si procede, se ejecuta
después con el anterior.json de Operator. No lee ni copia el entorno por fuera
del adaptador operativo existente, ni muestra salida de proveedores.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
import os

import operar

SPEC = importlib.util.spec_from_file_location('infra_recuperacion', Path(__file__).with_name('aplicar-infra.py'))
infra = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(infra)
SHA = re.compile(r'[0-9a-f]{64}')


def checked_path(path, root, *, exists=True):
    """Archivos operativos locales, sin enlaces ni escape del directorio de estado."""
    path, root = Path(path).absolute(), Path(root).resolve()
    operar.require(path.is_relative_to(root) and path != root, 'Ruta fuera del estado operativo')
    for current in (path, *path.parents):
        if current == root:
            break
        operar.require(not current.is_symlink(), 'No se admiten enlaces operativos')
    operar.require(path.resolve() == path, 'Ruta operativa no canónica')
    if exists:
        operar.require(path.exists(), 'Falta archivo o directorio operativo')
    return path


def image_id(value):
    operar.require(isinstance(value, str) and SHA.fullmatch(value.removeprefix('sha256:')), 'Identidad de imagen inválida')
    return value.removeprefix('sha256:')


def inspect_image(op, reference):
    operar.require(isinstance(reference, str) and re.fullmatch(r'[a-zA-Z0-9./:@_-]+', reference), 'Referencia de imagen inválida')
    return image_id(operar.run([op.engine, 'image', 'inspect', reference, '--format', '{{.Id}}'], env=op.env).strip())


def current_services(op, names):
    result = {}
    for name in names:
        identity = op.compose('ps', '--all', '-q', name).strip()
        operar.require(identity and '\n' not in identity, 'Falta un contenedor único del stack')
        result[name] = {
            'imagen': infra.inspect(op, identity, '{{.Config.Image}}'),
            'id': image_id(infra.inspect(op, identity, '{{.Image}}')),
        }
    return result


def validate(op, receipt_path, expected, output):
    operar.require(isinstance(expected, str) and SHA.fullmatch(expected), 'Exigir SHA-256 del recibo explícito')
    receipt_path = checked_path(receipt_path, op.state)
    operar.require(receipt_path.is_file() and receipt_path.stat().st_size <= 1048576, 'Recibo no regular o demasiado grande')
    operar.require(operar.digest(receipt_path) == expected, 'El recibo no coincide con su huella')
    output = checked_path(output, op.state, exists=False)
    operar.require(not output.exists() and output.parent.is_dir(), 'La salida exige nombre nuevo y directorio existente')
    receipt = json.loads(receipt_path.read_text())
    operar.require(receipt.get('estado') == 'PASS', 'Solo recuperar una aplicación terminada PASS')
    operar.require(receipt.get('codigo_operar_sha256') == operar.digest(Path(operar.__file__)), 'Operator difiere del aplicado')
    operar.require(receipt.get('codigo_aplicador_sha256') == operar.digest(Path(infra.__file__)), 'Aplicador difiere del aplicado')
    operar.require(isinstance(receipt.get('snapshot_previo'), str) and SHA.fullmatch(receipt['snapshot_previo']), 'Falta snapshot completo y explícito')
    old, new = receipt.get('configuracion_anterior', {}), receipt.get('configuracion_ensayada', {})
    operar.require(set(old) == set(new) == set(infra.FILES), 'Contrato de configuración incompleto')
    backup = checked_path(receipt.get('respaldo_configuracion', ''), op.state)
    operar.require(backup.is_dir() and backup.name == 'configuracion-anterior' and re.fullmatch(r'infra-[0-9]+', backup.parent.name), 'Respaldo público fuera del contrato')
    for name in infra.FILES:
        active, saved = operar.DEPLOY / name, backup / name
        operar.require(isinstance(new[name], str) and SHA.fullmatch(new[name]), 'Huella de configuración inválida')
        operar.require(active.is_file() and not active.is_symlink() and operar.digest(active) == new[name], 'La configuración activa cambió después del recibo')
        if old[name] is None:
            operar.require(not saved.exists() and not saved.is_symlink(), 'Respaldo inesperado para archivo antes ausente')
        else:
            operar.require(isinstance(old[name], str) and SHA.fullmatch(old[name]), 'Huella de respaldo inválida')
            operar.require(saved.is_file() and not saved.is_symlink() and operar.digest(saved) == old[name], 'Respaldo público alterado o ausente')
    names = set(infra.SERVICES)
    if (op.state / 'chat-tunel.enabled').exists():
        names |= {'chat-cooper', 'chat-n8n', 'chat-runner'}
    previous, newer = receipt.get('servicios_anteriores', {}), receipt.get('servicios_nuevos', {})
    operar.require(set(previous) == names and set(newer) == {'n8n', 'runner', 'caddy'}, 'Servicios distintos del recibo')
    current = current_services(op, sorted(names))
    for name in sorted(names):
        item = previous[name]
        old_id = image_id(item.get('id'))
        operar.require(inspect_image(op, item.get('imagen')) == old_id, 'La imagen anterior no está disponible o cambió')
        if name in newer:
            reference = newer[name].get('imagen', '')
            operar.require(re.fullmatch(r'[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}', reference), 'La imagen aplicada no tiene digest')
            expected_id = inspect_image(op, reference)
        else:
            reference, expected_id = item['imagen'], old_id
        # Config.Image puede ser una etiqueta/alias normalizada por el motor.
        # La identidad es el ID del contenedor frente al ID inspeccionado desde
        # la referencia EXACTA del recibo (con digest para infraestructura).
        # El texto observado queda en el recibo, sin inferir identidad por él.
        operar.require(current[name]['id'] == expected_id, 'El servicio actual no corresponde al recibo')
    infra.no_running(op)
    return receipt, backup, current


def pointer_hash(path):
    operar.require(not path.is_symlink(), 'Puntero operativo no regular')
    return operar.digest(path) if path.exists() else None


def start_restored(op):
    names = ['cooper', 'n8n', 'runner']
    if (op.state / 'chat-tunel.enabled').exists():
        names += ['chat-cooper', 'chat-n8n', 'chat-runner']
    # Nunca descargar/construir durante una recuperación ni abrir Caddy primero.
    options = ('up', '-d', '--no-build', '--pull', 'never', '--force-recreate', '--wait', '--wait-timeout')
    op.compose(*options, '240', *names)
    op.compose(*options, '180', '--no-deps', 'caddy')


def recover(op, receipt_path, expected_sha256, output):
    """El llamador debe mantener Operator.lock durante toda la operación."""
    marker = op.state / 'mantenimiento'
    operar.require(not marker.exists(), 'Hay mantenimiento o recuperación pendiente')
    receipt, backup, current = validate(op, receipt_path, expected_sha256, output)
    pointers = {name: pointer_hash(op.state / name) for name in ('release.json', 'anterior.json')}
    directory = op.state / ('recuperacion-infra-' + str(time.time_ns()))
    directory.mkdir(mode=0o700)
    # Acreditar snapshot y manifiesto ANTES de parar o desplazar los datos vivos.
    restored = op.restore(receipt['snapshot_previo'], directory / 'restauracion')
    operar.verify(restored)
    restored_manifest = operar.digest(restored / 'manifiesto.json')
    result = {
        'estado': 'PREPARADO', 'recibo_aplicacion_sha256': expected_sha256,
        'codigo_recuperacion_sha256': operar.digest(Path(__file__)),
        'codigo_operar_sha256': receipt['codigo_operar_sha256'],
        'codigo_aplicador_sha256': receipt['codigo_aplicador_sha256'],
        'snapshot_restaurado': receipt['snapshot_previo'],
        'servicios_antes': current, 'directorio': str(directory),
        'entorno_copiado': False,
    }
    operar.write_json(output, result)
    marker.touch(mode=0o600)
    try:
        # Guarda las escrituras posteriores al despliegue antes de volver atrás.
        result['snapshot_desplazado'] = op.snapshot(resume=False, tag='reversion')
        operar.require(not op.compose('ps', '--status', 'running', '--services').strip(), 'Quedan escritores durante la recuperación')
        infra.no_running(op)
        # Repetir huellas bajo el corte; el candado ya excluye otros aplicadores.
        for name in infra.FILES:
            operar.require(operar.digest(operar.DEPLOY / name) == receipt['configuracion_ensayada'][name], 'Configuración cambió durante el respaldo')
        archived = directory / 'datos-desplazados'
        op.data.rename(archived)
        result['datos_desplazados'] = str(archived)
        operar.write_json(output, {**result, 'estado': 'DATOS_PRESERVADOS'})
        operar.copy_data(restored, op.data)
        op.ownership()
        operar.verify(op.data)
        operar.require(operar.digest(op.data / 'manifiesto.json') == restored_manifest, 'El manifiesto recuperado difiere del snapshot')
        infra.restore_files(backup, operar.DEPLOY, receipt['configuracion_anterior'])
        op.compose('config', '--quiet')
        start_restored(op)
        services = infra.healthy(op)
        operar.require(set(services) == set(receipt['servicios_anteriores']), 'El stack recuperado está incompleto')
        for name, item in receipt['servicios_anteriores'].items():
            operar.require(image_id(services[name]['id']) == image_id(item['id']), 'La recuperación no restituyó una imagen anterior')
        operar.require(pointers == {name: pointer_hash(op.state / name) for name in pointers}, 'Cambió el puntero de la recuperación de Cooper')
        result.update(estado='PASS', salud='PASS', configuracion_restaurada='PASS', datos_restaurados='PASS',
                      manifiesto_restaurado_sha256=restored_manifest, servicios_despues=services,
                      imagen_cooper_conservada=True, punteros_cooper_conservados=True)
        operar.write_json(output, result)
        marker.unlink()
        return result
    except Exception:
        # No arrancar una mezcla de datos/configuración. Conservar ambos estados
        # y mantenimiento para revisión; nunca borrar el intento para reintentar.
        try:
            op.compose('stop')
        finally:
            operar.write_json(output, {**result, 'estado': 'FALLO_MANTENIMIENTO'})
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recibo', required=True, type=Path)
    parser.add_argument('--recibo-sha256', required=True)
    parser.add_argument('--salida', required=True, type=Path)
    parser.add_argument('--env', default='/etc/cooper/.env')
    args = parser.parse_args()
    env, filename = operar.config(args.env)
    op = operar.Operator(env, filename)
    with op.lock():
        print(json.dumps(recover(op, args.recibo, args.recibo_sha256, args.salida)))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Recuperación detenida; consultar el recibo y mantenimiento. No se muestran datos privados.', file=sys.stderr)
        sys.exit(1)
