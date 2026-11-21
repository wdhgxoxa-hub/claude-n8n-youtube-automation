"""Empaqueta fuentes versionadas y una reversa de referencia, sin red ni credenciales."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = '16341ab09145d44b9e1f084f6142c707e422fac3'


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def preparar(output, base=BASE):
    base = git('rev-parse', '--verify', base + '^{commit}').decode().strip()
    output.mkdir(parents=True, exist_ok=False)
    head = git('rev-parse', 'HEAD').decode().strip()
    paths = [p for p in git('ls-files').decode().splitlines() if p.startswith(('workflows/v2/', 'cooper/drizzle/')) or p in ['contratos/cooper-migracion-tablas.json', 'contratos/cooper-tablas-ensayo.json']]
    manifest = {'origen': head, 'base_referencia': base, 'respaldo_real': False, 'archivos': []}
    for path in paths:
        for prefix, ref in [('entrada', head), ('reversa-versionada', base)]:
            if subprocess.run(['git', '-C', str(ROOT), 'cat-file', '-e', f'{ref}:{path}'], capture_output=True).returncode:
                continue
            data = git('show', f'{ref}:{path}')
            dest = output / prefix / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            manifest['archivos'].append({'ruta': str(dest.relative_to(output)), 'sha256': hashlib.sha256(data).hexdigest()})
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'LEER-ANTES.md').write_text((ROOT / 'docs/cooper-cobertura-despliegue.md').read_text().replace('`16341ab`', '`' + base + '`'))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--salida', type=Path, default=ROOT / 'cooper/.cache/lote-cobertura')
    parser.add_argument('--base', default=BASE, help='Commit de referencia para la reversa offline')
    args = parser.parse_args()
    data = preparar(args.salida.resolve(), args.base)
    print(f"Lote local: {len(data['archivos'])} archivos con SHA-256. No se accedió a n8n ni a un respaldo real.")
