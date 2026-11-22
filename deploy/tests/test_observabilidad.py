import fcntl
import io
import json
import os
from pathlib import Path
import ssl
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
import monitor
import observabilidad


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.now = 1800000000

    def test_memoria_host_usa_disponible_y_bytes(self):
        path = self.root / 'meminfo'
        path.write_text('MemTotal: 8192 kB\nMemFree: 4 kB\nMemAvailable: 2048 kB\nSecret: privado\n')
        self.assertEqual(observabilidad.memory(path), {'totalBytes': 8192 * 1024, 'availableBytes': 2048 * 1024})

    def test_memoria_ausente_corrupta_o_imposible_permanece_desconocida(self):
        path = self.root / 'meminfo'
        missing = {'totalBytes': None, 'availableBytes': None}
        self.assertEqual(observabilidad.memory(path), missing)
        for content in ('MemTotal: roto kB', 'MemTotal: 1 kB\nMemAvailable: 2 kB', 'MemTotal: -1 kB'):
            path.write_text(content)
            self.assertEqual(observabilidad.memory(path), missing)
        path.write_text('MemTotal: 1024 kB\nMemFree: 512 kB')
        self.assertIsNone(observabilidad.memory(path)['availableBytes'])

    def test_faltantes_no_se_convierten_en_ceros_o_salud_supuesta(self):
        result = observabilidad.snapshot(self.now)
        self.assertEqual(result['disk'], {'totalBytes': None, 'freeBytes': None})
        self.assertEqual(result['memory'], {'totalBytes': None, 'availableBytes': None})
        self.assertFalse(result['maintenance'])
        self.assertEqual(result['services'], dict.fromkeys(observabilidad.SERVICES, 'unknown'))
        self.assertEqual(result['certificates']['cooper'], {'state': 'unknown', 'expiresAt': None})
        self.assertEqual(result['backups']['copy'], {'state': 'unknown', 'completedAt': None, 'ageHours': None})

    def test_publica_solo_lista_cerrada_sin_dominios_rutas_ni_errores(self):
        private = 'CANARIO_PRIVADO'
        result = observabilidad.snapshot(self.now, {
            'disk': {'totalBytes': 100, 'freeBytes': 20, 'path': private},
            'memory': {'totalBytes': 200, 'availableBytes': 100, 'error': private},
            'certificates': {'cooper': self.now + 30 * 86400, 'n8n': private, private: self.now},
            'backups': {'copy': 3600, 'replica': private},
            'services': {'cooper': 'ok', 'n8n': private, private: 'ok'},
            'env': {'TOKEN': private}, 'error': private,
        })
        self.assertNotIn(private, json.dumps(result))
        self.assertEqual(set(result), {'schemaVersion', 'collectedAt', 'maintenance', 'disk', 'memory', 'certificates', 'backups', 'services'})
        self.assertEqual(result['disk'], {'totalBytes': 100, 'freeBytes': 20})
        self.assertEqual(result['certificates']['cooper']['state'], 'ok')
        self.assertEqual(result['certificates']['n8n']['state'], 'unknown')
        self.assertEqual(result['backups']['copy']['ageHours'], 1)

    def test_rechaza_metricas_invalidas_y_recibos_futuros(self):
        for value in (float('nan'), float('inf'), 10**1000, -1, True, '12'):
            result = observabilidad.snapshot(self.now, {
                'disk': {'totalBytes': 100, 'freeBytes': value},
                'backups': {'copy': value},
                'certificates': {'n8n': value},
            })
            self.assertIsNone(result['disk']['freeBytes'])
            self.assertIsNone(result['backups']['copy']['ageHours'])
            self.assertIsNone(result['certificates']['n8n']['expiresAt'])
        result = observabilidad.snapshot(self.now, {'memory': {'totalBytes': 100, 'availableBytes': 101}})
        self.assertIsNone(result['memory']['availableBytes'])

    def test_fechas_y_umbrales_conservan_valores_reales(self):
        result = observabilidad.snapshot(self.now, {
            'certificates': {'cooper': self.now, 'n8n': self.now + 14 * 86400},
            'backups': {'copy': 30 * 3600, 'replica': 36 * 3600 + 1},
        })
        self.assertEqual(result['certificates']['cooper']['state'], 'expired')
        self.assertEqual(result['certificates']['n8n']['state'], 'expiring')
        self.assertEqual(result['backups']['copy']['state'], 'ok')
        self.assertEqual(result['backups']['replica']['state'], 'stale')
        self.assertTrue(result['backups']['copy']['completedAt'].endswith('Z'))

    def test_reemplazo_atomico_y_permisos_solo_del_directorio_publico(self):
        path = self.root / 'observabilidad' / 'estado.json'
        previous = observabilidad.write_snapshot(self.root, self.now)
        original_replace = os.replace

        def replacing(source, target):
            self.assertEqual(json.loads(path.read_text()), previous)
            self.assertEqual(json.loads(Path(source).read_text())['collectedAt'], observabilidad.timestamp(self.now + 1))
            original_replace(source, target)

        with patch.object(observabilidad.os, 'replace', side_effect=replacing):
            current = observabilidad.write_snapshot(self.root, self.now + 1)
        self.assertEqual(json.loads(path.read_text()), current)
        self.assertEqual(stat.S_IMODE(self.root.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o644)
        self.assertEqual([item.name for item in path.parent.iterdir()], ['estado.json'])

    def test_escritura_fallida_conserva_version_anterior_y_limpia_temporal(self):
        previous = observabilidad.write_snapshot(self.root, self.now)
        path = self.root / 'observabilidad' / 'estado.json'
        with patch.object(observabilidad.os, 'replace', side_effect=OSError('ficticio')):
            with self.assertRaises(OSError):
                observabilidad.write_snapshot(self.root, self.now + 1)
        self.assertEqual(json.loads(path.read_text()), previous)
        self.assertEqual([item.name for item in path.parent.iterdir()], ['estado.json'])

    def test_rechaza_directorio_publico_enlazado(self):
        (self.root / 'privado').mkdir()
        (self.root / 'observabilidad').symlink_to(self.root / 'privado')
        with self.assertRaises(OSError):
            observabilidad.write_snapshot(self.root, self.now)
        self.assertEqual(list((self.root / 'privado').iterdir()), [])

    def test_overlay_solo_monta_proyeccion_saneada(self):
        text = (DEPLOY / 'compose.observabilidad.yaml').read_text()
        self.assertIn('source: ${STATE_ROOT:?Definir STATE_ROOT}/observabilidad', text)
        self.assertIn('target: /app/observabilidad', text)
        self.assertIn('read_only: true', text)
        self.assertIn('create_host_path: false', text)
        self.assertNotIn('docker.sock', text)
        self.assertNotIn('.env', text)


class IntegrationTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.now = 1800000000
        self.env = {
            'STATE_ROOT': str(self.root), 'DATA_ROOT': str(self.root),
            'COOPER_DOMAIN': 'cooper.example.test', 'N8N_DOMAIN': 'n8n.example.test',
            'COOPER_ORIGIN': 'https://cooper.example.test', 'COOPER_WEBHOOK_SECRET': 'ficticio',
        }
        self.context = MagicMock()
        self.context.wrap_socket.return_value.__enter__.return_value.getpeercert.return_value = {'notAfter': 'Jan 20 00:00:00 2030 GMT'}
        self.patched(monitor.ssl, 'create_default_context', return_value=self.context)
        self.connect = self.patched(monitor.socket, 'create_connection')
        self.inspect = self.patched(monitor.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'running healthy unless-stopped', ''))
        self.disk = self.patched(monitor.shutil, 'disk_usage', return_value=SimpleNamespace(total=100 * 1024**3, free=30 * 1024**3))

        def response(*_args, **_kwargs):
            result = io.StringIO('{"ok":true}')
            result.status = 200
            return result

        self.patched(monitor.urllib.request, 'urlopen', side_effect=response)
        self.patched(monitor.observabilidad, 'memory', return_value={'totalBytes': 2048, 'availableBytes': 1024})
        self.send = self.patched(monitor, 'notify', return_value=True)

    def patched(self, target, name, **kwargs):
        patcher = patch.object(target, name, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def read(self):
        return json.loads((self.root / 'observabilidad' / 'estado.json').read_text())

    def receipt(self, filename, age, state='PASS'):
        (self.root / filename).write_text(json.dumps({'fecha': self.now - age, 'restauracion': state, 'snapshot': 'CANARIO_PRIVADO'}))

    def test_sondea_una_vez_y_reutiliza_recibos_pass(self):
        self.receipt('ultima-copia.json', 3600)
        self.receipt('ultima-replica.json', 7200)
        self.assertEqual(monitor.monitor(self.env, self.now)['salud'], 'PASS')
        result = self.read()
        self.assertEqual(self.connect.call_count, 2)
        self.assertEqual(self.inspect.call_count, 4)
        self.assertEqual(self.disk.call_count, 1)
        self.assertEqual(result['backups']['copy']['ageHours'], 1)
        self.assertEqual(result['backups']['replica']['ageHours'], 2)
        self.assertEqual(result['services'], dict.fromkeys(observabilidad.SERVICES, 'ok'))
        self.assertEqual(result['memory'], {'totalBytes': 2048, 'availableBytes': 1024})
        self.assertNotIn('CANARIO_PRIVADO', json.dumps(result))
        self.send.assert_not_called()

    def test_recibo_fail_y_futuro_no_afirma_copia_disponible(self):
        self.receipt('ultima-copia.json', 1, 'FAIL')
        self.receipt('ultima-replica.json', -120)
        monitor.monitor(self.env, self.now)
        result = self.read()
        self.assertEqual(result['backups']['copy']['state'], 'unknown')
        self.assertEqual(result['backups']['replica']['state'], 'unknown')

    def test_fallo_tls_y_servicio_no_filtra_error_y_sigue_otros_dominios(self):
        self.context.wrap_socket.side_effect = [ssl.SSLCertVerificationError('CANARIO_PRIVADO'), self.context.wrap_socket.return_value]
        self.inspect.return_value = subprocess.CompletedProcess([], 1, 'CANARIO_PRIVADO', 'CANARIO_PRIVADO')
        result = monitor.monitor(self.env, self.now)
        snapshot = self.read()
        self.assertIn('servicio_caddy', result['problemas'])
        self.assertEqual(snapshot['certificates']['cooper']['state'], 'unknown')
        self.assertEqual(snapshot['certificates']['n8n']['state'], 'ok')
        self.assertEqual(snapshot['services']['n8n'], 'down')
        self.assertNotIn('CANARIO_PRIVADO', json.dumps(snapshot))

    def test_mantenimiento_por_marcador_no_sondea_ni_alerta(self):
        (self.root / 'mantenimiento').touch()
        self.assertEqual(monitor.monitor(self.env, self.now)['salud'], 'MANTENIMIENTO')
        snapshot = self.read()
        self.assertTrue(snapshot['maintenance'])
        self.assertEqual(snapshot['services']['cooper'], 'unknown')
        self.assertIsNone(snapshot['disk']['freeBytes'])
        self.connect.assert_not_called()
        self.inspect.assert_not_called()
        self.send.assert_not_called()

    def test_operacion_bloqueada_publica_mantenimiento(self):
        with (self.root / 'operacion.lock').open('a') as operation:
            fcntl.flock(operation, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(monitor.monitor(self.env, self.now)['salud'], 'MANTENIMIENTO')
        self.assertTrue(self.read()['maintenance'])
        self.connect.assert_not_called()
        self.send.assert_not_called()

    def test_sondeo_fallido_publica_metricas_desconocidas_sin_ocultar_error_original(self):
        self.disk.side_effect = OSError('CANARIO_PRIVADO')
        with self.assertRaises(OSError):
            monitor.monitor(self.env, self.now)
        self.assertIsNone(self.read()['disk']['freeBytes'])
        self.assertNotIn('CANARIO_PRIVADO', json.dumps(self.read()))

    def test_escritura_publica_fallida_no_impide_alerta_anterior(self):
        with patch.object(observabilidad, 'write_snapshot', side_effect=OSError('ficticio')):
            result = monitor.monitor(self.env, self.now)
        self.assertEqual(result['salud'], 'FAIL')
        self.send.assert_called_once()
        self.assertTrue((self.root / 'monitor.json').is_file())


if __name__ == '__main__':
    unittest.main(verbosity=2)
