#!/usr/bin/env python3
"""CLI n8n real sin red: activación, reversa post-PASS y fallo con restauración."""
import argparse
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import uuid

DEPLOY = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('horario_real', DEPLOY / 'horario-radar.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.configure(DEPLOY)


class OfflineOperator:
    def __init__(self, root, source):
        self.data, self.state = root / 'datos', root / 'estado'
        (self.data / 'n8n').mkdir(mode=0o700, parents=True)
        self.state.mkdir(mode=0o700)
        with m.read_base(source) as read, closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as write:
            read.backup(write)
        self.fail = False

    def snapshot(self, **_):
        self.saved = self.state / ('snapshot-' + uuid.uuid4().hex)
        shutil.copytree(self.data, self.saved)
        return m.op.digest(self.saved / 'n8n/database.sqlite')

    def restore(self, snapshot, destination):
        m.op.require(snapshot == m.op.digest(self.saved / 'n8n/database.sqlite'), 'Respaldo opaco alterado')
        shutil.copytree(self.saved, destination)
        return destination

    def ownership(self):
        pass

    def compose(self, *args):
        if args[0] in ('up', 'stop'):
            return ''  # No hay servidor/cron: el laboratorio ejecuta solo la CLI.
        m.op.require(args[0] == 'run', 'Acción ajena al laboratorio')
        mount = args[args.index('-v') + 1]
        entrypoint = args[args.index('--entrypoint') + 1]
        tail = args[args.index('--entrypoint') + 3:]
        if self.fail and tail == ('/lote/publicar.cjs',):
            self.fail = False
            raise RuntimeError('Fallo de publicación inyectado')
        name = 'cooper-radar-offline-' + uuid.uuid4().hex[:10]
        command = ['podman', 'run', '--rm', '--pull', 'never', '--name', name,
                   '--network', 'none', '--cpuset-cpus', '8-15', '--cpus', '0.5', '--read-only',
                   '--userns', 'keep-id', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                   '--tmpfs', '/tmp:rw,size=128m,mode=1777', '-v', str(self.data / 'n8n') + ':/home/node/.n8n:rw',
                   '-v', mount, '-e', 'N8N_ENCRYPTION_KEY=' + m.trial.DUMMY_KEY,
                   '-e', 'N8N_DIAGNOSTICS_ENABLED=false', '-e', 'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
                   '-e', 'N8N_TEMPLATES_ENABLED=false', '-e', 'N8N_LOG_LEVEL=error',
                   '--entrypoint', entrypoint, m.trial.IMAGE, *tail]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=180)
            m.op.require(result.returncode == 0, 'CLI offline falló; salida privada omitida')
            return result.stdout
        finally:
            subprocess.run(['podman', 'rm', '-f', name], capture_output=True, timeout=30)


def prepare_trial(base, folder, reverse=None):
    folder.mkdir(mode=0o700, parents=True)
    exported = folder / 'export'
    exported.mkdir(mode=0o700)
    with m.read_base(base) as read, closing(sqlite3.connect(exported / 'database.sqlite')) as write:
        read.backup(write)
    m.op.write_json(folder / 'entrada.json', [])
    m.op.write_json(folder / 'columnas.json', {'tablas': {}})
    m.trial.run_container(exported, folder / 'entrada.json', folder / 'columnas.json', DEPLOY / 'n8n-columnas.cjs',
                         'n8n', ['export:workflow', '--all', '--output=/home/node/.n8n/export.json'])
    flows, diff = m.prepare(exported / 'database.sqlite', json.loads((exported / 'export.json').read_text()), reverse)
    for name, value in [('entrada.json', flows), ('diff.json', diff), ('publicar.json', [m.ID])]:
        m.op.write_json(folder / name, value)
    proof = m.trial.rehearse(base, folder / 'entrada.json', folder / 'columnas.json', DEPLOY / 'n8n-columnas.cjs',
                             folder / 'ensayo', folder / 'publicar.json')
    m.validate_current(folder / 'ensayo/actualizada/database.sqlite', diff, despues=True)
    m.validate_current(folder / 'ensayo/revertida/database.sqlite', diff)
    proof.update({'extra_sha256': m.op.digest(DEPLOY / 'horario-radar.py'),
                  'diff_sha256': m.op.digest(folder / 'diff.json'), 'helpers_sha256': m.helper_hashes()})
    m.op.write_json(folder / 'ensayo/resultado.json', proof)
    return proof


def main():
    os.umask(0o077)
    os.environ['COOPER_ENSAYO_CPUSET'] = '8-15'
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    operator = OfflineOperator(args.salida / 'operador', args.base)
    base = operator.data / 'n8n/database.sqlite'
    before = m.trial.inventory(base)
    proof = prepare_trial(base, args.salida / 'activar')
    result = m.apply(operator, args.salida / 'activar', proof, operator.state / 'activado.json')
    reverse = prepare_trial(base, args.salida / 'revertir', result)
    reverted = m.apply(operator, args.salida / 'revertir', reverse, operator.state / 'revertido.json')
    m.op.require(result['disabled_despues'] is False and reverted['disabled_despues'] is True, 'Ciclo horario incompleto')
    m.op.require(before['datos'] == m.trial.inventory(base)['datos'], 'Cambió negocio')
    proof2 = prepare_trial(base, args.salida / 'fallo')
    snapshot_hash = m.op.digest(base)
    operator.fail = True
    try:
        m.apply(operator, args.salida / 'fallo', proof2, operator.state / 'fallo.json')
    except RuntimeError:
        pass
    else:
        raise RuntimeError('Fallo no ejercitado')
    failed = json.loads((operator.state / 'fallo.json').read_text())
    m.op.require(failed['estado'] == 'FALLO_REVERTIDO' and m.op.digest(base) == snapshot_hash, 'Reversa de fallo no exacta')
    public = {'estado': 'PASS', 'red': 'none', 'puertos': [], 'servidor_cron': False,
              'aplicador_certificado': 'sin cambios; adaptador de política y Operator offline',
              'activacion': 'PASS', 'reversa_post_PASS': 'PASS', 'fallo_inyectado_revertido_bytes': 'PASS',
              'tablas_negocio_preservadas': len(before['datos']), 'workflows_ajenos_preservados': len(before['flujos']) - 1,
              'credenciales_valores_leidos': False, 'horario': '7:40; zona del workflow conservada',
              'extra_sha256': m.op.digest(DEPLOY / 'horario-radar.py'), 'helpers_sha256': m.helper_hashes(),
              'fuentes_sha256': result['fuentes_sha256'],
              'recibos_sha256': {name: m.op.digest(operator.state / (name + '.json')) for name in ('activado', 'revertido', 'fallo')}}
    m.op.write_json(args.salida / 'resultado-publico.json', public)
    print(json.dumps(public))


if __name__ == '__main__':
    try:
        main()
    except Exception as ex:
        print('Laboratorio Radar detenido: ' + type(ex).__name__ + '; salida privada omitida.', file=sys.stderr)
        sys.exit(1)
