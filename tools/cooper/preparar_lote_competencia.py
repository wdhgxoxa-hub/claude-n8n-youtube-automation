"""Diff y exportaciones de competencia para el orquestador. Solo lee Git, sin red."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = 'de397f3'
FUENTES = [
    'workflows/v2', 'tools/generar_flujos_v2.py',
    'tools/cooper/competencia_flujos.py', 'tools/cooper/cobertura.js',
    'cooper/src/contratos/competencia.mjs', 'skill/FABRICA.md',
    'servicios/puente-codex/server.mjs',
]


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def preparar(salida, base):
    head = git('rev-parse', 'HEAD').decode().strip()
    base = git('rev-parse', '--verify', base + '^{commit}').decode().strip()
    subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', base, head], check=True)
    cambios = [linea.split('\t', 1) for linea in git(
        'diff', '--name-status', '--no-renames', base, head, '--', 'workflows/v2'
    ).decode().splitlines()]
    salida.mkdir(parents=True, exist_ok=False)
    manifest = {'origen': head, 'base_referencia': base, 'respaldo_real': False,
                'desplegado': False, 'archivos': [], 'flujos': []}

    def guardar(ruta, contenido):
        destino = salida / ruta
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(contenido)
        manifest['archivos'].append({'ruta': ruta, 'sha256': hashlib.sha256(contenido).hexdigest()})

    for estado, path in cambios:
        anterior = None if estado == 'A' else git('show', f'{base}:{path}')
        nuevo = None if estado == 'D' else git('show', f'{head}:{path}')
        antes = json.loads(anterior) if anterior is not None else None
        despues = json.loads(nuevo) if nuevo is not None else None
        if despues is not None and despues.get('active') is not False:
            raise ValueError(f'El flujo debe estar inactivo: {path}')
        actual = despues if despues is not None else antes
        nodos = {n['name']: n for n in (antes or {}).get('nodes', [])}
        nuevos = (despues or {}).get('nodes', [])
        manifest['flujos'].append({
            'id': actual['id'], 'nombre': actual['name'], 'ruta': path,
            'cambio': {'A': 'alta', 'D': 'baja'}.get(estado, 'modificacion'),
            'referencia_anterior': anterior is not None,
            'nodos_modificados': [n['name'] for n in nuevos if n != nodos.get(n['name'])],
            'nodos_retirados': sorted(set(nodos) - {n['name'] for n in nuevos}),
            'conexiones_modificadas': (antes or {}).get('connections', {}) != (despues or {}).get('connections', {}),
        })
        if nuevo is not None:
            guardar('entrada/' + path, nuevo)
        if anterior is not None:
            guardar('referencia-anterior/' + path, anterior)
    guardar('flujos-y-fuentes.patch', git('diff', '--binary', base, head, '--', *FUENTES))
    guardar('LEER-ANTES.md', (
        '# Lote total-competencia\n\n'
        'Entrega offline: no es un respaldo del destino ni se ha desplegado. '
        'El manifiesto fija base, commit y SHA-256 de cada archivo.\n\n'
        '1. Integrar los commits del frente con aprendizaje y los demás frentes. '
        'El patch es una referencia revisable de flujos/fuentes; no incluye toda la web.\n'
        '2. Regenerar con `python3 tools/generar_flujos_v2.py` y ejecutar la puerta completa. '
        'Conservar ambas puertas antes de Nuevo video.\n'
        '3. Respaldar el destino real, preservar IDs/credenciales/tablas y aplicar el lote compuesto '
        'siguiendo docs/cooper-cobertura-despliegue.md. No sobrescribir ajustes vivos con defaults.\n'
        '4. Actualizar también la web, skill/FABRICA.md y el puente Codex: radar tiene 180 s, '
        'clientes 190 s, búsqueda pública sin respaldo API pago. No activar vidIQ.\n'
        '5. Aceptar un radar real por canal/marca: 3–5 cuentas con fuentes, outliers calculados, '
        'consultas del nombre en YouTube/TikTok y diferenciación Perú en el guion. '
        'Si falta evidencia, debe quedar parcial y detener la idea.\n\n'
        'La referencia anterior solo permite comparar versiones de Git; para reversa se usa el '
        'respaldo real conservando escrituras posteriores. Las altas no tienen una exportacion '
        'anterior inventada; las bajas describen Git y no son una orden de borrar flujos del destino. '
        'Las sondas vidIQ/YouTube son auxiliares '
        'manuales y quedan fuera del lote de producción. No se ejecutan al generarlo.\n'
    ).encode())
    (salida / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--salida', type=Path, required=True)
    parser.add_argument('--base', default=BASE)
    args = parser.parse_args()
    result = preparar(args.salida.resolve(), args.base)
    print(json.dumps({'flujos': len(result['flujos']), 'archivos': len(result['archivos']),
                      'origen': result['origen'], 'red': False}))
