"""Comprueba el entorno efectivo de Compose sin arrancar servicios ni leer secretos."""
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]

class IntegracionTest(unittest.TestCase):
    def test_propaga_configuracion_de_chat_whatsapp_y_texto(self):
        names = [
            'COOPER_CHAT', 'COOPER_CHAT_API_RESPALDO', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
            'COOPER_CHAT_MODELO_CLAUDE', 'COOPER_CHAT_MODELO_OPENAI',
            'COOPER_MENSAJERIA', 'COOPER_MENSAJERIA_PAUSA', 'WHATSAPP_TOKEN',
            'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN',
            'COOPER_MARCAS', 'COOPER_META_GRAPH_VERSION', 'COOPER_META_SYSTEM_TOKEN', 'UPLOAD_POST_API_KEY',
        ]
        bridge = ['PUENTE_CODEX_URL', 'PUENTE_CODEX_TOKEN']
        marcas = ['COOPER_MARCAS_HABILITAR', 'COOPER_MARCAS_URL', 'COOPER_MARCAS_WORKER_SECRET']
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin')}
        for name in names + bridge + marcas + [
            'AUTH_SECRET', 'COOPER_N8N_TOKEN', 'COOPER_WEBHOOK_SECRET',
            'N8N_ENCRYPTION_KEY', 'N8N_RUNNERS_AUTH_TOKEN',
        ]:
            env[name] = 'ficticio-' + name.lower()
        result = subprocess.run([
            'docker', 'compose', '--env-file', str(ROOT / 'deploy/.env.example'),
            '-f', str(ROOT / 'deploy/compose.yaml'), 'config', '--format', 'json',
        ], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, 'Compose debe resolver con valores ficticios')
        self.assertEqual(result.stderr, '', 'Compose no debe emitir advertencias')
        services = json.loads(result.stdout)['services']
        for name in names:
            self.assertEqual(services['cooper']['environment'].get(name), env[name], name)
        allowed = json.loads((ROOT / 'deploy/n8n-task-runners.json').read_text())['task-runners'][0]['allowed-env']
        for name in bridge:
            for service in ['cooper', 'n8n', 'runner']:
                self.assertEqual(services[service]['environment'].get(name), env[name], f'{service}: {name}')
            self.assertIn(name, allowed)
        for name in marcas:
            for service in ['n8n', 'runner']:
                self.assertEqual(services[service]['environment'].get(name), env[name], f'{service}: {name}')
            self.assertIn(name, allowed)
        self.assertEqual(services['cooper']['environment']['COOPER_MARCAS_WORKER_SECRET'], env['COOPER_MARCAS_WORKER_SECRET'])
        for service in ['n8n', 'runner']:
            self.assertNotIn('COOPER_META_SYSTEM_TOKEN', services[service]['environment'])
            self.assertNotIn('UPLOAD_POST_API_KEY', services[service]['environment'])
        # Ninguna clave de chat/Meta debe entrar al runner de código.
        self.assertTrue(set(names).isdisjoint(allowed))
        for service in ['cooper', 'n8n', 'runner']:
            self.assertFalse(services[service].get('ports'))

    def test_marcas_permanece_simulada_y_relojes_bloqueados_por_defecto(self):
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin')}
        for name in ['AUTH_SECRET', 'COOPER_N8N_TOKEN', 'COOPER_WEBHOOK_SECRET', 'N8N_ENCRYPTION_KEY', 'N8N_RUNNERS_AUTH_TOKEN']:
            env[name] = 'secreto-ficticio-de-ensayo-sin-proveedor'
        result = subprocess.run(['docker', 'compose', '--env-file', str(ROOT / 'deploy/.env.example'), '-f', str(ROOT / 'deploy/compose.yaml'), 'config', '--format', 'json'], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, '')
        services = json.loads(result.stdout)['services']
        self.assertEqual(services['cooper']['environment']['COOPER_MARCAS'], 'simulada')
        self.assertEqual(services['cooper']['environment']['COOPER_MARCAS_WORKER_SECRET'], '')
        for service in ['n8n', 'runner']:
            self.assertEqual(services[service]['environment']['COOPER_MARCAS_HABILITAR'], '0')
            self.assertEqual(services[service]['environment']['COOPER_MARCAS_URL'], 'https://cooper.example.com')
