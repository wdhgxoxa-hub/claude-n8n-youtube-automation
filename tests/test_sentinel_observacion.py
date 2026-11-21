"""Diagnóstico sin texto libre, datos de autenticación ni cambios al navegador."""
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'cooper/scripts'))
from sentinel_observacion import destino, codigo_red, observar


class Observacion(unittest.TestCase):
    def test_descarta_query_fragmento_y_userinfo(self):
        self.assertEqual(destino('https://usuario:valor-ficticio@example.test:8443/ruta?sesion=ejemplo#privado'),
                         {'origen': 'https://example.test:8443', 'ruta': '/ruta'})

    def test_descarta_urls_opacas_o_invalidas(self):
        for url in ['data:text/plain,contenido', 'blob:contenido', 'file:///tmp/privado', 'https://[invalido']:
            self.assertEqual(destino(url), {'origen': None, 'ruta': None})

    def test_conserva_ipv6_sin_query(self):
        self.assertEqual(destino('http://[::1]:8080/?dato=ficticio'),
                         {'origen': 'http://[::1]:8080', 'ruta': '/'})

    def test_codigo_no_conserva_texto_arbitrario(self):
        self.assertEqual(codigo_red('Failed: net::ERR_BLOCKED_BY_CLIENT.Inspector extra'),
                         'net::ERR_BLOCKED_BY_CLIENT.Inspector')
        self.assertEqual(codigo_red('net::ERR_CONNECTION_REFUSED'), 'net::ERR_CONNECTION_REFUSED')
        self.assertIsNone(codigo_red('Error privado sintético'))

    def test_observa_errores_sin_filtrar_ni_interceptar(self):
        class Contexto:
            def __init__(self): self.eventos = {}
            def on(self, nombre, callback): self.eventos[nombre] = callback
        contexto = Contexto()
        eventos = []
        observar(contexto, eventos, lambda: 'caos')
        self.assertEqual(set(contexto.eventos), {'requestfailed', 'console'})
        contexto.eventos['requestfailed'](SimpleNamespace(
            url='http://127.0.0.1:3000/api/marcas/montajes?secreto=ficticio', method='POST',
            resource_type='fetch', failure='net::ERR_BLOCKED_BY_CLIENT.Inspector'))
        contexto.eventos['console'](SimpleNamespace(type='error', text='Error genérico no ocultado',
            location={'url':'http://127.0.0.1:3000/app.js?privado=ficticio', 'lineNumber':4, 'columnNumber':2}))
        self.assertEqual(len(eventos), 2)
        self.assertEqual(eventos[0]['metodo'], 'POST')
        self.assertEqual(eventos[1]['ruta'], '/app.js')
        self.assertIsNone(eventos[1]['codigo'])
        self.assertEqual(eventos[1]['tipo'], 'consola_error')
        self.assertNotIn('ficticio', str(eventos))
        self.assertNotIn('Error genérico', str(eventos))


if __name__ == '__main__':
    unittest.main()
