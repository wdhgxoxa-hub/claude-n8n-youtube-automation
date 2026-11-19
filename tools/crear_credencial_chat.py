#!/usr/bin/env python3
"""Crea la credencial «OpenAI (chat)» (tipo openAiApi) que usa el agente de Telegram,
copiando la clave de la credencial «OpenAI» ya guardada en n8n. La clave nunca se imprime:
pasa de n8n a un archivo temporal dentro del contenedor y se borra al terminar.

Uso:  python3 tools/crear_credencial_chat.py
"""
import json
import subprocess
import sys

CONTENEDOR = 'videos-n8n'
ORIGEN = 'FabCredOpenAI001'
DESTINO = {'id': 'FabCredOpenAIch1', 'name': 'OpenAI (chat)', 'type': 'openAiApi'}
TMP = '/tmp/cred-chat.json'


def podman(*args, entrada=None):
    r = subprocess.run(['podman', 'exec', '-i', CONTENEDOR, *args], input=entrada,
                       capture_output=True, text=True)
    if r.returncode != 0:
        # El error de n8n no contiene la clave; se muestra recortado.
        sys.exit(f'Falló «{" ".join(args[:2])}»: {r.stderr.strip()[:300]}')
    return r.stdout


def main():
    salida = podman('n8n', 'export:credentials', f'--id={ORIGEN}', '--decrypted')
    try:
        inicio = salida.index('[')
        cred = json.loads(salida[inicio:])[0]
    except (ValueError, IndexError, json.JSONDecodeError):
        sys.exit(f'No pude leer la credencial {ORIGEN}. ¿Existe en n8n?')
    datos = cred.get('data') or {}
    valor = str(datos.get('value') or datos.get('apiKey') or '').strip()
    if valor.lower().startswith('bearer '):
        valor = valor[7:].strip()
    if not valor.startswith('sk-'):
        sys.exit('La credencial OpenAI no tiene una clave con el formato esperado (sk-…). No creé nada.')
    nueva = [{**DESTINO, 'data': {'apiKey': valor, 'url': 'https://api.openai.com/v1'}}]
    valor = None
    try:
        podman('sh', '-c', f'umask 077 && cat > {TMP}', entrada=json.dumps(nueva))
        podman('n8n', 'import:credentials', f'--input={TMP}')
    finally:
        subprocess.run(['podman', 'exec', CONTENEDOR, 'rm', '-f', TMP], capture_output=True)
    print(f'Listo: credencial «{DESTINO["name"]}» ({DESTINO["id"]}) creada. La clave no se mostró.')


if __name__ == '__main__':
    main()
