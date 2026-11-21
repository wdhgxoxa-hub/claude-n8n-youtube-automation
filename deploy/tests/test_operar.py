import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("operar", Path(__file__).parents[1] / "operar.py")
op = importlib.util.module_from_spec(spec)
spec.loader.exec_module(op)


class CopiasTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "source"
        for name, file in (("cooper", "cooper.sqlite"), ("n8n", "database.sqlite")):
            directory = self.source / name
            directory.mkdir(parents=True)
            with closing(sqlite3.connect(directory / file)) as db, db:
                db.execute('CREATE TABLE prueba(id INTEGER PRIMARY KEY, adjunto BLOB)')
                db.execute('INSERT INTO prueba VALUES(1, ?)', (b"adjunto ficticio",))
        (self.source / "n8n/binaryData").mkdir()
        (self.source / "n8n/binaryData/prueba").write_bytes(b"binario de n8n")

    def test_copia_incluye_adjuntos_conteos_y_hashes(self):
        target = self.root / "target"
        op.copy_data(self.source, target)
        result = op.verify(target)
        self.assertEqual(result['tablas']['cooper/cooper.sqlite']['prueba'], 1)
        self.assertIn('n8n/binaryData/prueba', result['archivos'])

    def test_restauracion_rechaza_corrupcion(self):
        target = self.root / "target"
        op.copy_data(self.source, target)
        (target / "n8n/binaryData/prueba").write_bytes(b"corrompido")
        with self.assertRaisesRegex(RuntimeError, "hashes"):
            op.verify(target)

    def test_restauracion_rechaza_filas_ausentes(self):
        target = self.root / "target"
        op.copy_data(self.source, target)
        with closing(sqlite3.connect(target / "cooper/cooper.sqlite")) as db, db:
            db.execute('DELETE FROM prueba')
        with self.assertRaisesRegex(RuntimeError, "conteos"):
            op.verify(target)

    def test_no_sobrescribe_destino(self):
        target = self.root / "target"
        target.mkdir()
        (target / "conservar").write_text("original")
        with self.assertRaisesRegex(RuntimeError, "vacío"):
            op.copy_data(self.source, target)
        self.assertEqual((target / "conservar").read_text(), "original")

    def test_rechaza_enlaces_fuera_del_volumen(self):
        (self.source / "n8n/enlace").symlink_to(self.root)
        with self.assertRaisesRegex(RuntimeError, "simbólicos"):
            op.copy_data(self.source, self.root / "target")

    def test_rechaza_origen_modificado_durante_copia(self):
        original = op.shutil.copytree
        def copy(*args, **kwargs):
            result = original(*args, **kwargs)
            (self.source / "n8n/binaryData/prueba").write_bytes(b"otro contenido")
            return result
        with patch.object(op.shutil, 'copytree', side_effect=copy):
            with self.assertRaisesRegex(RuntimeError, "origen cambió"):
                op.copy_data(self.source, self.root / "target")

    def test_wal_contiene_transacciones_confirmadas(self):
        db = sqlite3.connect(self.source / "cooper/cooper.sqlite")
        self.addCleanup(db.close)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('INSERT INTO prueba VALUES(2, ?)', (b"en WAL",))
        db.commit()
        op.copy_data(self.source, self.root / "target")
        result = op.verify(self.root / "target")
        self.assertEqual(result['tablas']['cooper/cooper.sqlite']['prueba'], 2)

    def test_rechaza_permisos_de_secretos_abiertos(self):
        path = self.root / 'env'
        path.write_text('AUTH_SECRET=ficticio')
        path.chmod(0o644)
        with self.assertRaisesRegex(RuntimeError, '0600'):
            op.private_file(path)

    def test_config_no_ejecuta_shell(self):
        path = self.root / 'env'
        values = {key: 'x' * 32 for key in ('AUTH_SECRET', 'COOPER_N8N_TOKEN', 'COOPER_WEBHOOK_SECRET', 'N8N_ENCRYPTION_KEY', 'N8N_RUNNERS_AUTH_TOKEN')}
        values.update(DATA_ROOT=str(self.source), STATE_ROOT=str(self.root / 'state'),
                      MARCADOR='$(touch /no-ejecutar)')
        path.write_text('\n'.join(f'{k}={v}' for k, v in values.items()))
        path.chmod(0o600)
        env, _ = op.config(path)
        self.assertEqual(env['MARCADOR'], '$(touch /no-ejecutar)')

    def test_reinicia_servicios_tras_fallo_de_copia(self):
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(self.root / 'state')}, self.root / 'env')
        calls = []
        def compose(*args):
            calls.append(args)
            return 'cooper\nn8n' if len(calls) == 1 else ''
        with patch.object(operator, 'compose', side_effect=compose), patch.object(op, 'copy_data', side_effect=RuntimeError('disco lleno')):
            with self.assertRaisesRegex(RuntimeError, 'disco lleno'):
                operator.snapshot()
        self.assertEqual(calls[-1], ('start', 'cooper', 'n8n'))

    def test_reversion_no_borra_datos_si_copia_no_es_valida(self):
        state = self.root / 'state'
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(state)}, self.root / 'env')
        op.write_json(state / 'anterior.json', {'snapshot': 'deadbeef', 'image': 'anterior'})
        before = op.manifest(self.source)
        with patch.object(operator, 'restore', side_effect=RuntimeError('corrupto')):
            with self.assertRaisesRegex(RuntimeError, 'corrupto'):
                operator.rollback()
        self.assertEqual(op.manifest(self.source), before)

    def test_importacion_no_sobrescribe_instalacion(self):
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(self.root / 'state')}, self.root / 'env')
        before = op.manifest(self.source)
        with patch.object(operator, 'compose', return_value=''), patch.object(operator, 'restore') as restore:
            with self.assertRaisesRegex(RuntimeError, 'vacío'):
                operator.import_snapshot('deadbeef')
            restore.assert_not_called()
        self.assertEqual(op.manifest(self.source), before)

    def test_importar_pc_sin_caddy_prepara_volumenes(self):
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(self.root / 'state')}, self.root / 'env')
        operator.ownership()
        self.assertTrue((self.source / 'caddy-data').is_dir())
        self.assertTrue((self.source / 'caddy-config').is_dir())

    def test_actualizacion_fallida_cierra_servicios_y_conserva_reversion(self):
        state = self.root / 'state'
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(state)}, self.root / 'env')
        calls = []
        def compose(*args, **kwargs):
            calls.append(args)
            if args[0] == 'up':
                raise RuntimeError('salud fallida')
            return 'contenedor'
        before = op.manifest(self.source)
        with patch.object(operator, 'compose', side_effect=compose), patch.object(operator, 'snapshot', return_value='deadbeef'), patch.object(op, 'run', return_value='imagen-anterior'):
            with self.assertRaisesRegex(RuntimeError, 'detenidos'):
                operator.update('localhost/cooper:' + 'a' * 40)
        self.assertEqual(calls[-1], ('stop',))
        self.assertTrue((state / 'anterior.json').exists())
        self.assertTrue((state / 'mantenimiento').exists())
        self.assertEqual(op.manifest(self.source), before)

    def test_compose_incorpora_tunel_solo_si_esta_habilitado(self):
        state = self.root / 'state'
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(state)}, self.root / 'env')
        with patch.object(op, 'run', return_value='') as run:
            operator.compose('ps')
            self.assertNotIn(str(op.DEPLOY / 'compose.chat.yaml'), run.call_args.args[0])
            (state / 'chat-tunel.enabled').touch()
            operator.compose('ps')
            self.assertIn(str(op.DEPLOY / 'compose.chat.yaml'), run.call_args.args[0])

    def test_copia_detiene_relays_antes_de_los_contenedores(self):
        operator = op.Operator({'DATA_ROOT': str(self.source), 'STATE_ROOT': str(self.root / 'state')}, self.root / 'env')
        calls = []
        def compose(*args):
            calls.append(args)
            return 'chat-cooper chat-n8n chat-runner cooper n8n' if len(calls) == 1 else ''
        with patch.object(operator, 'compose', side_effect=compose), patch.object(op, 'copy_data', side_effect=RuntimeError('prueba')):
            with self.assertRaises(RuntimeError):
                operator.snapshot()
        self.assertEqual(calls[1:4], [('stop', 'chat-cooper'), ('stop', 'chat-n8n'), ('stop', 'chat-runner')])
        self.assertEqual(calls[-1], ('start', 'chat-cooper', 'chat-n8n', 'chat-runner', 'cooper', 'n8n'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
