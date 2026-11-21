"""El instalador solo anexa un secreto nuevo: nunca lee el entorno existente."""
from contextlib import closing
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('configurar_marcas_worker', Path(__file__).resolve().parents[1] / 'configurar-marcas-worker.py')
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class ConfigurarMarcasWorkerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.environment = self.root / 'entorno-ficticio'
        self.environment.write_bytes(b'VARIABLE_FICTICIA=contenido-de-prueba')
        self.environment.chmod(0o600)
        self.state = self.root / 'estado'
        self.cooper = self.root / 'cooper.sqlite'
        self.n8n = self.root / 'n8n.sqlite'
        with closing(sqlite3.connect(self.cooper)) as db, db:
            for table in ('cuentas_marca', 'piezas_marca', 'marca_ingestas'):
                db.execute('CREATE TABLE ' + table + ' (id TEXT)')
        with closing(sqlite3.connect(self.n8n)) as db, db:
            db.execute('CREATE TABLE workflow_entity (id TEXT, active INTEGER, activeVersionId TEXT)')
            db.executemany('INSERT INTO workflow_entity VALUES (?,0,NULL)', [(x,) for x in worker.WORKFLOWS])

    def configure(self):
        return worker.configure(self.environment, self.state, self.cooper, self.n8n)

    def test_anexa_sin_lectura_y_recibo_no_revela_secreto(self):
        original_open, original_read = os.open, Path.read_text

        def checked_open(path, flags, *args, **kwargs):
            if Path(path) == self.environment:
                self.assertEqual(flags & os.O_ACCMODE, os.O_WRONLY)
                self.assertTrue(flags & os.O_APPEND)
                self.assertTrue(flags & os.O_NOFOLLOW)
            return original_open(path, flags, *args, **kwargs)

        def checked_read(path, *args, **kwargs):
            self.assertNotEqual(path, self.environment)
            return original_read(path, *args, **kwargs)

        with patch.object(worker.os, 'open', checked_open), patch.object(Path, 'read_text', checked_read), patch.object(worker.secrets, 'token_hex', return_value='FICTICIO' * 8):
            result = self.configure()
        self.assertEqual(result['estado'], 'CONFIGURADO')
        self.assertFalse(result['entorno_leido'])
        self.assertEqual(self.environment.read_bytes(), b'VARIABLE_FICTICIA=contenido-de-prueba\nCOOPER_MARCAS_WORKER_SECRET=' + b'FICTICIO' * 8 + b'\nCOOPER_MARCAS=simulada\nCOOPER_MARCAS_HABILITAR=0\n')
        marker = self.state / 'marcas-worker-configurado.json'
        self.assertNotIn('FICTICIO', marker.read_text() + json.dumps(result))
        self.assertEqual(marker.stat().st_mode & 0o777, 0o600)

    def test_segunda_ejecucion_no_regenera_ni_anexa(self):
        self.configure()
        size = self.environment.stat().st_size
        with patch.object(worker.secrets, 'token_hex', side_effect=AssertionError('No regenerar')):
            self.assertEqual(self.configure()['estado'], 'YA_CONFIGURADO')
        self.assertEqual(self.environment.stat().st_size, size)

    def test_bloquea_trabajador_activo_y_version_publicada(self):
        for active, version in [(1, None), (0, 'version-ficticia')]:
            with self.subTest(active=active, version=version):
                with closing(sqlite3.connect(self.n8n)) as db, db:
                    db.execute('UPDATE workflow_entity SET active=?,activeVersionId=? WHERE id=?', (active, version, worker.WORKFLOWS[0]))
                with self.assertRaises(RuntimeError):
                    self.configure()
                self.assertFalse((self.state / 'marcas-worker-configurado.json').exists())

    def test_bloquea_cuentas_piezas_e_ingestas_sin_consultar_su_contenido(self):
        for table in ('cuentas_marca', 'piezas_marca', 'marca_ingestas'):
            with self.subTest(table=table):
                with closing(sqlite3.connect(self.cooper)) as db, db:
                    db.execute('INSERT INTO ' + table + ' VALUES (?)', ('dato-ficticio',))
                with self.assertRaises(RuntimeError):
                    self.configure()
                with closing(sqlite3.connect(self.cooper)) as db, db:
                    db.execute('DELETE FROM ' + table)

    def test_exige_dos_trabajadores_presentes(self):
        with closing(sqlite3.connect(self.n8n)) as db, db:
            db.execute('DELETE FROM workflow_entity WHERE id=?', (worker.WORKFLOWS[0],))
        with self.assertRaises(RuntimeError):
            self.configure()

    def test_respeta_candado_operativo(self):
        self.state.mkdir()
        with (self.state / 'operacion.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError):
                self.configure()

    def test_rechaza_permisos_amplios_y_enlaces(self):
        self.environment.chmod(0o644)
        with self.assertRaises(RuntimeError):
            self.configure()
        self.environment.chmod(0o600)
        link = self.root / 'enlace'
        link.symlink_to(self.environment)
        with self.assertRaises(RuntimeError):
            worker.configure(link, self.state, self.cooper, self.n8n)

    def test_corte_despues_del_anexo_no_regenera(self):
        real_write_marker = worker.write_marker

        def interrupted(path, value):
            if value['estado'] == 'configurado':
                raise OSError('Corte ficticio después de fsync')
            return real_write_marker(path, value)

        with patch.object(worker, 'write_marker', interrupted), self.assertRaises(OSError):
            self.configure()
        size = self.environment.stat().st_size
        with patch.object(worker.secrets, 'token_hex', side_effect=AssertionError('No regenerar')), self.assertRaises(RuntimeError):
            self.configure()
        self.assertEqual(self.environment.stat().st_size, size)

    def test_entorno_reemplazado_o_truncado_exige_revision(self):
        self.configure()
        self.environment.write_bytes(b'FICTICIO=truncado')
        with self.assertRaises(RuntimeError):
            self.configure()
