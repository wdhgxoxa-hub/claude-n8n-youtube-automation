"""Compara exclusivamente nombres/tipos y referencias DataTable; no lee filas ni red."""
import argparse
import json
from pathlib import Path
import re

SISTEMA = {'id', 'createdAt', 'updatedAt'}
TIPOS = {'string', 'number', 'boolean', 'date'}
NOMBRE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]{0,99}$')


def comparar(actual, contrato):
    aliases = contrato.get('aliases', {})
    requeridas = contrato['tablas']
    if any(not NOMBRE.fullmatch(t) or any(not NOMBRE.fullmatch(c) or tipo not in TIPOS
           for c, tipo in columnas.items()) for t, columnas in requeridas.items()):
        raise ValueError('Contrato de esquema inválido')
    tablas = {aliases.get(t['nombre'], t['nombre']): t for t in actual['tablas']}
    por_id = {t['id']: t for t in actual['tablas']}
    faltantes, tipos, referencias, dinamicas = [], [], [], []
    for nombre, columnas in requeridas.items():
        real = tablas.get(nombre, {}).get('columnas', {})
        for campo, tipo in columnas.items():
            if campo not in real:
                faltantes.append({'tabla': nombre, 'columna': campo, 'tipo': tipo})
            elif real[campo] != tipo:
                tipos.append({'tabla': nombre, 'columna': campo, 'esperado': tipo,
                              'actual': real[campo] if real[campo] in TIPOS else 'no_reconocido'})
    for ref in actual.get('referencias', []):
        tabla = por_id.get(ref.get('tabla_id'))
        if tabla is None:
            referencias.append({'workflow': ref['workflow'], 'nodo': ref['nodo'],
                                'columna': None, 'tabla_presente': False})
            continue
        for campo in ref.get('filtros', []) + ref.get('campos_mapeados', []):
            campos = [campo]
            if isinstance(campo, str) and campo.startswith('={{'):
                # Selector canónico de Confirmar: nombre de columna, no expresión de valor.
                m = re.search(r"\?\s*'([A-Za-z_]\w*)'\s*:\s*'([A-Za-z_]\w*)'\s*}}$", campo)
                if m:
                    campos = list(m.groups())
                else:
                    dinamicas.append({'workflow': ref['workflow'], 'nodo': ref['nodo']})
                    continue
            for nombre in campos:
                if not isinstance(nombre, str) or not NOMBRE.fullmatch(nombre):
                    raise ValueError('Nombre de referencia inválido')
                if not tabla or nombre not in tabla['columnas'] and nombre not in SISTEMA:
                    referencias.append({'workflow': ref['workflow'], 'nodo': ref['nodo'],
                                        'columna': nombre, 'tabla_presente': tabla is not None})
    return {'ok': not (faltantes or tipos or referencias or dinamicas),
            'tablas_revisadas': len(requeridas), 'columnas_faltantes': faltantes,
            'tipos_incompatibles': tipos, 'referencias_incompatibles': referencias,
            'referencias_dinamicas_sin_resolver': dinamicas}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--actual', type=Path, required=True)
    parser.add_argument('--contrato', type=Path, default=Path(__file__).resolve().parents[2] / 'contratos/cooper-tablas-produccion.json')
    args = parser.parse_args()
    try:
        resultado = comparar(json.loads(args.actual.read_text()), json.loads(args.contrato.read_text()))
    except (KeyError, TypeError, ValueError, OSError):
        resultado = {'ok': False, 'error': 'Inventario o contrato de esquema inválido'}
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 0 if resultado['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
