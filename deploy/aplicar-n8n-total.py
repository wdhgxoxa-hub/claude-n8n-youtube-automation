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


def validar_entradas(entrada, diff, ensayo, manifiesto, plan=None):
    if diff.get('modalidad') == 'solo_columnas':
        operar.require(ensayo.get('aplicacion') == ensayo.get('reversion') == 'PASS' and ensayo.get('modalidad') == 'solo_columnas', 'Falta ensayo y reversa de solo columnas')
        operar.require(ensayo.get('entrada_sha256') == operar.digest(entrada) and json.loads(entrada.read_text()) == [], 'Solo columnas exige entrada vacía ensayada')
        operar.require(ensayo.get('manifiesto_sha256') == operar.digest(manifiesto), 'El manifiesto difiere del ensayado')
        operar.require(ensayo.get('columnas_script_sha256') == operar.digest(Path(__file__).with_name('n8n-columnas.cjs')), 'El migrador difiere del ensayado')
        operar.require(plan is None and diff.get('republicar_originales') == [] and ensayo.get('flujos_importados') == 0, 'Solo columnas no admite publicaciones')
        operar.require(isinstance(ensayo.get('plan_columnas'), list), 'Falta plan de columnas ensayado')
        return set(), []
    if 'modalidad' in diff:
        operar.require(diff['modalidad'] in ('delta_cooper_total', 'ajuste_texto_api', 'activaciones_cooper_total') and 'plan_publicacion' in diff,
                        'El delta exige modalidad y plan de publicación certificados')
    operar.require(ensayo.get('aplicacion') == ensayo.get('reversion') == 'PASS', 'Falta ensayo y reversa satisfactorios')
    operar.require(ensayo.get('entrada_sha256') == operar.digest(entrada), 'El lote difiere del ensayado')
    operar.require(ensayo.get('manifiesto_sha256') == operar.digest(manifiesto), 'El manifiesto difiere del ensayado')
    workflows = json.loads(entrada.read_text())
    ids = {w['id'] for w in workflows}
    operar.require(len(ids) == len(workflows) == ensayo['flujos_importados'], 'IDs duplicados o cantidad distinta')
    operar.require(all(w.get('active') is False for w in workflows), 'La entrada debe estar inactiva')
    originales = diff['republicar_originales']
    operar.require(len(set(originales)) == len(originales) and set(originales) <= ids, 'Publicación fuera del lote')
    # No fabricar ni sustituir credenciales ausentes para conservar un indicador activo.
    bloqueados = {c['workflow'] for c in diff.get('credenciales_faltantes', [])}
    publicar = [wid for wid in originales if wid not in bloqueados]
    if 'plan_publicacion' in diff:
        operar.require(plan is not None and plan.is_file(), 'Falta plan de publicación ensayado')
        publicar = json.loads(plan.read_text())
        operar.require(ensayo.get('publicacion') == 'PASS' and ensayo.get('publicar_sha256') == operar.digest(plan),
                        'La publicación difiere del ensayo')
        operar.require(publicar == diff['plan_publicacion'] == ensayo.get('publicados'), 'Orden de publicación distinto')
        if diff.get('modalidad') in ('delta_cooper_total', 'ajuste_texto_api', 'activaciones_cooper_total'):
            helper = {'ajuste_texto_api': 'preparar-ajuste-texto.py', 'delta_cooper_total': 'preparar-delta-n8n.py',
                      'activaciones_cooper_total': 'preparar-activaciones-n8n.py'}[diff['modalidad']]
            spec = importlib.util.spec_from_file_location('delta_n8n', Path(__file__).with_name(helper))
            delta = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(delta)
            permitidos = delta.validar_contrato(workflows, diff)
        else:
            operar.require('modalidad' not in diff, 'Modalidad de publicación desconocida')
            permitidos = set(originales) | {'FabYouTube000001', 'FabRadar00000001', 'FabConfirmar0001'}
        operar.require(len(set(publicar)) == len(publicar) and set(publicar) == permitidos and permitidos <= ids,
                        'Publicación fuera del plan aprobado')
        guards = {(x['workflow'], x['nodo']) for x in diff.get('bloqueos_explicitos', [])}
        operar.require(all((x['workflow'], x['nodo']) in guards for x in diff.get('credenciales_faltantes', [])),
                        'Falta bloqueo explícito de credencial ausente')
    return ids, publicar


def aplicar(op, entrada, diff, ensayo, manifiesto, salida, plan=None):
    ids, publicar = validar_entradas(entrada, diff, ensayo, manifiesto, plan)
    solo_columnas = diff.get('modalidad') == 'solo_columnas'
    operar.require(not salida.exists(), 'El recibo debe ser nuevo')
    validar = modulo_ensayo()
    for key, path in [('contrato_productivo_sha256', validar.esquema.CONTRACT),
                      ('comparador_esquema_sha256', validar.esquema.CHECKER),
                      ('puerta_esquema_sha256', Path(validar.esquema.__file__))]:
        operar.require(ensayo.get(key) == operar.digest(path), 'La puerta de esquema difiere del ensayo')
    workflows = json.loads(entrada.read_text())
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
                 'republicados_originales': publicar, 'entradas_pausadas_reabiertas': diff.get('activar_previamente_pausados', []),
                 'disparadores_habilitados': diff.get('disparadores_habilitados', []),
                 'pausados_por_credencial': sorted(set(diff['republicar_originales']) - set(publicar)),
                 'pasos_bloqueados_por_credencial': diff.get('bloqueos_explicitos', []),
                 'disparadores_dependencias_pausados': diff.get('disparadores_dependencias_pausados', [])}
    try:
        snapshot = op.snapshot(resume=False, tag='reversion')
        resultado['snapshot_previo'] = snapshot
        operar.write_json(salida, {**resultado, 'estado': 'respaldado'})
        before = validar.inventory(op.data / 'n8n/database.sqlite')
        if diff.get('modalidad') == 'activaciones_cooper_total':
            spec = importlib.util.spec_from_file_location('activaciones_n8n', Path(__file__).with_name('preparar-activaciones-n8n.py'))
            activaciones = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(activaciones)
            activaciones.permiso_cerrado(op.data / 'n8n/database.sqlite')
        if diff.get('modalidad') == 'ajuste_texto_api':
            spec = importlib.util.spec_from_file_location('ajuste_texto', Path(__file__).with_name('preparar-ajuste-texto.py'))
            ajuste = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(ajuste)
            ajuste.validar_actual(op.data / 'n8n/database.sqlite', diff)
        operar.require({wid for wid in ids if wid in before['flujos'] and before['flujos'][wid][0]} == set(diff['republicar_originales']),
                        'Cambió la publicación desde el diff; preparar otro lote')

        def cli(entrypoint, *args):
            return op.compose('run', '--rm', '--no-deps', '-T', '-v', str(destino) + ':/lote:rw',
                              '--entrypoint', entrypoint, 'n8n', *args)

        planned = validar.column_result(cli('node', '/lote/columnas.cjs', '/lote/columnas.json'))
        if solo_columnas:
            operar.require(planned['columnas'] == ensayo['plan_columnas'], 'Cambió el plan respecto del ensayo; no se aplicaron columnas')
        validar.esquema.validate(op.data / 'n8n/database.sqlite', workflows, planned['columnas'])
        applied = validar.column_result(cli('node', '/lote/columnas.cjs', '/lote/columnas.json', '--aplicar', '--diario', '/lote/diario.json'))
        operar.require(planned['columnas'] == applied['columnas'], 'El plan de columnas cambió')
        operar.require(not validar.column_result(cli('node', '/lote/columnas.cjs', '/lote/columnas.json'))['columnas'], 'Columnas no idempotentes')
        resultado['esquema_productivo'] = validar.esquema.validate(op.data / 'n8n/database.sqlite', workflows)
        if not solo_columnas:
            cli('n8n', 'import:workflow', '--input=/lote/entrada.json')
        after = validar.inventory(op.data / 'n8n/database.sqlite', before['columnas'])
        validar.validate_import(before, after, ids)
        if not solo_columnas:
            cli('node', '/lote/publicar.cjs')
        published = validar.inventory(op.data / 'n8n/database.sqlite', before['columnas'])
        if diff.get('modalidad') == 'activaciones_cooper_total':
            activaciones.permiso_cerrado(op.data / 'n8n/database.sqlite')
            resultado['allowTextoApi'] = False
        if diff.get('modalidad') == 'ajuste_texto_api':
            ajuste.validar_actual(op.data / 'n8n/database.sqlite', diff, despues=True)
            resultado['allowTextoApi'] = False
            resultado['unico_cambio_de_contenido'] = 'PASS'
        operar.require(before['datos'] == published['datos'], 'Cambió una tabla de negocio')
        operar.require(all(bool(published['flujos'][wid][0]) == (wid in publicar) for wid in ids), 'Estado publicado distinto del plan')
        operar.require(all(published['flujos'][wid] == meta for wid, meta in before['flujos'].items() if wid not in ids), 'Cambió un workflow ajeno')
        op.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')
        resultado.update({'estado': 'PASS', 'columnas_agregadas': len(applied['columnas']),
                          'columnas_idempotentes': 'PASS', 'plan_columnas': applied['columnas'],
                          'columnas_script_sha256': operar.digest(Path(__file__).with_name('n8n-columnas.cjs')),
                          'modalidad': diff.get('modalidad', 'workflows'), 'flujos_antes': len(before['flujos']),
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
    parser.add_argument('--plan', type=Path)
    args = parser.parse_args()
    env, archivo = operar.config('/etc/cooper/.env')
    op = operar.Operator(env, archivo)
    with op.lock():
        resultado = aplicar(op, args.entrada, json.loads(args.diff.read_text()), json.loads(args.ensayo.read_text()), args.manifiesto, args.salida, args.plan)
    print(json.dumps(resultado))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Aplicación detenida; consultar el recibo seguro y el marcador de mantenimiento. Salida privada suprimida.', file=sys.stderr)
        sys.exit(1)
