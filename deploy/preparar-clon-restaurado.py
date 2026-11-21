#!/usr/bin/env python3
"""Prepara dos SQLite autónomas desde una restauración verificada, incluyendo WAL."""
import argparse
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import sys

import operar

BASES = ('cooper/cooper.sqlite', 'n8n/database.sqlite')


def prepare(source, destination):
    source, destination = source.resolve(), destination.resolve()
    operar.require(source.is_dir() and not destination.exists(), 'Restauración existente y destino nuevo requeridos')
    operar.require(not destination.is_relative_to(source), 'El clon debe quedar fuera de la restauración')
    # Se rechaza una copia de los .sqlite que omita sus WAL antes de crear el clon.
    expected = operar.verify(source)
    destination.mkdir(parents=True, mode=0o700)
    data = destination / 'datos'
    data.mkdir(mode=0o700)
    for name in BASES:
        original, copy = source / name, data / name
        copy.parent.mkdir(mode=0o700)
        with closing(sqlite3.connect(original.as_uri() + '?mode=ro', uri=True)) as read:
            with closing(sqlite3.connect(copy)) as write:
                read.backup(write)
                # Solo el clon cambia de journal; el origen restaurado permanece intacto.
                operar.require(write.execute('PRAGMA journal_mode=DELETE').fetchone() == ('delete',), 'El clon aún requiere WAL')
                operar.require(write.execute('PRAGMA integrity_check').fetchall() == [('ok',)], 'Integridad incorrecta')
                operar.require(write.execute('PRAGMA foreign_key_check').fetchall() == [], 'Claves foráneas incorrectas')
        copy.chmod(0o600)
        operar.require(not Path(str(copy) + '-wal').exists(), 'WAL inesperado en clon autónomo')
    actual = operar.manifest(data)
    operar.require(actual['tablas'] == expected['tablas'], 'El clon perdió tablas o filas')
    operar.require(operar.verify(source) == expected, 'La restauración cambió durante el clonado')
    operar.write_json(data / 'manifiesto.json', actual)
    receipt = {
        'restauracion_verificada': 'PASS', 'clonado': 'PASS',
        'integridad_y_claves_foraneas': 'PASS', 'origen_intacto': True,
        'manifiesto_origen_sha256': operar.digest(source / 'manifiesto.json'),
        'manifiesto_clon_sha256': operar.digest(data / 'manifiesto.json'),
        'wal_incorporados': [name + '-wal' for name in BASES if name + '-wal' in expected['archivos']],
        'bases': {name: {'sha256': actual['archivos'][name]['sha256'], 'tablas': len(actual['tablas'][name])} for name in BASES},
    }
    operar.write_json(destination / 'resultado.json', receipt)
    return receipt


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restauracion', type=Path, required=True, help='Directorio datos restaurado con manifiesto completo')
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.restauracion, args.salida), ensure_ascii=False))
    except (OSError, RuntimeError, ValueError, sqlite3.Error):
        print('Clon rechazado; restauración conservada y salida privada omitida.', file=sys.stderr)
        sys.exit(1)
