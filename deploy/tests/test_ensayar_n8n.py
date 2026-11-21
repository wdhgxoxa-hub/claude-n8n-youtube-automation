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

    def test_solo_columnas_no_importa_no_publica_y_restaura_exactamente(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, entry, manifest, script = self.fixture(root)
            entry.write_text('[]')
            plan = [{'table': 'fab_eventos', 'name': 'evento', 'type': 'string'}]
            calls = []
            def run(data, _entry, _manifest, _script, command, args):
                calls.append(command)
                self.assertEqual(command, 'node')
                with closing(sqlite3.connect(data / 'database.sqlite')) as db, db:
                    if '--aplicar' in args:
                        db.execute('ALTER TABLE data_table_user_prueba ADD COLUMN evento TEXT')
                        return json.dumps({'columnas': plan})
                    fields = [r[1] for r in db.execute('PRAGMA table_info(data_table_user_prueba)')]
                    return json.dumps({'columnas': [] if 'evento' in fields else plan})
            with patch.object(ensayo, 'run_container', side_effect=run):
                result = ensayo.rehearse(source, entry, manifest, script, root / 'ensayo', columns_only=True)
            self.assertEqual(calls, ['node'] * 3)
            self.assertEqual(result['modalidad'], 'solo_columnas')
            self.assertEqual(result['plan_columnas'], plan)
            self.assertEqual(result['columnas_script_sha256'], ensayo.operar.digest(script))
            self.assertEqual(result['flujos_importados'], 0)
            self.assertEqual(result['respaldo_sha256'], result['restauracion_sha256'])
            self.assertEqual(ensayo.inventory(source)['flujos'], ensayo.inventory(root / 'ensayo/actualizada/database.sqlite')['flujos'])

    def test_solo_columnas_rechaza_workflows_y_plan(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, entry, manifest, script = self.fixture(root)
            with self.assertRaisesRegex(RuntimeError, 'Solo columnas'):
                ensayo.rehearse(source, entry, manifest, script, root / 'ensayo', columns_only=True)
            entry.write_text('[]')
            with self.assertRaisesRegex(RuntimeError, 'Solo columnas'):
                ensayo.rehearse(source, entry, manifest, script, root / 'ensayo', root / 'plan.json', True)

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

    def test_publica_dependencias_y_restaura_tras_publicar(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, entry, manifest, script = self.fixture(root)
            workflows = json.loads(entry.read_text())
            workflows[0]['nodes'] = [{'type': 'n8n-nodes-base.executeWorkflow', 'parameters': {'workflowId': {'value': 'nuevo'}}}]
            entry.write_text(json.dumps(workflows))
            publish = root / 'publicar.json'
            publish.write_text('["nuevo", "existente"]')
            called = []
            def run(data, _entry, _manifest, _script, command, args):
                if command != 'n8n':
                    return '{"columnas":[]}'
                with closing(sqlite3.connect(data / 'database.sqlite')) as db, db:
                    if args[0] == 'import:workflow':
                        db.executescript("UPDATE workflow_entity SET active=0,versionId='version-importada',activeVersionId=NULL WHERE id='existente'; INSERT INTO workflow_entity VALUES('nuevo',0,'version-nueva',NULL,1);")
                    else:
                        wid = args[1].removeprefix('--id=')
                        called.append(wid)
                        db.execute('UPDATE workflow_entity SET active=1,activeVersionId=versionId WHERE id=?', (wid,))
                return ''
            with patch.object(ensayo, 'run_container', side_effect=run):
                result = ensayo.rehearse(source, entry, manifest, script, root / 'ensayo', publish)
            self.assertEqual(called, ['nuevo', 'existente'])
            self.assertEqual(result['publicados'], called)
            self.assertEqual(result['publicacion'], 'PASS')
            self.assertEqual(result['publicar_sha256'], ensayo.operar.digest(publish))
            self.assertEqual(result['reversion'], 'PASS')
            self.assertEqual(result['respaldo_sha256'], result['restauracion_sha256'])
            self.assertEqual(ensayo.inventory(source)['flujos']['existente'][1], 'version-original')

    def test_rechaza_orden_invertido_duplicados_y_dependencias_no_publicadas(self):
        workflows = [{'id': 'a', 'nodes': [{'type': 'n8n-nodes-base.executeWorkflow', 'parameters': {'workflowId': {'value': 'b'}}}]}, {'id': 'b'}]
        baseline = {'flujos': {'a': [1, 'v', 'v', 1], 'b': [1, 'v', 'v', 1]}}
        for plan in [[], {}, ['a', 'b'], ['a'], ['b', 'b'], ['ajeno'], ['../b']]:
            with self.subTest(plan=plan), self.assertRaises(RuntimeError):
                ensayo.validate_publish_order(workflows, plan, baseline)
        ensayo.validate_publish_order(workflows, ['b', 'a'], baseline)

    def test_admite_dependencia_ajena_publicada_y_omite_nodo_deshabilitado(self):
        workflow = {'id': 'a', 'nodes': [{'type': 'n8n-nodes-base.executeWorkflow', 'parameters': {'workflowId': 'b'}}]}
        baseline = {'flujos': {'b': [1, 'v', 'v', 1]}}
        ensayo.validate_publish_order([workflow], ['a'], baseline)
        baseline['flujos']['b'][0] = 0
        with self.assertRaises(RuntimeError):
            ensayo.validate_publish_order([workflow], ['a'], baseline)
        workflow['nodes'][0]['disabled'] = True
        ensayo.validate_publish_order([workflow], ['a'], baseline)

    def test_detecta_publicacion_omitida_version_erronea_o_modificacion_ajena(self):
        before = {'flujos': {'a': [1, 'v', 'v', 1], 'ajeno': [1, 'x', 'x', 1]}, 'datos': {'tabla': 'hash'}, 'conteos': {'credentials_entity': 1}}
        good = {'flujos': {'a': [1, 'n', 'n', 2], 'ajeno': [1, 'x', 'x', 1]}, 'datos': {'tabla': 'hash'}, 'conteos': {'credentials_entity': 1}}
        ensayo.validate_published(before, good, {'a'}, ['a'])
        for change in ('inactivo', 'version', 'ajeno', 'datos', 'conteos'):
            after = json.loads(json.dumps(good))
            if change == 'inactivo': after['flujos']['a'][0] = 0
            if change == 'version': after['flujos']['a'][2] = 'v'
            if change == 'ajeno': after['flujos']['ajeno'][0] = 0
            if change == 'datos': after['datos']['tabla'] = 'otro'
            if change == 'conteos': after['conteos']['credentials_entity'] = 2
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                ensayo.validate_published(before, after, {'a'}, ['a'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
