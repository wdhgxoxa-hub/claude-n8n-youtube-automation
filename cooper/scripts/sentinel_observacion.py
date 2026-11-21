"""Diagnóstico de red del ensayo: observa sin interceptar ni filtrar hallazgos.

API pública: playwright.dev/python/docs/api/class-browsercontext y
playwright.dev/python/docs/api/class-consolemessage. Nunca conserva query,
fragmentos, userinfo, cabeceras, cookies, cuerpos ni texto libre de consola.
"""
import re
from time import monotonic
from urllib.parse import urlsplit


def destino(url):
    try:
        u = urlsplit(url)
        if u.scheme not in ('http', 'https') or not u.hostname:
            return {'origen': None, 'ruta': None}
        host = '[' + u.hostname + ']' if ':' in u.hostname else u.hostname
        origen = u.scheme + '://' + host + (':' + str(u.port) if u.port else '')
        return {'origen': origen, 'ruta': u.path or '/'}
    except ValueError:
        return {'origen': None, 'ruta': None}


def codigo_red(texto):
    encontrado = re.search(r'\bnet::ERR_[A-Z_]+(?:\.Inspector)?\b', texto or '')
    return encontrado.group(0) if encontrado else None


def observar(contexto, eventos, modulo):
    inicio = monotonic()

    def agregar(tipo, datos):
        eventos.append({'tipo': tipo, 'modulo': modulo(),
                        'segundos': round(monotonic() - inicio, 4), **datos})

    def fallida(peticion):
        agregar('peticion_fallida', {
            **destino(peticion.url), 'metodo': peticion.method,
            'recurso': peticion.resource_type, 'codigo': codigo_red(peticion.failure),
        })

    def consola(mensaje):
        if mensaje.type != 'error':
            return
        lugar = mensaje.location
        agregar('consola_error', {
            **destino(lugar.get('url', '')), 'linea': lugar.get('lineNumber'),
            'columna': lugar.get('columnNumber'), 'codigo': codigo_red(mensaje.text),
        })

    contexto.on('requestfailed', fallida)
    contexto.on('console', consola)
