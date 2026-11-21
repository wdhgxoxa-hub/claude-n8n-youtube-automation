from contextlib import closing
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import unittest

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
spec = importlib.util.spec_from_file_location('clon_restaurado', DEPLOY / 'preparar-clon-restaurado.py')
clon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clon)


class ClonRestauradoTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        source = self.root / 'datos-originales'
        for name in clon.BASES:
            path = source / name
            path.parent.mkdir(parents=True)
            db = sqlite3.connect(path)
            self.addCleanup(db.close)
            db.execute('CREATE TABLE videos(id INTEGER PRIMARY KEY)')
            db.execute('CREATE TABLE workflow_entity(id TEXT PRIMARY KEY, activeVersionId TEXT)')
            db.execute('CREATE TABLE migrations(id INTEGER PRIMARY KEY)')
            db.execute('INSERT INTO videos VALUES(1)')
            db.execute("INSERT INTO workflow_entity VALUES('prueba', 'anterior')")
            db.execute('INSERT INTO migrations VALUES(11)')
            db.commit()
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('INSERT INTO videos VALUES(2)')
            db.execute("UPDATE workflow_entity SET activeVersionId='publicada' WHERE id='prueba'")
            db.execute('INSERT INTO migrations VALUES(13)')
            db.commit()
        self.restored = self.root / 'restaurada'
        clon.operar.copy_data(source, self.restored)

    def test_clon_autonomo_conserva_transacciones_wal_al_trasladar_solo_sqlite(self):
        result = clon.prepare(self.restored, self.root / 'clon')
        self.assertEqual(result['wal_incorporados'], [name + '-wal' for name in clon.BASES])
        clon.operar.verify(self.root / 'clon/datos')
        for index, name in enumerate(clon.BASES):
            source = self.root / 'clon/datos' / name
            target = self.root / f'trasladada-{index}.sqlite'
            shutil.copyfile(source, target)
            with closing(sqlite3.connect(target)) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM videos').fetchone()[0], 2)
                self.assertEqual(db.execute('SELECT activeVersionId FROM workflow_entity').fetchone()[0], 'publicada')
                self.assertEqual(db.execute('SELECT id FROM migrations ORDER BY id').fetchall(), [(11,), (13,)])
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchall(), [('ok',)])
            self.assertFalse(Path(str(source) + '-wal').exists())

    def test_rechaza_wal_omitido_antes_de_crear_destino(self):
        (self.restored / 'n8n/database.sqlite-wal').unlink()
        destination = self.root / 'incompleta'
        with self.assertRaisesRegex(RuntimeError, 'Restauración rechazada'):
            clon.prepare(self.restored, destination)
        self.assertFalse(destination.exists())

    def test_no_sobrescribe_destino(self):
        destination = self.root / 'conservar'
        destination.mkdir()
        (destination / 'marca').write_text('original')
        with self.assertRaisesRegex(RuntimeError, 'destino nuevo'):
            clon.prepare(self.restored, destination)
        self.assertEqual((destination / 'marca').read_text(), 'original')

    def test_manifiesto_sin_wal_tampoco_autoriza_traslado(self):
        path = self.restored / 'manifiesto.json'
        manifest = json.loads(path.read_text())
        del manifest['archivos']['n8n/database.sqlite-wal']
        clon.operar.write_json(path, manifest)
        destination = self.root / 'manifiesto-incompleto'
        with self.assertRaisesRegex(RuntimeError, 'Restauración rechazada'):
            clon.prepare(self.restored, destination)
        self.assertFalse(destination.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
