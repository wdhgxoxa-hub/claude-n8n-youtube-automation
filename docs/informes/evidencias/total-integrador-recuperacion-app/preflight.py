#!/usr/bin/env python3
"""Comprueba únicamente código público; no importa helpers ni consume entorno."""
import hashlib
import json
from pathlib import Path
import sys

STAGING = Path('/home/operador/total-integrador-20261121')
MANIFEST = STAGING / 'recuperacion-app-b3/codigo.json'
BUNDLE = STAGING / 'aplicadores-certificados-b3e608e/bundle'
EXTRA = STAGING / 'recuperacion-app-b3/recuperar-app.py'
INFRA = STAGING / 'recuperacion-infra-b3/recuperar-infra.py'


def require(value):
    if not value:
        raise RuntimeError('Contrato público incumplido')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(expected, *, manifest=MANIFEST, bundle=BUNDLE, extra=EXTRA, infra=INFRA):
    require(manifest.is_file() and not manifest.is_symlink())
    require(sha(manifest) == expected)
    data = json.loads(manifest.read_text())
    require(data['version'] == 1 and len(data['bundle']) == 25)
    require(set(data['extras']) == {'recuperar-app.py', 'recuperar-infra.py'})
    paths = {bundle / name: value for name, value in data['bundle'].items()}
    paths.update({extra: data['extras']['recuperar-app.py'], infra: data['extras']['recuperar-infra.py']})
    for path, value in paths.items():
        require(path.is_file() and not path.is_symlink() and path.resolve() == path)
        require(sha(path) == value)
    require({str(p.relative_to(bundle)) for p in (bundle / 'deploy').iterdir()} ==
            {name for name in data['bundle'] if name.startswith('deploy/')})
    return {'estado': 'PREFLIGHT_PASS', 'archivos_publicos': len(paths),
            'entorno_consumido': False, 'estado_operativo_creado': False, 'mutaciones': False}


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2)
        print(json.dumps(verify(sys.argv[1])))
    except Exception:
        print('Preflight de código público rechazado.', file=sys.stderr)
        sys.exit(1)
