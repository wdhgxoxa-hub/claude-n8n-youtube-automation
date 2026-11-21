from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
spec = importlib.util.spec_from_file_location('ensayo_motor_n8n', DEPLOY / 'ensayar-motor-n8n.py')
motor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(motor)


class MotorN8nTest(unittest.TestCase):
    def test_migra_idempotente_y_vuelve_a_imagen_anterior_con_bytes_originales(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'origen/database.sqlite'
            source.parent.mkdir()
            with closing(sqlite3.connect(source)) as db, db:
                db.executescript('''CREATE TABLE workflow_entity(id TEXT,active INTEGER,versionId TEXT,activeVersionId TEXT,versionCounter INTEGER);
                INSERT INTO workflow_entity VALUES('ficticio',1,'v1','v1',1);
                CREATE TABLE migrations(id INTEGER PRIMARY KEY);
                INSERT INTO migrations VALUES(1);
                CREATE TABLE data_table_user_prueba(id INTEGER,valor TEXT);
                INSERT INTO data_table_user_prueba VALUES(1,'ficticio');
                CREATE TABLE credentials_entity(id TEXT,data TEXT);
                INSERT INTO credentials_entity VALUES('fixture','nunca leer');''')
            called = []
            def initialize(image, data):
                called.append(image)
                with closing(sqlite3.connect(data / 'database.sqlite')) as db, db:
                    if image == motor.IMAGES['imagen']:
                        db.execute('INSERT OR IGNORE INTO migrations VALUES(2)')
                    else:
                        self.assertEqual(db.execute('SELECT count(*) FROM migrations').fetchone()[0], 1)
            with patch.object(motor, 'initialize', initialize):
                result = motor.rehearse(source, root / 'ensayo')
            self.assertEqual(called, [motor.IMAGES['imagen'], motor.IMAGES['imagen'], motor.IMAGES['anterior']])
            self.assertEqual(result['migraciones_antes'], 1)
            self.assertEqual(result['migraciones_despues'], 2)
            self.assertEqual(result['respaldo_sha256'], result['restauracion_sha256'])
            self.assertEqual(result['reversion'], 'PASS')

    def test_no_acepta_cambios_en_datos_estados_o_conteos(self):
        baseline = {'flujos': {'a': [1, 'v', 'v', 1]}, 'datos': {'t': 'huella'}, 'conteos': {'t': 1, 'migrations': 1}}
        for field, value in [('flujos', {}), ('datos', {'t': 'otra'}), ('conteos', {'t': 0, 'migrations': 2})]:
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                motor.preserve(baseline, {**baseline, field: value})

    def test_cli_no_tiene_red_ni_puertos_ni_exporta_valores(self):
        calls = []
        def run(command, **_kwargs):
            calls.append(command)
            class Result:
                returncode = 0
            return Result()
        with patch.object(motor.subprocess, 'run', run):
            motor.initialize(motor.IMAGES['imagen'], Path('/fixture'))
        command = calls[0]
        self.assertIn('--network=none', command)
        self.assertIn('--cpus=0.5', command)
        self.assertIn('--pull=never', command)
        self.assertEqual(command[-3:], ['export:workflow', '--all', '--output=/dev/null'])
        self.assertNotIn('-p', command)
