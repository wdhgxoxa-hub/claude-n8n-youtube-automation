"""La conciliación solo admite publicaciones confirmadas y conserva otras columnas."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('reconciliar', Path(__file__).resolve().parents[1] / 'tools/cooper/reconciliar_youtube_aprendizaje.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Conciliacion(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript('''
          CREATE TABLE data_table(id TEXT,name TEXT);
          INSERT INTO data_table VALUES ('V','fab_videos'),('P','publicaciones'),('T','fab_trabajos');
          CREATE TABLE data_table_user_V(video_id TEXT,canal_id TEXT,youtube_id TEXT,estado TEXT,nota TEXT);
          CREATE TABLE data_table_user_P(video_id TEXT,canal_id TEXT,request_id TEXT,estado TEXT,plataformas TEXT,resultado TEXT);
          CREATE TABLE data_table_user_T(job_id TEXT,canal_id TEXT,modo TEXT,estado TEXT,resultado TEXT);
          INSERT INTO data_table_user_V VALUES ('v','c',NULL,'publicado','intacta');
          INSERT INTO data_table_user_P VALUES ('v','c','r','publicado','youtube','{"urls":["https://youtu.be/abcdefghijk"]}');
        ''')

    def tearDown(self):
        self.db.close()

    def test_lectura_y_reversa_real_solo_youtube_id(self):
        self.assertFalse(mod.reconciliar(self.db, 'v', 'r')['aplicado'])
        self.assertIsNone(self.db.execute('SELECT youtube_id FROM data_table_user_V').fetchone()[0])
        with tempfile.TemporaryDirectory() as tmp:
            diario = Path(tmp) / 'previo.json'
            r = mod.reconciliar(self.db, 'v', 'r', True, diario)
            self.assertTrue(r['reversa_probada'])
            self.assertTrue(r['aplicado'])
            self.assertIsNone(json.loads(diario.read_text())['youtube_id_anterior'])
            self.assertEqual(diario.stat().st_mode & 0o777, 0o600)
        self.assertEqual(tuple(self.db.execute('SELECT youtube_id,nota FROM data_table_user_V').fetchone()), ('abcdefghijk', 'intacta'))

    def test_rechaza_canal_ajeno_id_distinto_ambiguedad_y_estado(self):
        for sql in ["UPDATE data_table_user_P SET canal_id='otro'", "UPDATE data_table_user_V SET youtube_id='xxxxxxxxxxx'", "INSERT INTO data_table VALUES ('V2','fab_videos')", "UPDATE data_table_user_P SET estado='pendiente'"]:
            with self.subTest(sql=sql):
                self.db.execute(sql)
                self.db.commit()
                with self.assertRaises(ValueError):
                    mod.reconciliar(self.db, 'v', 'r')
                self.tearDown()
                self.setUp()

    def test_diagnostico_solo_acepta_confirmacion_de_la_misma_publicacion(self):
        self.db.execute("UPDATE data_table_user_P SET resultado='{}'")
        red = {'video_id': 'v', 'canal_id': 'c', 'request_id': 'r', 'request_id_coincide': True, 'youtube_id_confirmado': 'abcdefghijk'}
        self.db.execute('INSERT INTO data_table_user_T VALUES (?,?,?,?,?)', ('diag', 'c', 'aprender_diagnostico', 'listo', json.dumps({'redes': [red]})))
        self.db.commit()
        self.assertEqual(mod.reconciliar(self.db, 'v', 'r')['fuentes'], ['diag'])
        red['request_id'] = 'ajeno'
        self.db.execute('UPDATE data_table_user_T SET resultado=?', (json.dumps({'redes': [red]}),))
        self.db.commit()
        with self.assertRaises(ValueError):
            mod.reconciliar(self.db, 'v', 'r')

    def test_diario_existente_o_error_de_reversa_revierte_todo(self):
        with tempfile.TemporaryDirectory() as tmp:
            diario = Path(tmp) / 'previo.json'
            diario.write_text('no sobrescribir')
            with self.assertRaises(FileExistsError):
                mod.reconciliar(self.db, 'v', 'r', True, diario)
            diario.unlink()
            self.db.execute("CREATE TRIGGER bloquear_reversa BEFORE UPDATE ON data_table_user_V WHEN NEW.youtube_id IS NULL BEGIN SELECT RAISE(ABORT,'reversa bloqueada'); END")
            self.db.commit()
            with self.assertRaises(sqlite3.IntegrityError):
                mod.reconciliar(self.db, 'v', 'r', True, diario)
        self.assertIsNone(self.db.execute('SELECT youtube_id FROM data_table_user_V').fetchone()[0])


if __name__ == '__main__':
    unittest.main()
