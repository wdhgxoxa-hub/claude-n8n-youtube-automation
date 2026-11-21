"""Prueba navegador del guardián real: controles de escritura y filtros de lectura.

Ejecutar con cooper/.cache/sentinel-venv/bin/python y sus navegadores preparados.
No modifica Sentinel, no usa sesiones ni inicia Cooper o proveedores externos.
"""
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
import tempfile
from threading import Thread
import unittest

ROOT = Path(__file__).resolve().parents[1]
COOPER = ROOT / 'cooper'
sys.path.insert(0, str(COOPER / 'scripts'))
from sentinel_cache import comprobar_sentinel
sys.path.insert(0, str(comprobar_sentinel()))
from sentinel_exclusiones import TEXTOS, SELECTORES
from sentinel.contrato import Objetivo, ComprobacionDestino, Exclusiones
from sentinel.guardian.guardian import Guardian
from sentinel.pruebas.caos import _SCRIPT_HORDA, _Pantalla, Caos
from playwright.sync_api import sync_playwright

HTML = '''<!doctype html><html lang="es"><meta charset="utf-8"><title>Contrato de exclusiones</title>
<section aria-label="Control del aprendizaje">
<label class="checkbox"><input id="medir" type="checkbox" role="switch">Medición y aprendizaje automático</label>
<a id="ajustes" href="/admin/fabrica">Revisar ajustes de la fábrica</a>
</section>
<button id="investigar">Investigar competencia</button>
<label><input id="filtro" type="checkbox" role="switch">Mostrar hipótesis</label>
<select id="red"><option>todas</option><option>youtube</option></select>
<button id="actualizar">Actualizar</button>
<details><summary>Ver evidencia</summary><p>Origen y métrica</p></details>
<script>
window.mutaciones=0; window.filtros=0; window.lecturas=0;
const escribir=()=>{window.mutaciones++;fetch('/api/operacion',{method:'POST',body:'{}'}).catch(()=>{});};
document.querySelector('#medir').addEventListener('change',escribir);
document.querySelector('#investigar').addEventListener('click',escribir);
document.querySelector('#filtro').addEventListener('change',()=>window.filtros++);
document.querySelector('#actualizar').addEventListener('click',()=>fetch('/api/operacion').then(()=>window.lecturas++));
// Cooper navega sus enlaces internos con Next. La fixture conserva también el
// documento: una recarga HTML completa destruía el contador de la horda al azar.
document.querySelector('#ajustes').addEventListener('click',event=>{
  event.preventDefault();history.pushState({},'',event.currentTarget.href);
});
</script></html>'''


class HTTP(BaseHTTPRequestHandler):
    escrituras = 0

    def do_GET(self):
        body = (json.dumps({'destino': 'cooper-e2e-aislado'})
                if self.path == '/destino' else '{}' if self.path.startswith('/api/') else HTML)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json' if self.path.startswith(('/api/', '/destino')) else 'text/html')
        self.end_headers()
        self.wfile.write(body.encode())

    def do_POST(self):
        type(self).escrituras += 1
        self.send_response(405)
        self.end_headers()

    def log_message(self, *args):
        pass


class ExclusionesCooper(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), HTTP)
        cls.thread = Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:' + str(cls.http.server_port)
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def contexto(self):
        objective = Objetivo('cooper-contrato-lectura', self.url, self.url, '/no-openapi',
                             ComprobacionDestino('/destino', 'destino', 'cooper-e2e-aislado'),
                             exclusiones=Exclusiones(textos=TEXTOS, selectores=SELECTORES))
        guardian = Guardian(objective, lambda: {})
        guardian.verificar_destino()
        context = self.browser.new_context()
        self.addCleanup(context.close)
        findings = []
        guardian.proteger_contexto(context, findings.append)
        page = context.new_page()
        page.goto(self.url)
        return guardian, page, findings

    def test_controles_mutantes_excluidos_sin_bloquear_filtros_ni_caos(self):
        _, page, findings = self.contexto()
        console = []
        page.on('console', lambda msg: console.append(msg.text) if msg.type == 'error' else None)
        for selector in ['#medir', 'label.checkbox', '#investigar']:
            self.assertTrue(page.locator(selector).evaluate('(el)=>window.__sentinelExcluido(el)'))
            page.locator(selector).click()
        page.locator('#medir').focus()
        page.keyboard.press('Space')
        for selector in ['#filtro', '#red', '#actualizar', 'summary', '#ajustes']:
            self.assertFalse(page.locator(selector).evaluate('(el)=>window.__sentinelExcluido(el)'))
        page.locator('#filtro').click()
        page.locator('#red').select_option('youtube')
        page.locator('#actualizar').click()
        page.wait_for_function('window.lecturas===1')
        self.assertEqual(page.evaluate('window.filtros'), 1)
        page.locator('#ajustes').click()
        self.assertEqual(page.url, self.url + '/admin/fabrica')
        self.assertEqual(page.evaluate('window.lecturas'), 1)
        page.add_script_tag(path=str(COOPER / 'node_modules/gremlins.js/dist/gremlins.min.js'))
        page.evaluate(_SCRIPT_HORDA, {'nb': 350, 'retraso': 1, 'fpsCadaMs': 250, 'semilla': 1744019315})
        page.wait_for_function('window.__caosEstado.fin', timeout=15000)
        self.assertGreater(page.evaluate('window.__caosEstado.hechas'), 0)
        self.assertEqual(page.evaluate('window.mutaciones'), 0)
        self.assertEqual(HTTP.escrituras, 0)
        self.assertEqual(findings, [])
        self.assertEqual(console, [])

    def test_escritura_que_eluda_interfaz_sigue_bloqueada_y_es_error_visible(self):
        guardian, page, findings = self.contexto()
        console = []
        page.on('console', lambda msg: console.append(msg.text) if msg.type == 'error' else None)
        page.evaluate("fetch('/api/operacion',{method:'POST',body:'{}'}).catch(()=>{})")
        self.assertEqual(HTTP.escrituras, 0)
        self.assertTrue(any('escritura bloqueada: POST /api/operacion' == f.titulo for f in findings))
        self.assertTrue(any('ERR_BLOCKED_BY_CLIENT' in error for error in console))
        with tempfile.TemporaryDirectory() as tmp:
            observed = _Pantalla(self.url, errores_consola=console)
            evaluated = Caos()._hallazgos(guardian, observed, page, Path(tmp), 0)
        self.assertTrue(any(f.tipo == 'error_consola' and f.gravedad == 'media' for f in evaluated))

    def test_cache_conserva_hashes_del_manifiesto_publico(self):
        cache = COOPER / '.cache/sentinel'
        for name, expected in json.loads((COOPER / 'ci/sentinel-origen.json').read_text())['archivos'].items():
            self.assertEqual(hashlib.sha256((cache / name).read_bytes()).hexdigest(), expected)


if __name__ == '__main__':
    unittest.main()
