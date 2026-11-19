import sys, json, datetime
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from arnes import probar
# Ajustes reales (de su propio nodo, ejecutado en el motor)
aj = probar('FabAjustes000001', 'Ajustes', {})[0]
res = {}
def caso(nombre, ok, detalle=''):
    res[nombre] = ('OK' if ok else 'FALLA') + (' · ' + detalle if detalle else ''); print(nombre, '→', res[nombre]); sys.stdout.flush()
caso('ajustes en motor', aj.get('allowRedes') is False and aj.get('calendario', {}).get('horas', {}).get('tiktok') == 19)
# 1. Calendario de publicación (largo con 3 cortes)
ini = {'video_id': 'v', 'canal_id': 'c', 'tema': 'T', 'formato': 'largo', 'perfil': 'p', 'redes': 'youtube,tiktok,instagram,facebook', 'zona': 'America/Lima',
       'contexto': {'render_url': 'https://r.mp4', 'miniatura_url': 'https://m.jpg', 'cortes': [{'corte': i, 'titulo': 'k', 'url': f'https://c{i}.mp4'} for i in (1, 2, 3)],
                    'publicacion': {'youtube': {'titulos': ['Uno'], 'tags': ['a']}, 'tiktok': {'texto': 't', 'hashtags': ['x']}}}}
out = probar('FabRedes00000001', 'Plan de publicación', {'Inicio': [ini], 'Leer ajustes': [aj], 'Agenda del canal': [{}]}, sin_ejecutar=['vidIQ: títulos'])
horas = sorted({o['hora_local'][-5:] + ' ' + o['plataformas'] for o in out})
caso('calendario en motor', len(out) == 14 and all(o['programado'] for o in out) and all(len(o['pares']) == 24 for o in out), f"{len(out)} envíos; " + ', '.join(horas))
# 2. Cortes (función componer)
pl = lambda i: {'id': i, 'tipo': 'imagen', 'texto_narrado': 'uno dos tres cuatro cinco'}
plan = {'formato': 'largo', 'planos': [pl(i) for i in ('p1', 'p2', 'p3')], 'biblia': {}, 'storyboard': {'cortes': [{'titulo': 'A', 'planos': ['p2', 'p3']}]}}
planos = [{'plano_id': i, 'url': 'https://i/' + i, 'plano': pl(i)} for i in ('p1', 'p2', 'p3')]
son = {'voces': [{'plano_id': i, 'url': 'v' + i, 'duracion_s': 10} for i in ('p1', 'p2', 'p3')], 'musica': {'url': 'm'}}
c = probar('FabDerivados0001', 'Composiciones de cortes', {'Inicio': [{'plan': plan, 'planos': planos, 'son': son}]})
caso('cortes en motor', len(c) == 1 and c[0]['source']['height'] == 1920 and c[0]['duracion_s'] == 20.7, json.dumps({k: c[0].get(k) for k in ('corte', 'titulo', 'duracion_s')}))
# 3. Video principal (misma función, horizontal)
comp = probar('FabProduccion001', 'Composición Creatomate', {'Plan de producción': [{**plan, 'video_id': 'v', 'canal_id': 'c'}], 'Juntar planos': [{'planos': planos}]}, entrada=[son])
caso('montaje en motor', comp[0]['source']['width'] == 1920 and comp[0]['planos'] == 3, f"duración {comp[0]['duracion_estimada_s']} s")
# 4. Zona horaria por canal (validación con Intl en el motor)
v1 = probar('FabOrquestador01', 'Validar redes', {'Inicio': [{'canal_id': 'c', 'perfil': 'mx', 'redes': 'tiktok', 'zona': 'America/Mexico_City'}]})[0]
v2 = probar('FabOrquestador01', 'Validar redes', {'Inicio': [{'canal_id': 'c', 'perfil': 'mx', 'redes': 'tiktok', 'zona': 'Marte/Olympus'}]})[0]
caso('zona por canal en motor', v1['ok'] and not v2['ok'], v2['motivo'][:60])
# 5. Enlace de conexión de YouTube (sin crypto en el motor)
e = probar('FabYouTube000001', 'Preparar enlace', {'Inicio': [{'canal_id': 'mi-canal'}], 'Leer ajustes': [aj]}, entrada=[{}])[0]
caso('enlace YouTube en motor', e['valido'] and len(e['nonce']) == 32 and e['url'].startswith('https://accounts.google.com/o/oauth2/v2/auth?client_id='))
# 6. Topes diarios
t = probar('FabOrquestador01', 'Revisar topes', {'Leer ajustes': [aj], 'Buscar canal': [{'canal_id': 'c'}]}, entrada=[{'video_id': f'x{i}', 'canal_id': 'c'} for i in range(3)])[0]
caso('topes en motor', t['ok'] is False and 'canal c' in t['motivo'])
# 7. Videos atascados
viejo = (datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=30)).isoformat().replace('+00:00', 'Z')
a = probar('FabRutina0000001', 'Atascados', {}, entrada=[{'video_id': 'a', 'canal_id': 'c', 'etapa': 'guion', 'estado': 'en_proceso', 'updatedAt': viejo}])[0]
caso('atascados en motor', 'a (c)' in a.get('texto', ''))
# 8. Vigilante de errores
m = probar('FabErrores000001', 'Mensaje de error', {}, entrada=[{'workflow': {'name': 'X'}, 'execution': {'lastNodeExecuted': 'N', 'error': {'message': 'boom'}, 'url': 'u'}}])[0]
caso('vigilante en motor', 'en el nodo «N»' in m['texto'])
# 9. Envío real a Upload-Post simulado: el motor arma el multipart y un receptor local lo descompone
import http.server, threading, email, email.policy, copy, socket
recibido = {}
class Eco(http.server.BaseHTTPRequestHandler):
    def do_POST(s):
        b = s.rfile.read(int(s.headers.get('content-length', 0)))
        m = email.message_from_bytes(b'Content-Type: ' + s.headers['content-type'].encode() + b'\r\n\r\n' + b, policy=email.policy.HTTP)
        recibido['campos'] = [(q.get_param('name', header='content-disposition'), q.get_payload(decode=True).decode()) for q in m.iter_parts()]
        recibido['auth'] = s.headers.get('authorization')
        s.send_response(200); s.send_header('content-type', 'application/json'); s.end_headers(); s.wfile.write(b'{"success":true,"request_id":"req-1"}')
    def log_message(s, *a): pass
so = socket.socket(); so.bind(('127.0.0.1', 0)); puerto = so.getsockname()[1]; so.close()
srv = http.server.HTTPServer(('127.0.0.1', puerto), Eco); threading.Thread(target=srv.serve_forever, daemon=True).start()
import arnes
envio = probar('FabRedes00000001', 'Plan de publicación', {'Inicio': [{**ini, 'formato': 'short', 'redes': 'tiktok', 'contexto': {'render_url': 'https://r.mp4', 'publicacion': {'tiktok': {'texto': 'Hola «mundo» ñ', 'hashtags': ['historia']}}}}], 'Leer ajustes': [aj], 'Agenda del canal': [{}]}, sin_ejecutar=['vidIQ: títulos'])
subir = copy.deepcopy(arnes.nodo('FabRedes00000001', 'Subir a redes')); subir['parameters']['url'] = f'http://127.0.0.1:{puerto}/api/upload'
original = arnes.nodo; arnes.nodo = lambda f, n: subir if n == 'Subir a redes' else original(f, n)
r = probar('FabRedes00000001', 'Subir a redes', {}, entrada=envio); arnes.nodo = original; srv.shutdown()
cp = dict(c for c in recibido.get('campos', []) if c[0] != 'user'); us = {x for k, x in recibido.get('campos', []) if k == 'user'}
caso('multipart en motor', r[0].get('request_id') == 'req-1' and cp.get('platform[]') == 'tiktok' and cp.get('tiktok_title') == 'Hola «mundo» ñ\n\n#historia'
     and cp.get('video') == 'https://r.mp4' and cp.get('timezone') == 'America/Lima' and us == {'p'} and len(recibido['campos']) == 24, f"{len(recibido.get('campos', []))} campos; user={us}")
print(json.dumps(res, ensure_ascii=False, indent=1))

sys.exit(0 if all(v.startswith('OK') for v in res.values()) else 1)
