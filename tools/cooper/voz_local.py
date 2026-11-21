#!/usr/bin/env python3
"""Sintetiza español con Piper instalado, en CPU y sin acceso a la red.

Uso desde la raíz::

    python3 tools/cooper/voz_local.py --texto-archivo guion.txt --salida voz.wav

Se requieren un intérprete con piper-tts, modelo ONNX y JSON ya disponibles.
Las rutas por defecto corresponden a la instalación local encontrada para esta
misión; --python-piper y --modelo permiten usar otra instalación existente.
No instala, descarga, consulta servicios ni carga variables de un archivo .env.
El hijo recibe un entorno limpio y una red aislada mediante unshare de Linux.
Salida: WAV PCM16 mono a la frecuencia nativa (davefx: 22050 Hz), más metadatos
JSON por stdout. FFmpeg puede remuestrearlo para el contrato PCM de n8n.

API comprobada con Piper 1.8.0:
https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md
Ficha actual de la voz (cotejar su revisión con el hash local antes de distribuir):
https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/davefx/medium/MODEL_CARD
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave


MEDIOS = Path.home() / '.local/share/directora/herramientas/medios'
PYTHON_PIPER = MEDIOS / 'venv/bin/python'
MODELO_PIPER = MEDIOS / 'voces/es_ES-davefx-medium.onnx'

# Cargamos la API, no el servidor ni el descargador de voces. -I/-B evita
# PYTHONPATH, user site y escrituras de bytecode en la instalación compartida.
SINTESIS = r'''
import json
import sys
import wave
from importlib.metadata import version
import onnxruntime
onnxruntime.disable_telemetry_events()
from piper import PiperVoice, SynthesisConfig

modelo, configuracion, salida, escala = sys.argv[1:]
voz = PiperVoice.load(modelo, config_path=configuracion, use_cuda=False)
if voz.config.espeak_voice != 'es':
    raise ValueError('Esta ruta de ensayo requiere un modelo español local.')
with wave.open(salida, 'wb') as archivo:
    voz.synthesize_wav(
        sys.stdin.read(), archivo,
        syn_config=SynthesisConfig(length_scale=float(escala), volume=0.9),
    )
print(json.dumps({'proveedor': 'piper-local', 'version': version('piper-tts')}))
'''


class VozLocalError(Exception):
    """Fallo explícito: nunca sustituir la narración por un tono o API."""


def archivo_existente(path, etiqueta):
    """Rechaza archivos de entorno antes de abrir cualquier ruta de entrada."""
    if any(parte == '.env' or parte.startswith('.env.') for parte in path.parts):
        raise VozLocalError(f'{etiqueta}: archivo de entorno no permitido.')
    if not path.is_file():
        raise VozLocalError(f'{etiqueta}: falta un archivo local requerido.')
    resuelto = path.resolve(strict=True)
    if any(parte == '.env' or parte.startswith('.env.') for parte in resuelto.parts):
        raise VozLocalError(f'{etiqueta}: archivo de entorno no permitido.')
    return resuelto


def sha256(path):
    with path.open('rb') as archivo:
        return hashlib.file_digest(archivo, 'sha256').hexdigest()


def sintetizar(texto_archivo, salida, python_piper, modelo, escala=1.0):
    texto_archivo = archivo_existente(Path(texto_archivo), 'Texto')
    # No resolver el symlink de bin/python: su ubicación identifica el venv.
    python_piper = Path(python_piper).absolute()
    archivo_existente(python_piper, 'Intérprete Piper')
    modelo = archivo_existente(Path(modelo), 'Modelo Piper')
    configuracion = archivo_existente(Path(str(modelo) + '.json'), 'Configuración Piper')
    salida = Path(salida).absolute()
    if salida.suffix.lower() != '.wav':
        raise VozLocalError('La salida debe tener extensión .wav.')
    if salida.exists():
        raise VozLocalError('La salida ya existe; elige otra ruta para conservarla.')
    if not math.isfinite(escala) or not 0.5 <= escala <= 2:
        raise VozLocalError('La escala de duración debe estar entre 0.5 y 2.')
    if texto_archivo.stat().st_size > 40000:
        raise VozLocalError('El texto supera el límite de 40000 bytes del ensayo.')
    texto = texto_archivo.read_text(encoding='utf-8').strip()
    if not texto or len(texto) > 10000:
        raise VozLocalError('El texto debe contener entre 1 y 10000 caracteres.')
    if not os.access(python_piper, os.X_OK):
        raise VozLocalError('El intérprete Piper no es ejecutable.')
    unshare = shutil.which('unshare', path=os.defpath)
    if not unshare:
        raise VozLocalError('Falta unshare; no se sintetiza sin aislamiento de red.')

    salida.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='voz-local-', dir=salida.parent) as temporal:
        wav = Path(temporal) / 'voz.wav'
        resultado = subprocess.run(
            [unshare, '--user', '--map-root-user', '--net', str(python_piper),
             '-I', '-B', '-c', SINTESIS, str(modelo), str(configuracion),
             str(wav), str(escala)],
            input=texto, text=True, capture_output=True, cwd=temporal,
            env={'PATH': os.defpath, 'LANG': 'C.UTF-8', 'XDG_CACHE_HOME': temporal},
            timeout=180, check=False,
        )
        if resultado.returncode:
            raise VozLocalError(
                'Piper local o el aislamiento de red falló '
                f'(código {resultado.returncode}); no hubo respaldo externo.'
            )
        if resultado.stderr.strip():
            raise VozLocalError('Piper emitió un diagnóstico; revisar la instalación local.')
        proveedor = json.loads(resultado.stdout)
        with wave.open(str(wav), 'rb') as audio:
            frecuencia = audio.getframerate()
            fotogramas = audio.getnframes()
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or not fotogramas:
                raise VozLocalError('Piper no produjo PCM16 mono con muestras.')
            pcm = audio.readframes(fotogramas)
            if not any(pcm):
                raise VozLocalError('Piper produjo silencio completo.')
        # Creación exclusiva: tampoco sustituir una salida creada en paralelo.
        with salida.open('xb') as destino, wav.open('rb') as fuente:
            shutil.copyfileobj(fuente, destino)
    return {
        **proveedor,
        'modelo': modelo.name,
        'modelo_sha256': sha256(modelo),
        'config_sha256': sha256(configuracion),
        'texto_sha256': hashlib.sha256(texto.encode('utf-8')).hexdigest(),
        'wav_sha256': sha256(salida),
        'frecuencia_hz': frecuencia,
        'canales': 1,
        'formato': 'pcm_s16le',
        'muestras': fotogramas,
        'duracion_s': round(fotogramas / frecuencia, 6),
        'aislamiento_red': 'unshare --user --map-root-user --net',
        'costo_api_usd': 0,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--texto-archivo', required=True, type=Path)
    parser.add_argument('--salida', required=True, type=Path)
    parser.add_argument('--python-piper', type=Path, default=PYTHON_PIPER)
    parser.add_argument('--modelo', type=Path, default=MODELO_PIPER)
    parser.add_argument('--escala-duracion', type=float, default=1.0)
    args = parser.parse_args()
    try:
        evidencia = sintetizar(
            args.texto_archivo, args.salida, args.python_piper,
            args.modelo, args.escala_duracion,
        )
    except (VozLocalError, OSError, ValueError, wave.Error, subprocess.TimeoutExpired) as error:
        print(f'Voz local: {error}', file=sys.stderr)
        return 1
    print(json.dumps(evidencia, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
