from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('esquema_n8n_test', Path(__file__).parents[1] / 'esquema-n8n.py')
schema = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schema)


class SchemaTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name) / 'database.sqlite'
        with closing(sqlite3.connect(self.db)) as db, db:
            db.executescript('CREATE TABLE data_table(id TEXT,name TEXT); CREATE TABLE data_table_column(dataTableId TEXT,name TEXT,type TEXT);'
                             'CREATE TABLE workflow_entity(id TEXT,activeVersionId TEXT); CREATE TABLE workflow_history(workflowId TEXT,versionId TEXT,nodes TEXT);')
            for table, columns in json.loads(schema.CONTRACT.read_text())['tablas'].items():
                db.execute('INSERT INTO data_table VALUES(?,?)', (table, table))
                db.executemany('INSERT INTO data_table_column VALUES(?,?,?)', [(table, name, kind) for name, kind in columns.items()])

    def workflow(self, column='evento'):
        return {'id': 'Vigilante', 'nodes': [{'name': 'Buscar', 'type': 'n8n-nodes-base.dataTable',
                'parameters': {'dataTableId': {'value': 'fab_eventos'}, 'filters': {'conditions': [{'keyName': column, 'keyValue': 'valor-ficticio-no-proyectar'}]}}}]}

    def test_inventario_solo_nombres_y_puerta_actual_publicada(self):
        workflow = self.workflow()
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('INSERT INTO workflow_entity VALUES(?,?)', ('Vigilante', 'v1'))
            db.execute('INSERT INTO workflow_history VALUES(?,?,?)', ('Vigilante', 'v1', json.dumps(workflow['nodes'])))
        result = schema.inventory(self.db)
        self.assertNotIn('valor-ficticio', json.dumps(result))
        self.assertTrue(schema.validate(self.db)['ok'])

    def test_heredado_falla_antes_y_solo_proyeccion_completa_pasa(self):
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute("DELETE FROM data_table_column WHERE dataTableId='fab_eventos' AND name IN ('evento','canal_id')")
        plan = [{'tableId': 'fab_eventos', 'table': 'fab_eventos', 'name': name, 'type': 'string'} for name in ('evento', 'canal_id')]
        with self.assertRaises(RuntimeError):
            schema.validate(self.db, [self.workflow()])
        self.assertTrue(schema.validate(self.db, [self.workflow()], plan)['ok'])
        with self.assertRaises(RuntimeError):
            schema.validate(self.db, [self.workflow()], plan[:1])

    def test_referencia_entrante_desconocida_y_tipo_distinto_bloquean(self):
        with self.assertRaises(RuntimeError):
            schema.validate(self.db, [self.workflow('desconocida')])
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute("UPDATE data_table_column SET type='number' WHERE dataTableId='fab_eventos' AND name='evento'")
        with self.assertRaises(RuntimeError):
            schema.validate(self.db)

    def test_nodo_sustituido_no_arrastra_referencia_antigua(self):
        workflow = self.workflow('retirada')
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('INSERT INTO workflow_entity VALUES(?,?)', ('Vigilante', 'v1'))
            db.execute('INSERT INTO workflow_history VALUES(?,?,?)', ('Vigilante', 'v1', json.dumps(workflow['nodes'])))
        self.assertTrue(schema.validate(self.db, [self.workflow()])['ok'])
        with self.assertRaises(RuntimeError):
            schema.validate(self.db)


if __name__ == '__main__':
    unittest.main()
