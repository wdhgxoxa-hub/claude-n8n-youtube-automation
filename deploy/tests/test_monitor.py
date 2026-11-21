import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
import monitor
import operar


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, DEPLOY / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


replica = load('replica', 'replicar-pc.py')
recibo = load('recibo', 'registrar-replica.py')
generador = load('generador', 'generar-monitor.py')


class MonitorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.env = {'STATE_ROOT': str(self.root), 'COOPER_WEBHOOK_SECRET': 'ficticio' * 6}

    def test_deduplica_y_avisa_recuperacion(self):
        with patch.object(monitor, 'issues', return_value=['disco_bajo']), patch.object(monitor, 'notify', return_value=True) as send:
            monitor.monitor(self.env, 100000)
            monitor.monitor(self.env, 100001)
            self.assertEqual(send.call_count, 1)
            monitor.monitor(self.env, 100000 + 6 * 3600)
            self.assertEqual(send.call_count, 2)
        with patch.object(monitor, 'issues', return_value=[]), patch.object(monitor, 'notify', return_value=True) as send:
            monitor.monitor(self.env, 200000)
            monitor.monitor(self.env, 200001)
            self.assertEqual(send.call_count, 1)

    def test_reintenta_notificacion_fallida(self):
        with patch.object(monitor, 'issues', return_value=['servicio_n8n']), patch.object(monitor, 'notify', side_effect=[False, True]) as send:
            self.assertFalse(monitor.monitor(self.env, 100000)['entrega'])
            self.assertTrue(monitor.monitor(self.env, 100001)['entrega'])
            self.assertEqual(send.call_count, 2)

    def test_avisa_recuperacion_tras_caida_del_transporte(self):
        with patch.object(monitor, 'issues', return_value=['servicio_n8n']), patch.object(monitor, 'notify', return_value=False):
            monitor.monitor(self.env, 100000)
        with patch.object(monitor, 'issues', return_value=[]), patch.object(monitor, 'notify', return_value=True) as send:
            monitor.monitor(self.env, 100001)
            self.assertEqual(send.call_count, 1)

    def test_no_alerta_durante_mantenimiento(self):
        (self.root / 'mantenimiento').touch()
        with patch.object(monitor, 'issues') as check, patch.object(monitor, 'notify') as send:
            self.assertEqual(monitor.monitor(self.env, 100000)['salud'], 'MANTENIMIENTO')
            check.assert_not_called()
            send.assert_not_called()

    def test_prueba_no_suprime_alerta_real(self):
        with patch.object(monitor, 'issues', return_value=['disco_bajo']), patch.object(monitor, 'notify', return_value=True) as send:
            monitor.monitor(self.env, 100000, probe=True)
            monitor.monitor(self.env, 100001)
            self.assertEqual(send.call_count, 2)

    def test_edad_exige_restauracion_y_rechaza_futuro(self):
        path = self.root / 'estado.json'
        for row in [{'fecha': 20000, 'restauracion': 'PASS'}, {'fecha': 500, 'restauracion': 'FAIL'}, {}]:
            operar.write_json(path, row)
            self.assertIsNone(monitor.age(path, 1000))
        operar.write_json(path, {'fecha': 500, 'restauracion': 'PASS'})
        self.assertEqual(monitor.age(path, 1000), 500)

    def test_salud_detecta_disco_copias_y_contenedor(self):
        self.env.update(DATA_ROOT=str(self.root), COOPER_ORIGIN='https://ficticio.invalid')
        response = subprocess.CompletedProcess([], 0, 'running healthy unless-stopped', '')
        with patch.object(monitor.subprocess, 'run', return_value=response), patch.object(monitor.shutil, 'disk_usage', return_value=type('Disk', (), {'free': 1, 'total': 100})()), patch.object(monitor.urllib.request, 'urlopen', side_effect=OSError()):
            self.assertEqual(monitor.issues(self.env, 1000), ['copia_local', 'copia_remota', 'disco_bajo', 'https_cooper'])
            response.stdout = 'exited unhealthy no'
            self.assertIn('servicio_n8n', monitor.issues(self.env, 1000))

    def execute_node(self, packet, state=None):
        script = "const fs=require('fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));const crypto=require('crypto');const f=new Function('$json','$env','$getWorkflowStaticData','require',input.code);console.log(JSON.stringify(f({body:input.packet},{COOPER_WEBHOOK_SECRET:input.secret},()=>input.state,require)));"
        result = subprocess.run(['node', '-e', script], input=json.dumps({'packet': packet, 'secret': self.env['COOPER_WEBHOOK_SECRET'], 'state': state or {}, 'code': (DEPLOY / 'monitor-validar.js').read_text()}), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)[0]['json']

    def test_hmac_real_acepta_prueba_y_rechaza_alteracion(self):
        import time
        now = int(time.time())
        packet = monitor.envelope(['disco_bajo'], now, self.env['COOPER_WEBHOOK_SECRET'], prueba=True)
        result = self.execute_node(packet)
        self.assertTrue(result['ok'])
        self.assertFalse(result['enviar'])
        packet['payload'] = packet['payload'].replace('disco_bajo', 'copia_local')
        self.assertEqual(self.execute_node(packet)['codigo'], 401)

    def test_rechaza_vencido_codigos_ajenos_y_replay(self):
        import time
        now = int(time.time())
        for problems, date in [(['secreto'], now), (['disco_bajo'], now - 301)]:
            self.assertEqual(self.execute_node(monitor.envelope(problems, date, self.env['COOPER_WEBHOOK_SECRET']))['codigo'], 401)
        packet = monitor.envelope(['disco_bajo'], now, self.env['COOPER_WEBHOOK_SECRET'])
        self.assertFalse(self.execute_node(packet, {'avisos': {packet['firma']: now}})['enviar'])

    def test_workflow_solo_referencia_credencial_y_no_se_activa(self):
        wf = generador.workflow('credencial-ficticia', 'Telegram de prueba', '123')
        self.assertFalse(wf['active'])
        self.assertEqual(wf['nodes'][0]['parameters']['path'], 'cooper/v1/monitor')
        tg = next(n for n in wf['nodes'] if n['type'].endswith('.telegram'))
        self.assertEqual(tg['credentials']['telegramApi']['id'], 'credencial-ficticia')
        self.assertNotIn('token', json.dumps(wf).lower())
        self.assertFalse(wf['settings']['saveManualExecutions'])

    def test_recibo_filtra_datos_y_exige_fecha_y_snapshot(self):
        row = {'snapshot': 'a' * 64, 'fecha': 1000, 'restauracion': 'PASS', 'privado': 'no guardar'}
        self.assertNotIn('privado', recibo.receipt(row, 1000))
        for change in [{'fecha': 1}, {'snapshot': 'latest'}, {'restauracion': 'FAIL'}]:
            with self.assertRaises(RuntimeError):
                recibo.receipt({**row, **change}, 1000)

    def test_snapshot_mas_reciente_se_compara_por_instante_no_zona(self):
        password = self.root / 'clave'
        password.write_text('ficticio')
        password.chmod(0o600)
        snapshots = [
            {'id': 'a' * 64, 'time': '2026-11-21T12:00:00+01:00'},
            {'id': 'b' * 64, 'time': '2026-11-21T08:00:00-05:00'},
        ]
        with patch.object(replica, 'execute', side_effect=['', json.dumps(snapshots), '']), patch.object(operar, 'verify', return_value={'archivos': {}, 'tablas': {}}):
            result = replica.validate_repo(self.root, password, Path('/ficticio'), self.root / 'restore')
        self.assertEqual(result['snapshot'], 'b' * 64)

    def test_rsync_fallido_conserva_copia_vigente(self):
        root = self.root / 'copias'
        root.mkdir()
        previous = root / 'anterior'
        previous.mkdir()
        (root / 'actual').symlink_to('anterior')
        key = self.root / 'llave'
        key.write_text('ficticio')
        key.chmod(0o600)
        args = type('Args', (), {'destino': root, 'servidor': 'operador@ficticio.invalid', 'llave': key})()
        with patch.object(replica, 'execute', side_effect=RuntimeError('red caída')):
            with self.assertRaises(RuntimeError):
                replica.replicate(args)
        self.assertEqual((root / 'actual').resolve(), previous)

    def test_restauracion_invalida_no_promueve_repo(self):
        root = self.root / 'copias'
        root.mkdir()
        previous = root / 'anterior'
        previous.mkdir()
        (root / 'actual').symlink_to('anterior')
        key = self.root / 'llave'
        key.write_text('ficticio')
        key.chmod(0o600)
        args = type('Args', (), {'destino': root, 'servidor': 'operador@ficticio.invalid', 'llave': key, 'password': key, 'restic': Path('/ficticio')})()
        with patch.object(replica, 'execute', return_value=''), patch.object(replica, 'validate_repo', side_effect=RuntimeError('corrupción')):
            with self.assertRaises(RuntimeError):
                replica.replicate(args)
        self.assertEqual((root / 'actual').resolve(), previous)


if __name__ == '__main__':
    unittest.main(verbosity=2)
