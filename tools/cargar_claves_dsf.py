#!/usr/bin/env python3
"""Pasa las claves que D&S Factory guarda en el llavero del sistema a credenciales de n8n.

Nunca imprime ni escribe en disco un valor: lee cada clave con `secret-tool`, arma el JSON
en memoria y se lo da a `n8n import:credentials` por la entrada estándar del contenedor.
No modifica nada de D&S Factory (solo lectura del llavero).

    python3 tools/cargar_claves_dsf.py          # muestra qué claves hay (solo nombres)
    python3 tools/cargar_claves_dsf.py --cargar PEXELS_API_KEY ...   # carga SOLO las nombradas

Nunca carga todas de golpe: una credencial que ya existe en n8n con una clave más nueva
(pegada a mano) se sobrescribiría con la del llavero, que puede estar vencida.
"""
import json
import shutil
import subprocess
import sys

CONTENEDOR = 'videos-n8n'
ATRIBUTO = 'dsf-credencial'
PREFIJO = 'DSF/entorno/'

# variable del llavero -> (id fijo en n8n, nombre visible, tipo de credencial, cabecera o parámetro, prefijo del valor)
MAPA = {
    'OPENAI_API_KEY': ('FabCredOpenAI001', 'OpenAI', 'httpHeaderAuth', 'Authorization', 'Bearer '),
    'GEMINI_API_KEY': ('FabCredGemini001', 'Gemini (Veo)', 'httpHeaderAuth', 'x-goog-api-key', ''),
    'ELEVENLABS_API_KEY': ('FabCredEleven001', 'ElevenLabs', 'httpHeaderAuth', 'xi-api-key', ''),
    'EPIDEMIC_API_KEY': ('FabCredEpidemic1', 'Epidemic Sound', 'httpHeaderAuth', 'Authorization', 'Bearer '),
    'FREESOUND_API_KEY': ('FabCredFreesnd01', 'Freesound', 'httpHeaderAuth', 'Authorization', 'Token '),
    'PEXELS_API_KEY': ('FabCredPexels001', 'Pexels', 'httpHeaderAuth', 'Authorization', ''),
    'PIXABAY_API_KEY': ('FabCredPixabay01', 'Pixabay', 'httpQueryAuth', 'key', ''),
    'EUROPEANA_API_KEY': ('FabCredEuropean1', 'Europeana', 'httpQueryAuth', 'wskey', ''),
    'SMITHSONIAN_API_KEY': ('FabCredSmithsn01', 'Smithsonian', 'httpQueryAuth', 'api_key', ''),
}


def leer(nombre):
    r = subprocess.run(['secret-tool', 'lookup', ATRIBUTO, PREFIJO + nombre],
                       capture_output=True, text=True, timeout=120)
    valor = r.stdout.strip()
    return valor or None


def main():
    if not shutil.which('secret-tool'):
        sys.exit('Falta secret-tool (paquete libsecret).')
    cargar = '--cargar' in sys.argv
    elegidas = {a for a in sys.argv[1:] if not a.startswith('--')}
    if cargar and not elegidas:
        sys.exit('Indica qué claves cargar, p. ej.: --cargar PEXELS_API_KEY PIXABAY_API_KEY')
    creds = []
    for var, (cid, nombre, tipo, cabecera, prefijo) in MAPA.items():
        valor = leer(var)
        print(f'{var:22} {"encontrada" if valor else "no está en el llavero"}')
        if valor and (not cargar or var in elegidas):
            creds.append({'id': cid, 'name': nombre, 'type': tipo,
                          'data': {'name': cabecera, 'value': prefijo + valor}})
        valor = None
    if not cargar:
        print('\nNada cargado. Ejecuta con --cargar para pasarlas a n8n.')
        return
    if not creds:
        sys.exit('No hay claves que cargar.')
    r = subprocess.run(['podman', 'exec', '-i', CONTENEDOR, 'n8n', 'import:credentials', '--input=/dev/stdin'],
                       input=json.dumps(creds), capture_output=True, text=True, timeout=180)
    nombres = [c['name'] for c in creds]
    creds.clear()
    ok = r.returncode == 0
    print('\n' + ('Cargadas en n8n: ' + ', '.join(nombres) if ok else 'n8n rechazó la carga.'))
    if not ok:
        # El error de n8n no incluye los valores: solo el mensaje.
        print(r.stderr.strip()[-800:])
        sys.exit(1)


if __name__ == '__main__':
    main()
