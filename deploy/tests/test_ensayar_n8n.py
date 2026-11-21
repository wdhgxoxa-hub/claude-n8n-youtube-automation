import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
spec = importlib.util.spec_from_file_location('ensayon8n', DEPLOY / 'ensayar-n8n.py')
ensayo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ensayo)


class EnsayoN8nTest(unittest.TestCase):
    def fixture(self, root):
        source = root / 'origen/database.sqlite'
        source.parent.mkdir()
        with closing(sqlite3.connect(source)) as db, db:
            db.executescript('''CREATE TABLE workflow_entity(id TEXT PRIMARY KEY, active INTEGER, versionId TEXT, activeVersionId TEXT, versionCounter INTEGER);
            INSERT INTO workflow_entity VALUES('existente',1,'version-original','version-original',1);
            INSERT INTO workflow_entity VALUES('ajeno',1,'sin-cambio','sin-cambio',2);
            CREATE TABLE data_table_user_prueba(id INTEGER, dato TEXT);
            INSERT INTO data_table_user_prueba VALUES(1,'dato ficticio');
            CREATE TABLE credentials_entity(id TEXT, data TEXT);
            INSERT INTO credentials_entity VALUES('ficticia','no seleccionar contenido');''')
        entry = root / 'entrada.json'
        entry.write_text(json.dumps([{'id': 'existente', 'active': False}, {'id': 'nuevo', 'active': False}]))
        manifest = root / 'columnas.json'
        manifest.write_text('{}')
        script = root / 'columnas.cjs'
        script.write_text('// fixture')
        return source, entry, manifest, script

    def test_importa_aislado_y_restaura_bytes_metadatos_y_filas(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, entry, manifest, script = self.fixture(root)
            plan = [{'name': 'leccion', 'type': 'string'}]
            def run(data, _entry, _manifest, _script, command, args):
                with closing(sqlite3.connect(data / 'database.sqlite')) as db, db:
                    if command == 'n8n':
                        db.executescript("UPDATE workflow_entity SET active=0,versionId='version-importada' WHERE id='existente'; INSERT INTO workflow_entity VALUES('nuevo',0,'version-nueva',NULL,1);")
                        return 'importado'
                    if '--aplicar' in args:
                        db.execute('ALTER TABLE data_table_user_prueba ADD COLUMN leccion TEXT')
                        return json.dumps({'columnas': plan})
                    columns = [r[1] for r in db.execute('PRAGMA table_info(data_table_user_prueba)')]
                    return json.dumps({'columnas': [] if 'leccion' in columns else plan})
            with patch.object(ensayo, 'run_container', side_effect=run):
                result = ensayo.rehearse(source, entry, manifest, script, root / 'ensayo')
            self.assertEqual(result['reversion'], 'PASS')
            self.assertEqual(result['respaldo_sha256'], result['restauracion_sha256'])
            self.assertEqual(result['flujos_importados'], 2)
            self.assertEqual(result['columnas_agregadas'], 1)
            self.assertEqual(ensayo.inventory(source)['flujos']['existente'][0], 1)

    def test_rechaza_flujo_activo_cambio_ajeno_o_filas_modificadas(self):
        before = {'flujos': {'a': [1,'v','v',1], 'b': [1,'b','b',1]}, 'datos': {'t': 'hash'}, 'conteos': {}}
        for flows, hashes in [({'a': [1,'n',None,2], 'b': [1,'b','b',1]}, {'t': 'hash'}),
                              ({'a': [0,'n',None,2], 'b': [0,'b','b',1]}, {'t': 'hash'}),
                              ({'a': [0,'n',None,2], 'b': [1,'b','b',1]}, {'t': 'distinto'})]:
            with self.assertRaises(RuntimeError):
                ensayo.validate_import(before, {'flujos': flows, 'datos': hashes, 'conteos': {}}, {'a'})

    def test_no_admite_entrada_activa_ni_reutilizar_destino(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, entry, manifest, script = self.fixture(root)
            entry.write_text('[{"id":"a","active":true}]')
            with self.assertRaisesRegex(RuntimeError, 'inactivo'):
                ensayo.rehearse(source, entry, manifest, script, root / 'ensayo')
            with self.assertRaisesRegex(RuntimeError, 'Destino nuevo'):
                ensayo.rehearse(source, entry, manifest, script, source.parent)


if __name__ == '__main__':
    unittest.main(verbosity=2)
