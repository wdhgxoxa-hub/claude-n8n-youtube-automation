"""Ejecuta nodos Code de la fábrica dentro de un n8n real (motor y entorno de código reales), con entradas simuladas.

Uso (n8n de prueba, nunca el de producción):
  MOTOR_URL=http://127.0.0.1:5680 MOTOR_USUARIO=prueba@fabrica.local MOTOR_CLAVE=... python3 tools/motor/casos.py
Crea un flujo temporal por caso, lo ejecuta por webhook y lo borra.
"""
import json, urllib.request, http.cookiejar, uuid, time, sys
import os
B = os.environ.get('MOTOR_URL', 'http://127.0.0.1:5680')
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(cj))
BID = 'motor-local-1'
GALLETA = {}
def api(m, p, body=None):
    h = {'content-type': 'application/json', 'browser-id': BID}
    if GALLETA: h['cookie'] = '; '.join(f'{k}={v}' for k, v in GALLETA.items())
    r = urllib.request.Request(B + p, method=m, data=json.dumps(body).encode() if body is not None else None, headers=h)
    resp = op.open(r, timeout=120)
    for c in resp.headers.get_all('set-cookie') or []:
        k, v = c.split(';')[0].split('=', 1); GALLETA[k] = v
    return json.loads(resp.read() or b'{}')
api('POST', '/rest/login', {'emailOrLdapLoginId': os.environ['MOTOR_USUARIO'], 'password': os.environ['MOTOR_CLAVE']})
def nodo(flujo, nombre):
    w = json.load(open(os.path.join(RAIZ, 'workflows', 'v2', f'{flujo}.json')))
    return next(n for n in w['nodes'] if n['name'] == nombre)
def probar(flujo, nombre, simulados, entrada=None, sin_ejecutar=()):
    """simulados: {nombre_nodo: [json,...]} se ejecutan en cadena antes; entrada: lista de json que recibe el nodo."""
    ruta = 'motor-' + uuid.uuid4().hex[:8]
    nodes = [{'id': 'w', 'name': 'W', 'type': 'n8n-nodes-base.webhook', 'typeVersion': 2, 'position': [0, 0], 'parameters': {'path': ruta, 'responseMode': 'lastNode', 'responseData': 'allEntries'}, 'webhookId': ruta}]
    orden = ['W']
    for i, (n, datos) in enumerate(list(simulados.items()) + ([('__entrada', entrada)] if entrada is not None else [])):
        nodes.append({'id': f's{i}', 'name': n, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [200 * (i + 1), 0], 'parameters': {'jsCode': 'return ' + json.dumps([{'json': d} for d in datos]) + ';'}})
        orden.append(n)
    real = nodo(flujo, nombre); real = {**real, 'id': 'objetivo', 'position': [200 * (len(orden) + 1), 0]}
    nodes.append(real); orden.append(nombre)
    for i, n in enumerate(sin_ejecutar):
        nodes.append({'id': f'x{i}', 'name': n, 'type': 'n8n-nodes-base.noOp', 'typeVersion': 1, 'position': [0, 300 + 100 * i], 'parameters': {}})
    con = {a: {'main': [[{'node': b, 'type': 'main', 'index': 0}]]} for a, b in zip(orden, orden[1:])}
    w = api('POST', '/rest/workflows', {'name': 'motor ' + nombre, 'nodes': nodes, 'connections': con, 'settings': {'executionOrder': 'v1'}})['data']
    api('POST', f"/rest/workflows/{w['id']}/activate", {'versionId': w['versionId']})
    time.sleep(1)
    try:
        r = op.open(urllib.request.Request(B + '/webhook/' + ruta), timeout=120).read()
        salida = json.loads(r)
    except urllib.error.HTTPError as e:
        salida = {'ERROR_HTTP': e.code, 'cuerpo': e.read().decode()[:500]}
    for paso in (('POST', f"/rest/workflows/{w['id']}/deactivate", {}), ('POST', f"/rest/workflows/{w['id']}/archive", {}), ('DELETE', f"/rest/workflows/{w['id']}", None)):
        try: api(*paso)
        except Exception: pass
    return salida
