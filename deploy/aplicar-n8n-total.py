#!/usr/bin/env python3
"""Aplica únicamente el lote ensayado, con escritores detenidos y reversa automática."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import time

import operar


def modulo_ensayo():
    spec = importlib.util.spec_from_file_location('ensayo_n8n', Path(__file__).with_name('ensayar-n8n.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validar_entradas(entrada, diff, ensayo, manifiesto):
    operar.require(ensayo.get('aplicacion') == ensayo.get('reversion') == 'PASS', 'Falta ensayo y reversa satisfactorios')
    operar.require(ensayo.get('entrada_sha256') == operar.digest(entrada), 'El lote difiere del ensayado')
    operar.require(ensayo.get('manifiesto_sha256') == operar.digest(manifiesto), 'El manifiesto difiere del ensayado')
    workflows = json.loads(entrada.read_text())
    ids = {w['id'] for w in workflows}
    operar.require(len(ids) == len(workflows) == ensayo['flujos_importados'], 'IDs duplicados o cantidad distinta')
    operar.require(all(w.get('active') is False for w in workflows), 'La entrada debe estar inactiva')
    publicar = diff['republicar_originales']
    operar.require(len(set(publicar)) == len(publicar) and set(publicar) <= ids, 'Publicación fuera del lote')
    return ids, publicar


def aplicar(op, entrada, diff, ensayo, manifiesto, salida):
    ids, publicar = validar_entradas(entrada, diff, ensayo, manifiesto)
    operar.require(not salida.exists(), 'El recibo debe ser nuevo')
    validar = modulo_ensayo()
    destino = op.state / ('lote-ejecucion-' + str(time.time_ns()))
    destino.mkdir(mode=0o700)
    for origen, nombre in [(entrada, 'entrada.json'), (manifiesto, 'columnas.json'),
                           (Path(__file__).with_name('n8n-columnas.cjs'), 'columnas.cjs')]:
        shutil.copyfile(origen, destino / nombre)
        (destino / nombre).chmod(0o600)
    (destino / 'publicar.json').write_text(json.dumps(publicar))
    (destino / 'publicar.cjs').write_text("const{readFileSync}=require('node:fs');const{execFileSync}=require('node:child_process');for(const id of JSON.parse(readFileSync('/lote/publicar.json','utf8')))execFileSync('n8n',['publish:workflow','--id='+id],{stdio:'ignore'});\n")
    for path in [destino, *destino.iterdir()]:
        os.chown(path, 1000, 1000)
    mantenimiento = op.state / 'mantenimiento'
    mantenimiento.touch(mode=0o600)
    snapshot = None
    resultado = {'entrada_sha256': operar.digest(entrada), 'manifiesto_sha256': operar.digest(manifiesto),
                 'ensayo_y_reversa_previa': 'PASS', 'flujos_importados': len(ids),
                 'republicados_originales': publicar, 'entradas_pausadas_reabiertas': []}
    try:
        snapshot = op.snapshot(resume=False, tag='reversion')
        resultado['snapshot_previo'] = snapshot
        operar.write_json(salida, {**resultado, 'estado': 'respaldado'})
        before = validar.inventory(op.data / 'n8n/database.sqlite')
        operar.require({wid for wid in ids if wid in before['flujos'] and before['flujos'][wid][0]} == set(publicar),
                        'Cambió la publicación desde el diff; preparar otro lote')

        def cli(entrypoint, *args):
            return op.compose('run', '--rm', '--no-deps', '-T', '-v', str(destino) + ':/lote:rw',
                              '--entrypoint', entrypoint, 'n8n', *args)

        planned = validar.column_result(cli('node', '/lote/columnas.cjs', '/lote/columnas.json'))
        applied = validar.column_result(cli('node', '/lote/columnas.cjs', '/lote/columnas.json', '--aplicar', '--diario', '/lote/diario.json'))
        operar.require(planned['columnas'] == applied['columnas'], 'El plan de columnas cambió')
        operar.require(not validar.column_result(cli('node', '/lote/columnas.cjs', '/lote/columnas.json'))['columnas'], 'Columnas no idempotentes')
        cli('n8n', 'import:workflow', '--input=/lote/entrada.json')
        after = validar.inventory(op.data / 'n8n/database.sqlite', before['columnas'])
        validar.validate_import(before, after, ids)
        cli('node', '/lote/publicar.cjs')
        published = validar.inventory(op.data / 'n8n/database.sqlite', before['columnas'])
        operar.require(before['datos'] == published['datos'], 'Cambió una tabla de negocio')
        operar.require(all(bool(published['flujos'][wid][0]) == (wid in publicar) for wid in ids), 'Estado publicado distinto del plan')
        operar.require(all(published['flujos'][wid] == meta for wid, meta in before['flujos'].items() if wid not in ids), 'Cambió un workflow ajeno')
        op.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')
        resultado.update({'estado': 'PASS', 'columnas_agregadas': len(applied['columnas']),
                          'columnas_idempotentes': 'PASS', 'flujos_antes': len(before['flujos']),
                          'flujos_despues': len(published['flujos']), 'flujos_ajenos_preservados': 'PASS',
                          'tablas_negocio_preservadas': len(before['datos']),
                          'filas_negocio': sum(before['conteos'][x] for x in before['datos']),
                          'tablas_negocio_sha256': validar.digest(before['datos']), 'salud_stack': 'PASS'})
        operar.write_json(salida, resultado)
        mantenimiento.unlink(missing_ok=True)
        return resultado
    except Exception:
        if snapshot:
            op.compose('stop')
            restaurado = op.restore(snapshot, op.state / ('lote-reversa-' + str(time.time_ns())))
            previo = op.data / ('n8n-fallido-' + str(time.time_ns()))
            (op.data / 'n8n').rename(previo)
            shutil.copytree(restaurado / 'n8n', op.data / 'n8n')
            # El archivo fallido se conserva fuera del árbol activo de copias.
            previo.rename(op.state / previo.name)
            op.ownership()
            op.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')
            mantenimiento.unlink(missing_ok=True)
            operar.write_json(salida, {**resultado, 'estado': 'FALLO_REVERTIDO', 'reversa': 'PASS'})
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for nombre in ('entrada', 'diff', 'ensayo', 'manifiesto', 'salida'):
        parser.add_argument('--' + nombre, type=Path, required=True)
    args = parser.parse_args()
    env, archivo = operar.config('/etc/cooper/.env')
    op = operar.Operator(env, archivo)
    with op.lock():
        resultado = aplicar(op, args.entrada, json.loads(args.diff.read_text()), json.loads(args.ensayo.read_text()), args.manifiesto, args.salida)
    print(json.dumps(resultado))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Aplicación detenida; consultar el recibo seguro y el marcador de mantenimiento. Salida privada suprimida.', file=sys.stderr)
        sys.exit(1)
