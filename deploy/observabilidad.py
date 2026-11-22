"""Proyección pública del monitor: solo métricas y estados de una lista cerrada."""
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import tempfile


SERVICES = ('cooper', 'n8n', 'runner', 'caddy')
CERTIFICATES = ('cooper', 'n8n')
BACKUPS = {'copy': 30 * 3600, 'replica': 36 * 3600}


def number(value):
    """JSON nunca recibe NaN, booleanos disfrazados de cifras ni valores negativos."""
    if type(value) not in (int, float) or value < 0 or value > 2**53 - 1 or not math.isfinite(value):
        return None
    return value


def timestamp(value):
    value = number(value)
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(value, timezone.utc).isoformat().replace('+00:00', 'Z')
    except (OverflowError, OSError, ValueError):
        return None


def memory(path=Path('/proc/meminfo')):
    """Memoria del host Linux; no estima disponible a partir de memoria libre."""
    result = {'totalBytes': None, 'availableBytes': None}
    names = {'MemTotal:': 'totalBytes', 'MemAvailable:': 'availableBytes'}
    try:
        for line in Path(path).read_text(encoding='ascii').splitlines():
            fields = line.split()
            if len(fields) == 3 and fields[0] in names and fields[2] == 'kB':
                result[names[fields[0]]] = number(int(fields[1]) * 1024)
    except (OSError, ValueError, UnicodeError):
        return {'totalBytes': None, 'availableBytes': None}
    if result['totalBytes'] is not None and result['availableBytes'] is not None:
        if result['totalBytes'] <= 0 or result['availableBytes'] > result['totalBytes']:
            return {'totalBytes': None, 'availableBytes': None}
    return result


def snapshot(now, observed=None, maintenance=False):
    """Reconstruye cada campo permitido; jamás serializa el entorno ni errores."""
    observed = observed or {}
    result = {
        'schemaVersion': 1,
        'collectedAt': timestamp(now),
        'maintenance': bool(maintenance),
        'disk': {'totalBytes': None, 'freeBytes': None},
        'memory': {'totalBytes': None, 'availableBytes': None},
        'certificates': {},
        'backups': {},
        'services': {},
    }
    for section, metric in (('disk', 'freeBytes'), ('memory', 'availableBytes')):
        source = observed.get(section, {}) if not maintenance else {}
        total, available = number(source.get('totalBytes')), number(source.get(metric))
        if total is not None and available is not None and total > 0 and available <= total:
            result[section] = {'totalBytes': total, metric: available}
    for name in CERTIFICATES:
        expires = number(observed.get('certificates', {}).get(name)) if not maintenance else None
        date = timestamp(expires)
        state = 'unknown' if date is None else 'expired' if expires <= now else 'expiring' if expires - now <= 14 * 86400 else 'ok'
        result['certificates'][name] = {'state': state, 'expiresAt': date}
    for name, maximum in BACKUPS.items():
        elapsed = observed.get('backups', {}).get(name) if not maintenance else None
        # monitor.age admite hasta 300 s de deriva del reloj. Una edad negativa
        # sigue siendo desconocida aquí: nunca publicamos una copia futura.
        elapsed = number(elapsed)
        completed = timestamp(now - elapsed) if elapsed is not None else None
        result['backups'][name] = {
            'state': 'unknown' if completed is None else 'stale' if elapsed > maximum else 'ok',
            'completedAt': completed,
            'ageHours': round(elapsed / 3600, 4) if completed is not None else None,
        }
    for name in SERVICES:
        state = observed.get('services', {}).get(name) if not maintenance else None
        result['services'][name] = state if state in ('ok', 'down') else 'unknown'
    return result


def write_snapshot(state_root, now, observed=None, maintenance=False):
    """Sustituye atómicamente el único fichero que puede montar la web."""
    directory = Path(state_root) / 'observabilidad'
    if directory.is_symlink():
        raise OSError('Directorio de observabilidad inválido')
    directory.mkdir(mode=0o755, parents=False, exist_ok=True)
    # Solo este directorio saneado es legible por el usuario 1000 del contenedor.
    # STATE_ROOT y el resto de recibos mantienen sus permisos privados originales.
    directory.chmod(0o755)
    payload = snapshot(now, observed, maintenance)
    temporary = None
    try:
        descriptor, temporary = tempfile.mkstemp(prefix='.estado-', suffix='.tmp', dir=directory)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            json.dump(payload, stream, ensure_ascii=True, allow_nan=False, separators=(',', ':'))
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
            os.fchmod(stream.fileno(), 0o644)
        os.replace(temporary, directory / 'estado.json')
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)
    return payload
