#!/usr/bin/env python3
"""Crea la credencial «Google cliente (OAuth)» (Custom Auth) con el client_id y client_secret
del cliente OAuth que ya usa la credencial de Drive. Con ella «FX · YouTube por canal» canjea y
renueva los permisos de cada canal de YouTube. El secreto nunca se imprime.

Uso:  python3 tools/crear_credencial_google_cliente.py
"""
import json
import subprocess
import sys

CONTENEDOR = 'videos-n8n'
ORIGEN = '5fXmeNSyBH0EFFf7'  # Google Drive account
DESTINO = {'id': 'FabCredGoogleCli', 'name': 'Google cliente (OAuth)', 'type': 'httpCustomAuth'}
TMP = '/tmp/cred-google-cliente.json'


def podman(*args, entrada=None):
    r = subprocess.run(['podman', 'exec', '-i', CONTENEDOR, *args], input=entrada,
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f'Falló «{" ".join(args[:2])}»: {r.stderr.strip()[:300]}')
    return r.stdout


def main():
    salida = podman('n8n', 'export:credentials', f'--id={ORIGEN}', '--decrypted')
    try:
        datos = json.loads(salida[salida.index('['):])[0].get('data') or {}
    except (ValueError, IndexError, json.JSONDecodeError):
        sys.exit(f'No pude leer la credencial de Drive ({ORIGEN}).')
    cliente, secreto = str(datos.get('clientId') or ''), str(datos.get('clientSecret') or '')
    if not cliente.endswith('.apps.googleusercontent.com') or not secreto:
        sys.exit('La credencial de Drive no tiene el cliente OAuth esperado. No creé nada.')
    nueva = [{**DESTINO, 'data': {'json': json.dumps({'body': {'client_id': cliente, 'client_secret': secreto}})}}]
    secreto = None
    try:
        podman('sh', '-c', f'umask 077 && cat > {TMP}', entrada=json.dumps(nueva))
        podman('n8n', 'import:credentials', f'--input={TMP}')
    finally:
        subprocess.run(['podman', 'exec', CONTENEDOR, 'rm', '-f', TMP], capture_output=True)
    print(f'Listo: credencial «{DESTINO["name"]}» ({DESTINO["id"]}) creada. El secreto no se mostró.')


if __name__ == '__main__':
    main()
