#!/usr/bin/env python3
"""Recibo mínimo de la PC para monitorear antigüedad de la copia externa."""
import json
import os
import re
import sys
import time
from pathlib import Path

import operar


def receipt(row, now):
    operar.require(row.get('restauracion') == 'PASS', 'Restauración no verificada')
    operar.require(bool(re.fullmatch('[0-9a-f]{64}', row.get('snapshot', ''))), 'Snapshot inválido')
    operar.require(abs(now - int(row.get('fecha', 0))) <= 300, 'Recibo vencido')
    return {key: row[key] for key in ('snapshot', 'fecha', 'restauracion')}


if __name__ == '__main__':
    try:
        os.umask(0o077)
        data = sys.stdin.read(4097)
        operar.require(len(data) <= 4096, 'Recibo demasiado grande')
        row = receipt(json.loads(data), int(time.time()))
        operar.write_json(Path('/var/lib/cooper-operacion/ultima-replica.json'), row)
        print('PASS: réplica externa registrada')
    except (OSError, ValueError, TypeError, RuntimeError, KeyError):
        print('Recibo de réplica rechazado', file=sys.stderr)
        sys.exit(1)
