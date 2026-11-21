#!/usr/bin/env python3
"""Extra de recuperación scoped. Preparar → actualizador certificado → sellar → recuperar.

No sustituye el actualizador ni modifica el bundle. Solo Cooper/chat-cooper;
la reversa de lotes n8n e infraestructura debe preceder a esta fase.
"""
import argparse
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import time

import operar


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


solo = load('solo_recuperacion_app', Path(operar.__file__).with_name('actualizar-solo-cooper.py'))
support = None
SHA = re.compile(r'[a-f0-9]{64}')
SERVICES = ('cooper', 'chat-cooper', 'n8n', 'runner', 'caddy', 'chat-n8n', 'chat-runner')
OTHERS = SERVICES[2:]


def set_support(path):
    global support
    support = load('soporte_recuperacion_app', Path(path))


def checked(path, root, *, new=False):
    p = support.checked_path(path, root, exists=not new)
    operar.require((not p.exists() and p.parent.is_dir()) if new else p.is_file(), 'Archivo operativo no válido')
    if not new:
        operar.require(p.stat().st_size <= 4 * 1024 * 1024, 'Archivo operativo demasiado grande')
    return p


def read_bound(path, expected, root):
    operar.require(isinstance(expected, str) and SHA.fullmatch(expected), 'Exigir SHA explícito')
    p = checked(path, root)
    operar.require(operar.digest(p) == expected, 'Recibo alterado')
    return json.loads(p.read_text())


def code_hashes():
    return {name: operar.digest(path) for name, path in {
        'extra': Path(__file__), 'operar': Path(operar.__file__), 'actualizador': Path(solo.__file__),
        'recuperador_infra': Path(support.__file__), 'aplicador_infra': Path(support.infra.__file__)}.items()}


def config_hashes():
    names = ('compose.yaml', 'compose.chat.yaml', 'Caddyfile', 'n8n-task-runners.json', '../servicios/puente-codex/tunel.mjs')
    return {n: operar.digest(operar.DEPLOY / n) for n in names}


def services(op, *, healthy=True):
    result = {}
    for name in SERVICES:
        cid = op.compose('ps', '--all', '-q', name).strip()
        operar.require(cid and '\n' not in cid, 'Falta servicio único')
        operar.require(re.fullmatch(r'[0-9a-f]{64}', cid), 'Identidad de contenedor inválida')
        fmt = '{{json .Image}}|{{json .State.StartedAt}}|{{json .State.Health.Status}}'
        values = [json.loads(x) for x in operar.run([op.engine, 'inspect', '--format', fmt, cid], env=op.env).strip().split('|')]
        operar.require(len(values) == 3 and (not healthy or values[2] == 'healthy'), 'Servicio no saludable')
        result[name] = {'contenedor': cid, 'imagen_id': 'sha256:' + support.image_id(values[0]), 'inicio': values[1], 'salud': values[2]}
    return result


def image_id(op, ref):
    return 'sha256:' + support.inspect_image(op, ref)


def phase(op):
    support.infra.no_running(op)
    return {'configuracion': config_hashes(), 'n8n_cas': support.workflow_guard(op.data / 'n8n/database.sqlite')}


def pointer(op):
    operar.require(op.release.is_file() and not op.release.is_symlink(), 'Falta release específica vigente')
    return json.loads(op.release.read_text())


def manifest(root):
    """Sella todo archivo persistente; no abre medios ni serializa datos SQLite."""
    root = Path(root)
    operar.require(root.is_dir() and not root.is_symlink(), 'Falta directorio de datos regular')
    result = {}
    for p in sorted(root.rglob('*')):
        operar.require(not p.is_symlink(), 'Enlace en datos')
        info = p.stat()
        if p.is_dir():
            result[str(p.relative_to(root))] = {'directorio': True, 'modo': stat.S_IMODE(info.st_mode)}
        else:
            operar.require(stat.S_ISREG(info.st_mode), 'Archivo especial en datos')
            if p.name.endswith('-shm'):
                continue
            result[str(p.relative_to(root))] = {'sha256': operar.digest(p), 'bytes': info.st_size, 'modo': stat.S_IMODE(info.st_mode)}
    operar.require('cooper.sqlite' in result, 'Falta base Cooper')
    return result


def copy_verified(source, target, expected):
    operar.require(not target.exists(), 'Destino de restauración existente')
    operar.require(manifest(source) == expected, 'Origen distinto del manifiesto')
    shutil.copytree(source, target, ignore=shutil.ignore_patterns('*-shm'))
    operar.require(manifest(source) == expected and manifest(target) == expected, 'Copia incompleta o cambiante')


def prepare(op, image, output):
    operar.require(not (op.state / 'mantenimiento').exists(), 'Mantenimiento previo')
    checked(output, op.state, new=True)
    operar.require(re.fullmatch(r'localhost/cooper:[a-f0-9]{40}', image), 'Exigir commit completo')
    current = services(op)
    previous = pointer(op)
    old_id = image_id(op, previous['image'])
    operar.require(current['cooper']['imagen_id'] == current['chat-cooper']['imagen_id'] == old_id, 'Imagen anterior o release no coincide')
    result = {'estado': 'PREPARADO', 'codigo': code_hashes(), 'fase': phase(op), 'imagen': image,
              'imagen_id': image_id(op, image), 'anterior': previous, 'anterior_id': old_id,
              'servicios': current, 'fecha_ns': time.time_ns()}
    operar.write_json(output, result)
    return result


def seal(op, prepared_path, prepared_sha, receipt_path, receipt_sha, output):
    operar.require(not (op.state / 'mantenimiento').exists(), 'Mantenimiento previo')
    checked(output, op.state, new=True)
    prepared = read_bound(prepared_path, prepared_sha, op.state)
    receipt = read_bound(receipt_path, receipt_sha, op.state)
    operar.require(prepared.get('estado') == 'PREPARADO' and receipt.get('resultado') == 'PASS', 'Faltan preparación y PASS')
    operar.require(prepared['codigo'] == code_hashes() and prepared['fase'] == phase(op), 'Código/configuración o fase posterior distintos')
    directory = Path(receipt_path).parent
    operar.require(directory.name.startswith('solo-cooper-'), 'No es recibo scoped')
    backup = support.checked_path(directory / 'respaldo', op.state)
    old_path = checked(directory / 'anterior.json', op.state)
    old = json.loads(old_path.read_text())
    operar.require(receipt['respaldo'] == str(backup) and old == {'image': prepared['anterior']['image'], 'id': prepared['anterior_id'], 'release': prepared['anterior']}, 'Respaldo o anterior no corresponde a preparación')
    operar.require(receipt['imagen'] == prepared['imagen'] and receipt['imagen_id_desplegada'] == prepared['imagen_id'], 'Imagen aplicada distinta')
    operar.require(receipt['anterior'] == prepared['anterior']['image'], 'Anterior distinto')
    current = services(op)
    operar.require(pointer(op) == {'image': prepared['imagen']}, 'Release posterior distinta')
    operar.require(current['cooper']['imagen_id'] == current['chat-cooper']['imagen_id'] == prepared['imagen_id'], 'Cooper actual distinto')
    for name in OTHERS:
        operar.require(current[name] == prepared['servicios'][name], 'Cambió otro servicio antes de sellar')
    operar.require(image_id(op, old['image']) == old['id'], 'Etiqueta anterior movida')
    operar.require(operar.digest(backup / 'cooper.sqlite') == receipt['respaldo_sha256'], 'SQLite del respaldo cambió')
    before = manifest(backup)
    counts = solo.counts(backup / 'cooper.sqlite')
    operar.require(manifest(backup) == before, 'Respaldo cambió al verificar')
    result = {'estado': 'SELLADO', 'codigo': code_hashes(), 'fase': prepared['fase'],
              'preparacion': str(prepared_path), 'preparacion_sha256': prepared_sha,
              'recibo': str(receipt_path), 'recibo_sha256': receipt_sha,
              'anterior': old, 'anterior_sha256': operar.digest(old_path),
              'imagen': prepared['imagen'], 'imagen_id': prepared['imagen_id'],
              'respaldo': str(backup), 'manifiesto': before, 'tablas': counts,
              'servicios_sellados': current, 'fecha_ns': time.time_ns()}
    operar.write_json(output, result)
    return result


def validate(op, sealed_path, sealed_sha):
    sealed = read_bound(sealed_path, sealed_sha, op.state)
    operar.require(sealed.get('estado') == 'SELLADO' and sealed['codigo'] == code_hashes(), 'Sello o código distinto')
    receipt = read_bound(sealed['recibo'], sealed['recibo_sha256'], op.state)
    prepared = read_bound(sealed['preparacion'], sealed['preparacion_sha256'], op.state)
    operar.require(receipt['resultado'] == 'PASS' and prepared['estado'] == 'PREPARADO', 'Contrato anterior inválido')
    old_path = Path(sealed['recibo']).parent / 'anterior.json'
    old = read_bound(old_path, sealed['anterior_sha256'], op.state)
    operar.require(old == sealed['anterior'], 'Anterior alterado')
    backup = support.checked_path(sealed['respaldo'], op.state)
    operar.require(backup == Path(sealed['recibo']).parent / 'respaldo', 'Respaldo ajeno')
    operar.require(manifest(backup) == sealed['manifiesto'], 'Respaldo completo alterado')
    operar.require(phase(op) == sealed['fase'], 'Fase posterior: recuperar n8n/infra antes de aplicación')
    operar.require(pointer(op) == {'image': sealed['imagen']}, 'Release actual distinta')
    operar.require(image_id(op, sealed['imagen']) == sealed['imagen_id'] and image_id(op, old['image']) == old['id'], 'Etiqueta movida')
    current = services(op, healthy=False)
    for name, value in current.items():
        operar.require(value['imagen_id'] == sealed['servicios_sellados'][name]['imagen_id'], 'Imagen actual distinta de la fase')
        if name in OTHERS:
            operar.require(value['salud'] == 'healthy', 'Servicio ajeno no saludable')
    return sealed, current, backup


def stop_app(op):
    op.compose('stop', 'chat-cooper', 'cooper')


def start_app(op, image):
    op.compose('up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', '--wait', '--wait-timeout', '240', 'cooper', 'chat-cooper', image=image)


def recover(op, sealed_path, sealed_sha, output):
    """Llamador mantiene lock; jamás usa ni escribe anterior.json global."""
    marker = op.state / 'mantenimiento'
    operar.require(not marker.exists(), 'Mantenimiento previo')
    checked(output, op.state, new=True)
    sealed, before, backup = validate(op, sealed_path, sealed_sha)
    global_pointer = support.pointer_hash(op.state / 'anterior.json')
    directory = op.state / ('recuperacion-app-' + str(time.time_ns()))
    directory.mkdir(mode=0o700)
    restored = directory / 'restaurado'
    copy_verified(backup, restored, sealed['manifiesto'])
    operar.require(solo.counts(restored / 'cooper.sqlite') == sealed['tablas'], 'Tablas restauradas distintas')
    result = {'estado': 'PREPARADO', 'sello_sha256': sealed_sha, 'codigo': code_hashes(), 'directorio': str(directory), 'servicios_antes': before, 'entorno_copiado': False}
    operar.write_json(output, result)
    marker.touch(mode=0o600)
    try:
        stop_app(op)
        operar.require(not set(op.compose('ps', '--status', 'running', '--services').split()).intersection(('cooper', 'chat-cooper')), 'Quedan escritores Cooper')
        checked_seal, current, _ = validate(op, sealed_path, sealed_sha)
        operar.require(checked_seal == sealed, 'Sello cambió durante corte')
        for name in OTHERS:
            operar.require(current[name] == before[name], 'Servicio ajeno cambió durante corte')
        operar.require(support.pointer_hash(op.state / 'anterior.json') == global_pointer, 'Cambió puntero global ajeno')
        live = op.data / 'cooper'
        archived = directory / 'datos-desplazados'
        current_manifest = manifest(live)
        live.rename(archived)
        result['datos_desplazados'] = str(archived)
        result['manifiesto_desplazado'] = current_manifest
        operar.write_json(output, {**result, 'estado': 'DATOS_PRESERVADOS'})
        copy_verified(restored, live, sealed['manifiesto'])
        if os.geteuid() == 0:
            for p in (live, *live.rglob('*')): os.chown(p, 1000, 1000, follow_symlinks=False)
        operar.require(manifest(archived) == current_manifest, 'Escrituras desplazadas alteradas')
        operar.write_json(op.release, sealed['anterior']['release'])
        start_app(op, sealed['anterior']['image'])
        after = services(op)
        operar.require(after['cooper']['imagen_id'] == after['chat-cooper']['imagen_id'] == sealed['anterior']['id'], 'No volvió imagen anterior')
        for name in OTHERS: operar.require(after[name] == before[name], 'Cambió un servicio ajeno')
        operar.require(pointer(op) == sealed['anterior']['release'] and support.pointer_hash(op.state / 'anterior.json') == global_pointer, 'Punteros incorrectos')
        operar.require(phase(op) == sealed['fase'], 'Cambió fase durante recuperación')
        operar.require(solo.counts(live / 'cooper.sqlite') == sealed['tablas'], 'Diario/tablas recuperados distintos')
        result.update(estado='PASS', servicios_despues=after, cinco_servicios_intactos=True, release_anterior_restaurada=True, anterior_global_conservado=True, datos_restaurados=True)
        operar.write_json(output, result)
        marker.unlink()
        return result
    except Exception:
        try: stop_app(op)
        finally: operar.write_json(output, {**result, 'estado': 'FALLO_MANTENIMIENTO'})
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', default='/etc/cooper/.env')
    parser.add_argument('--deploy', type=Path, required=True)
    parser.add_argument('--codigo', type=Path, required=True)
    parser.add_argument('--infra-helper', type=Path, default=Path(__file__).with_name('recuperar-infra.py'))
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('preparar'); p.add_argument('--imagen', required=True)
    p = sub.add_parser('sellar'); p.add_argument('--preparacion', required=True, type=Path); p.add_argument('--preparacion-sha256', required=True)
    p.add_argument('--recibo', required=True, type=Path); p.add_argument('--recibo-sha256', required=True)
    p = sub.add_parser('recuperar'); p.add_argument('--sello', required=True, type=Path); p.add_argument('--sello-sha256', required=True)
    for p in sub.choices.values(): p.add_argument('--salida', required=True, type=Path)
    args = parser.parse_args()
    operar.require(os.geteuid() == 0 or os.environ.get('COOPER_LAB') == '1', 'Solo root o laboratorio explícito')
    operar.require(Path(operar.__file__).resolve().parent == args.codigo.resolve(), 'Operator no procede del bundle explícito')
    operar.DEPLOY = args.deploy.resolve()
    set_support(args.infra_helper)
    env, filename = operar.config(args.env); op = operar.Operator(env, filename)
    with op.lock():
        if args.command == 'preparar': result = prepare(op, args.imagen, args.salida)
        elif args.command == 'sellar': result = seal(op, args.preparacion, args.preparacion_sha256, args.recibo, args.recibo_sha256, args.salida)
        else: result = recover(op, args.sello, args.sello_sha256, args.salida)
    print(json.dumps({'estado': result['estado'], 'recibo_sha256': operar.digest(args.salida)}))


if __name__ == '__main__':
    try: main()
    except Exception:
        print('Recuperación app detenida; consultar recibo y mantenimiento. Salida privada omitida.', file=sys.stderr)
        sys.exit(1)
