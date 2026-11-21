"""Valida la caché privada fija antes de importar Sentinel; no descarga fuentes."""
import hashlib
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
COOPER = Path(__file__).resolve().parents[1]


def verificar_cache(directorio, manifiesto):
    origen = json.loads(manifiesto.read_text())
    archivos = origen.get('archivos', {})
    if not re.fullmatch(r'[a-f0-9]{40}', origen.get('revision', '')) or not archivos:
        raise ValueError('Manifiesto de Sentinel inválido')
    for archivo, esperado in archivos.items():
        if not re.fullmatch(r'src/sentinel/(?:[a-z_]+/)*[a-z_]+\.(?:py|js)', archivo) or not re.fullmatch(r'[a-f0-9]{64}', esperado):
            raise ValueError('Ruta o huella inválida en el manifiesto de Sentinel')
    if not directorio.exists() and not directorio.is_symlink():
        raise ValueError('Falta la caché privada de Sentinel. Ejecute npm run preparar:sentinel')
    pendientes = set(archivos)

    def recorrer(ruta):
        relativo = ruta.relative_to(directorio).as_posix()
        if ruta.is_symlink():
            raise ValueError('La caché de Sentinel no admite enlaces simbólicos')
        if ruta.is_dir():
            if relativo != '.' and not any(nombre.startswith(relativo + '/') for nombre in archivos):
                raise ValueError('Directorio inesperado en la caché de Sentinel')
            for hijo in ruta.iterdir():
                recorrer(hijo)
        else:
            if not ruta.is_file() or relativo not in archivos:
                raise ValueError('Archivo inesperado en la caché de Sentinel')
            if hashlib.sha256(ruta.read_bytes()).hexdigest() != archivos[relativo]:
                raise ValueError('Sentinel modificado: ' + relativo)
            pendientes.remove(relativo)

    recorrer(directorio)
    if pendientes:
        raise ValueError('Faltan archivos en la caché de Sentinel')
    return origen['revision']


def comprobar_sentinel():
    cache = COOPER / '.cache/sentinel'
    verificar_cache(cache, COOPER / 'ci/sentinel-origen.json')
    return cache / 'src'
