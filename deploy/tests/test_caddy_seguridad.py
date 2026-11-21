"""Valida el orden REAL adaptado por Caddy, sin red ni entorno de producción."""
import fnmatch
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


def rutas(rules):
    for rule in rules:
        yield rule
        for handler in rule.get('handle', []):
            if handler.get('handler') == 'subroute':
                yield from rutas(handler.get('routes', []))


class CaddySeguridadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run([
            'podman', 'run', '--rm', '-i', '--network=none', '--read-only',
            '--cap-drop=all', '--cap-add=NET_BIND_SERVICE', '--security-opt=no-new-privileges',
            '-e', 'COOPER_DOMAIN=cooper.test', '-e', 'N8N_DOMAIN=flujos.test',
            '-e', 'CADDY_TLS=internal', 'docker.io/library/caddy:2.11.2-alpine',
            'caddy', 'adapt', '--adapter', 'caddyfile', '--config', '/dev/stdin',
        ], input=(ROOT / 'deploy/Caddyfile').read_text(),
            capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise AssertionError('Caddy no pudo adaptar la configuración ficticia: ' + result.stderr)
        config = json.loads(result.stdout)
        cls.publicas = []
        for server in config['apps']['http']['servers'].values():
            if ':443' not in server.get('listen', []):
                continue
            for rule in rutas(server['routes']):
                if any('flujos.test' in m.get('host', []) for m in rule.get('match', [])):
                    cls.publicas = list(rutas([rule]))
        if not cls.publicas:
            raise AssertionError('No se encontró el servidor público de flujos')

    def primera_ruta(self, path):
        for rule in self.publicas:
            for match in rule.get('match', []):
                if any(fnmatch.fnmatchcase(path, pattern) for pattern in match.get('path', [])):
                    return list(rutas([rule]))
        self.fail('Falta ruta para ' + path)

    def test_puente_se_bloquea_antes_de_webhooks_para_cualquier_metodo(self):
        for path in ['/webhook/cooper/v1', '/webhook/cooper/v1/estado']:
            with self.subTest(path=path):
                rules = self.primera_ruta(path)
                self.assertFalse(any('method' in m for r in rules for m in r.get('match', [])))
                handlers = [h for r in rules for h in r.get('handle', [])]
                self.assertFalse(any(h['handler'] == 'reverse_proxy' for h in handlers),
                                 'El bloqueo no puede depender de un 404 devuelto por n8n')
                self.assertTrue(any(h['handler'] == 'static_response' and h.get('status_code') == 404 for h in handlers))

    def test_conserva_webhooks_publicos(self):
        rules = self.primera_ruta('/webhook/entrada-permitida')
        self.assertTrue(any(h['handler'] == 'reverse_proxy' for r in rules for h in r.get('handle', [])))
