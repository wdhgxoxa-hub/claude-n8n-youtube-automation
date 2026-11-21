#!/usr/bin/env python3
"""Ensaya fallo y actualización infra en un fixture Compose ya aceptado, sin render."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
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


def rehearse(fixture, proof):
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
    operator = operar.Operator(env, filename)
    socket.unlink(missing_ok=True)
    process = subprocess.Popen(['podman','--runtime','runc','system','service','--time=0', 'unix://' + str(socket)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            if socket.exists(): break
            time.sleep(0.1)
        operar.require(socket.exists(), 'No arrancó el socket privado')
        with operator.lock():
            (DEPLOY / 'compose.yaml').write_text(old)
            before = {name: operar.digest(DEPLOY / name) for name in infra.FILES}
            operator.compose('up','-d','--no-build','--wait','--wait-timeout','240')
            failed = directory / 'fallo-inyectado.json'
            try:
                infra.apply(operator, candidate, receipt, failed, simulate_failure=True)
                raise AssertionError('La inyección debe terminar en error')
            except RuntimeError:
                result = json.loads(failed.read_text())
                operar.require(result.get('estado') == 'FALLO_REVERTIDO' and result.get('reversion') == 'PASS', 'No se completó reversa real')
            operar.require(before == {name: operar.digest(DEPLOY / name) for name in infra.FILES}, 'No se recuperaron archivos originales')
            operar.require(not (operator.state / 'mantenimiento').exists(), 'Quedó mantenimiento tras reversa')
            successful = directory / 'actualizacion.json'
            result = infra.apply(operator, candidate, receipt, successful)
            operar.require(result['estado'] == 'PASS', 'La actualización real no terminó')
            output = {'aplicador':'PASS','fallo_inyectado_y_reversa':'PASS','archivos_restaurados':'PASS',
                      'datos_restaurados_con_huellas':'PASS','actualizacion':'PASS','red':'interna y loopback',
                      'recibo_reversa':str(failed),'recibo_actualizacion':str(successful)}
            operar.write_json(directory / 'resultado.json', output)
            return output
    finally:
        try:
            operator.compose('down','--timeout','30')
        finally:
            (DEPLOY / 'compose.yaml').write_text(original)
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
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.fixture, args.ensayo)))
    except Exception:
        print('Ensayo infra detenido; revisar recibos privados del fixture.', file=sys.stderr)
        sys.exit(1)
