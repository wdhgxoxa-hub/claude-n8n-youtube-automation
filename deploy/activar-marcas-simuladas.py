#!/usr/bin/env python3
"""Extra separado: activa/revierte solo los dos trabajadores de Marcas simuladas.

Se importa operar desde el bundle certificado. No cambia entorno, imagen,
definiciones de workflows ni aplicadores. Solo usa CLI oficial publish/unpublish.
"""
import argparse
from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sqlite3
import sys
import time

import operar

IDS = ('CooperMarcasPub1', 'CooperMarcasMet1')
PUBLICOS = ('compose.yaml', 'compose.chat.yaml', 'Caddyfile', 'n8n-task-runners.json', 'infra-imagenes.json')


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), Path(operar.__file__).with_name(name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def checked_path(path, state, exists=True):
    path, state = Path(path).absolute(), Path(state).resolve()
    operar.require(path.is_relative_to(state) and path != state and path.resolve() == path, 'Ruta fuera del estado operativo')
    for current in (path, *path.parents):
        if current == state:
            break
        operar.require(not current.is_symlink(), 'No se admiten enlaces operativos')
    operar.require(not exists or path.is_file(), 'Falta recibo operativo regular')
    return path


def metadata(path):
    """Solo identidades/huellas públicas; no credentials ni datos de ejecuciones."""
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('BEGIN')
        busy = db.execute("SELECT count(*) FROM execution_entity WHERE status IN ('new','running')").fetchone()[0]
        waiting = db.execute("SELECT id FROM execution_entity WHERE status='waiting' ORDER BY id").fetchall()
        rows = db.execute('SELECT id,active,versionId,activeVersionId,versionCounter,nodes,connections,settings FROM workflow_entity ORDER BY id').fetchall()
    flows = {}
    for wid, active, version, published, counter, nodes, connections, settings in rows:
        flows[wid] = {'active': bool(active), 'version': version, 'publicada': published, 'contador': counter,
                      'contenido': digest([json.loads(nodes), json.loads(connections), json.loads(settings)])}
    return {'flujos': flows, 'ocupadas': busy, 'esperas': [r[0] for r in waiting]}


def guard_runtime(op):
    # Solo booleanos: nunca imprime valores, tamaños de secretos ni entorno.
    checks = {
        'cooper': "process.env.COOPER_MARCAS==='simulada'&&process.env.COOPER_DEMO!=='1'&&(process.env.COOPER_MARCAS_WORKER_SECRET||'').length>=32",
        'n8n': "process.env.COOPER_MARCAS_HABILITAR==='1'&&(process.env.COOPER_MARCAS_WORKER_SECRET||'').length>=32&&/^https:\\/\\//.test(process.env.COOPER_MARCAS_URL||'')",
        'runner': "process.env.COOPER_MARCAS_HABILITAR==='1'&&(process.env.COOPER_MARCAS_WORKER_SECRET||'').length>=32&&/^https:\\/\\//.test(process.env.COOPER_MARCAS_URL||'')",
    }
    for service, check in checks.items():
        result = op.compose('exec', '-T', service, 'node', '-e', 'process.stdout.write(JSON.stringify({ok:Boolean(' + check + ')}))')
        operar.require(json.loads(result) == {'ok': True}, 'Runtime no corresponde a simulada/1')
    return {'proveedor_simulado': True, 'trabajadores_habilitados': True}


def phase_guard(op):
    names = ['cooper', 'n8n', 'runner', 'caddy']
    if (op.state / 'chat-tunel.enabled').exists():
        names += ['chat-cooper', 'chat-n8n', 'chat-runner']
    files = {name: operar.digest(operar.DEPLOY / name) if (operar.DEPLOY / name).exists() else None for name in PUBLICOS}
    for name in ('release.json', 'anterior.json', 'chat-tunel.enabled'):
        path = op.state / name
        files['estado/' + name] = operar.digest(path) if path.exists() else None
    services = {}
    for name in names:
        cid = op.compose('ps', '--all', '-q', name).strip()
        operar.require(bool(re.fullmatch(r'[0-9a-f]{12,64}', cid)), 'Contenedor ausente o ambiguo')
        identity = operar.run([op.engine, 'inspect', '--format', '{{.Image}}', cid], env=op.env).strip().removeprefix('sha256:')
        operar.require(bool(re.fullmatch(r'[0-9a-f]{64}', identity)), 'Identidad de imagen no válida')
        services[name] = identity
    return {'servicios': services, 'archivos': files,
            'operator': operar.digest(Path(operar.__file__)), 'extra': operar.digest(Path(__file__))}


def assert_empty(op):
    with closing(sqlite3.connect((op.data / 'cooper/cooper.sqlite').resolve().as_uri() + '?mode=ro', uri=True)) as db:
        counts = {table: db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in ('cuentas_marca', 'piezas_marca', 'marca_ingestas')}
    operar.require(not any(counts.values()), 'Activación inicial requiere Marcas e ingesta vacías')
    return counts


def assert_contract(meta, source):
    operar.require(meta['ocupadas'] == 0 and set(IDS) <= set(meta['flujos']), 'Faltan workers o hay ejecuciones ocupadas')
    for wid in IDS:
        row = meta['flujos'][wid]
        flow = json.loads((source / (wid + '.json')).read_text())
        expected = digest([flow['nodes'], flow['connections'], flow['settings']])
        operar.require(row['contenido'] == expected, 'Definición distinta de la fuente certificada')
        operar.require(not row['active'] and row['publicada'] is None and row['version'], 'Worker ya publicado o sin versión')
    return {wid: meta['flujos'][wid]['contenido'] for wid in IDS}


def prepare(op, source):
    meta = metadata(op.data / 'n8n/database.sqlite')
    hashes = assert_contract(meta, source)
    counts = assert_empty(op)
    return {'version': 1, 'estado': 'PREPARADO', 'objetivos': list(IDS), 'runtime': guard_runtime(op),
            'fase': phase_guard(op), 'antes': meta, 'contratos': hashes, 'conteos': counts}


def read_receipt(path, expected, state, status):
    checked = checked_path(path, state)
    operar.require(operar.digest(checked) == expected, 'Recibo distinto de su SHA-256 explícito')
    result = json.loads(checked.read_text())
    operar.require(result.get('estado') == status and result.get('objetivos') == list(IDS), 'Recibo ajeno o incompleto')
    return result


def validate_cas(op, receipt, reverse=False):
    operar.require(phase_guard(op) == receipt['fase'], 'Cambió fase app/infra: conciliar antes de operar')
    expected = receipt['despues'] if reverse else receipt['antes']
    actual = metadata(op.data / 'n8n/database.sqlite')
    operar.require(actual == expected and actual['ocupadas'] == 0, 'Cambió lote, publicación o ejecuciones: conciliar antes de operar')
    if not reverse:
        assert_empty(op)
    return actual


def validate_transition(before, after, enabled):
    operar.require(not after['ocupadas'] and before['esperas'] == after['esperas'], 'Cambió una espera o apareció ejecución')
    operar.require(set(before['flujos']) == set(after['flujos']), 'Cambió inventario de workflows')
    for wid, previous in before['flujos'].items():
        actual = after['flujos'][wid]
        if wid not in IDS:
            operar.require(actual == previous, 'Cambió un workflow ajeno')
        else:
            operar.require(actual['contenido'] == previous['contenido'] and actual['version'] == previous['version'], 'Cambió contenido o versión del worker')
            operar.require(actual['active'] is enabled and actual['publicada'] == (actual['version'] if enabled else None), 'Estado publicado no corresponde al plan')


def change(op, receipt, output, reverse=False):
    output = checked_path(output, op.state, exists=False)
    operar.require(output.parent.is_dir() and not output.exists(), 'El recibo exige salida nueva')
    guard_runtime(op)
    before = validate_cas(op, receipt, reverse)
    inventory = module('ensayar-n8n')
    previous = inventory.inventory(op.data / 'n8n/database.sqlite')
    marker = op.state / 'mantenimiento'
    operar.require(not marker.exists(), 'Hay otra operación en mantenimiento')
    marker.touch(mode=0o600)
    snapshot = None
    result = {'version': 1, 'estado': 'PREPARADO', 'objetivos': list(IDS), 'operacion': 'revertir' if reverse else 'activar',
              'fase': receipt['fase'], 'antes': before, 'runtime': receipt['runtime']}
    try:
        snapshot = op.snapshot(resume=False, tag='reversion')
        result['snapshot_previo'] = snapshot
        operar.write_json(output, result)
        # La copia detiene escritores: CAS nuevamente antes de cualquier publicación.
        validate_cas(op, receipt, reverse)
        for wid in IDS:
            op.compose('run', '--rm', '--no-deps', '-T', '--entrypoint', 'n8n', 'n8n',
                       'unpublish:workflow' if reverse else 'publish:workflow', '--id=' + wid,
                       *([] if reverse else ['--versionId=' + before['flujos'][wid]['version']]))
        after = metadata(op.data / 'n8n/database.sqlite')
        validate_transition(before, after, not reverse)
        current = inventory.inventory(op.data / 'n8n/database.sqlite', previous['columnas'])
        operar.require(current['datos'] == previous['datos'], 'Cambió tabla de negocio')
        op.compose('up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '180')
        guard_runtime(op)
        operar.require(phase_guard(op) == receipt['fase'], 'Cambió identidad de app/infra al arrancar')
        result.update(estado='PASS', despues=after, salud='PASS', tablas_preservadas=True)
        operar.write_json(output, result)
        marker.unlink()
        return result
    except Exception:
        if snapshot:
            op.compose('stop')
            restored = op.restore(snapshot, op.state / ('marcas-reversa-' + str(time.time_ns())))
            archived = op.state / ('n8n-marcas-fallido-' + str(time.time_ns()))
            (op.data / 'n8n').rename(archived)
            shutil.copytree(restored / 'n8n', op.data / 'n8n')
            op.ownership()
            operar.require(metadata(op.data / 'n8n/database.sqlite') == before, 'Reversa no conserva metadata previa')
            op.compose('up', '-d', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '180')
            operar.write_json(output, {**result, 'estado': 'FALLO_REVERTIDO', 'reversa': 'PASS', 'datos_archivados': str(archived)})
            marker.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('accion', choices=('preparar', 'activar', 'revertir'))
    parser.add_argument('--fuente', type=Path)
    parser.add_argument('--recibo', type=Path)
    parser.add_argument('--sha256')
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    operar.DEPLOY = Path('/opt/cooper/deploy')
    env, file = operar.config('/etc/cooper/.env')
    op = operar.Operator(env, file)
    with op.lock():
        if args.accion == 'preparar':
            operar.require(args.fuente is not None and not args.salida.exists(), 'Falta fuente o salida nueva')
            checked_path(args.salida, op.state, exists=False)
            result = prepare(op, args.fuente)
            operar.write_json(args.salida, result)
        else:
            operar.require(args.recibo is not None and args.sha256, 'Exigir recibo y SHA-256')
            receipt = read_receipt(args.recibo, args.sha256, op.state, 'PASS' if args.accion == 'revertir' else 'PREPARADO')
            result = change(op, receipt, args.salida, args.accion == 'revertir')
    print(json.dumps({'estado': result['estado'], 'objetivos': list(IDS), 'recibo_sha256': operar.digest(args.salida)}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Operación Marcas detenida; comprobar recibo, fase y guardianes. Salida privada omitida.', file=sys.stderr)
        sys.exit(1)
