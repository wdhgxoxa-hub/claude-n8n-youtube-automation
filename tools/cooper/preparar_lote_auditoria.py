"""Lote n8n revisable desde Git: entrada, reversa de referencia y diff semántico.

Sigue el formato local de preparar_lote_cobertura.py; nunca conecta con n8n.
"""
import argparse
import copy
import difflib
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = 'de397f3'
GUIA = 'docs/cooper-n8n-auditoria-lote.md'
WORKFLOWS = 'workflows/v2'


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)


def serializar(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def semantica(workflow):
    """Ignora solo IDs internos regenerables; conserva IDs y referencias de negocio."""
    def recorrer(value, ruta=()):
        if isinstance(value, list):
            return [recorrer(item, ruta + (index,)) for index, item in enumerate(value)]
        if not isinstance(value, dict):
            return value
        condicion = (len(ruta) >= 2 and ruta[-2] == 'conditions'
                     and isinstance(ruta[-1], int) and 'operator' in value)
        nodo = len(ruta) == 2 and ruta[0] == 'nodes' and isinstance(ruta[1], int)
        return {key: recorrer(item, ruta + (key,)) for key, item in value.items()
                if not (key == 'id' and (nodo or condicion))}

    return recorrer(workflow)


def inactivo(workflow):
    result = copy.deepcopy(workflow)
    result['active'] = False
    # Los JSON versionados normalmente no traen versiones publicadas. Nunca
    # trasladar una si una exportación futura llega a incorporarla.
    if 'activeVersionId' in result:
        result['activeVersionId'] = None
    result.pop('activeVersion', None)
    return result


def leer_workflows(root, commit):
    paths = git(root, 'ls-tree', '-r', '--name-only', commit, '--', WORKFLOWS).decode().splitlines()
    result = {}
    ids = set()
    for path in sorted(p for p in paths if p.endswith('.json')):
        raw = git(root, 'show', f'{commit}:{path}')
        workflow = json.loads(raw)
        if (not isinstance(workflow, dict) or not isinstance(workflow.get('id'), str)
                or not workflow['id'] or not isinstance(workflow.get('name'), str)
                or not isinstance(workflow.get('nodes'), list)
                or not isinstance(workflow.get('connections'), dict)):
            raise ValueError(f'Exportación inválida: {path}')
        if workflow['id'] in ids:
            raise ValueError(f'ID de workflow duplicado en {commit}: {workflow["id"]}')
        ids.add(workflow['id'])
        result[path] = {'workflow': workflow, 'sha256_fuente': sha256(raw)}
    return result


def preparar(output, *, root=ROOT, base=BASE, expected_count=33):
    root, output = Path(root).resolve(), Path(output).resolve()
    if output.exists():
        raise ValueError('La carpeta de salida ya existe; elegir otra para conservar la evidencia.')
    if git(root, 'status', '--porcelain=v1', '--untracked-files=all', '--', WORKFLOWS).strip():
        raise ValueError('workflows/v2 tiene cambios sin commit; el lote exige fuentes limpias de HEAD.')
    head = git(root, 'rev-parse', '--verify', 'HEAD^{commit}').decode().strip()
    reference = git(root, 'rev-parse', '--verify', f'{base}^{{commit}}').decode().strip()
    git(root, 'merge-base', '--is-ancestor', reference, head)
    current, previous = leer_workflows(root, head), leer_workflows(root, reference)
    if len(current) != expected_count:
        raise ValueError(f'HEAD contiene {len(current)} workflows; se esperaban {expected_count}.')
    files = {'LEER-ANTES.md': git(root, 'show', f'{head}:{GUIA}')}
    manifest = {
        'version': 1, 'mision': 'total-n8n-auditoria', 'origen': head,
        'base_referencia': reference, 'respaldo_real': False,
        'activacion_automatica': False, 'total_entrada': len(current),
        'total_reversa_versionada': len(previous),
        'transformacion': 'active=false; activeVersionId=null si existe; sin activeVersion',
        'diff_semantico': 'Conserva todo salvo IDs internos de nodos y condiciones n8n.',
        'archivos': [],
    }
    sources = {}
    for prefix, commit, workflows in [('entrada', head, current), ('reversa-versionada', reference, previous)]:
        for path, entry in workflows.items():
            destination = f'{prefix}/{path}'
            files[destination] = serializar(inactivo(entry['workflow']))
            sources[destination] = {'commit_fuente': commit, 'sha256_fuente': entry['sha256_fuente']}

    changes, patches = [], []
    for path in sorted(current.keys() | previous.keys()):
        before = previous.get(path)
        after = current.get(path)
        old = serializar(semantica(before['workflow'])).decode() if before else ''
        new = serializar(semantica(after['workflow'])).decode() if after else ''
        state = 'alta' if before is None else 'baja' if after is None else 'modificado' if old != new else 'sin_cambio_semantico'
        changes.append({'ruta': path, 'estado': state,
                        'id_base': before['workflow']['id'] if before else None,
                        'id_entrada': after['workflow']['id'] if after else None})
        if old != new:
            patches.extend(difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True),
                                               fromfile=f'base/{path}' if before else '/dev/null',
                                               tofile=f'HEAD/{path}' if after else '/dev/null'))
    files['diff-semantico.patch'] = ''.join(patches).encode()
    files['cambios.json'] = serializar(changes)
    for kind, name in [('alta', 'altas.txt'), ('baja', 'bajas.txt')]:
        paths = [item['ruta'] for item in changes if item['estado'] == kind]
        files[name] = (''.join(f'{path}\n' for path in paths)).encode()
    by_id = {}
    for side, workflows in [('base', previous), ('entrada', current)]:
        for path, entry in workflows.items():
            workflow = entry['workflow']
            row = by_id.setdefault(workflow['id'], {'id_versionado': workflow['id'],
                'id_destino': None, 'pila_destino': None, 'revisado': False,
                'ruta_base': None, 'ruta_entrada': None})
            row[f'ruta_{side}'] = path
            row[f'nombre_{side}'] = workflow['name']
    files['mapa-ids.json'] = serializar([by_id[key] for key in sorted(by_id)])
    for path, data in sorted(files.items()):
        manifest['archivos'].append({'ruta': path, 'sha256': sha256(data), **sources.get(path, {})})
    files['manifest.json'] = serializar(manifest)
    # El manifiesto cubre los artefactos; SHA256SUMS cubre además el manifiesto.
    files['SHA256SUMS'] = ''.join(f'{sha256(data)}  {path}\n' for path, data in sorted(files.items())).encode()
    output.mkdir(parents=True, exist_ok=False)
    for path, data in sorted(files.items()):
        destination = output / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--salida', type=Path, default=ROOT / 'cooper/.cache/lote-total-n8n-auditoria')
    parser.add_argument('--base', default=BASE)
    parser.add_argument('--cantidad-esperada', type=int, default=33)
    args = parser.parse_args()
    try:
        result = preparar(args.salida, base=args.base, expected_count=args.cantidad_esperada)
    except (ValueError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        # No imprimir stdout/stderr de Git: solo diagnóstico local y no contenido.
        parser.exit(1, f'No se preparó el lote: {error if isinstance(error, ValueError) else "referencia Git no disponible o base no ancestral"}\n')
    print(f'Lote local: {result["total_entrada"]} workflows inactivos; reversa versionada, diff y SHA-256. Sin acceso a n8n.')
