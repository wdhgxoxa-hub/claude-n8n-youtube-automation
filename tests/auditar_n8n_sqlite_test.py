"""Regresión offline del exportador: SQLite ficticio, sin VPS ni credenciales."""
import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'auditoria', ROOT / 'tools/cooper/auditar_n8n_sqlite.py')
AUDITORIA = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDITORIA)


class AuditoriaSQLiteTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cooper-auditoria-ficticia-')
        self.addCleanup(self.temp.cleanup)
        self.database = Path(self.temp.name) / 'ficticia.sqlite'
        self.secrets = [f'valor-ficticio-no-exportable-{index}' for index in range(9)]
        self.nodes = [
            {'name': 'Inicio', 'type': 'n8n-nodes-base.webhook', 'typeVersion': 2,
             'parameters': {'path': self.secrets[0]}},
            {'name': 'Consultar', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2,
             'parameters': {'method': 'GET', 'options': {'timeout': 30000},
                            'url': 'https://example.test/?token=' + self.secrets[1],
                            'jsonBody': self.secrets[2]},
             'credentials': {'httpHeaderAuth': {'id': 'cred-ficticia', 'name': self.secrets[3]}}},
            {'name': 'Código', 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
             'parameters': {'jsCode': 'return ' + json.dumps(self.secrets[4])}},
            {'name': 'Datos', 'type': 'n8n-nodes-base.dataTable', 'typeVersion': 1.1,
             'parameters': {'dataTableId': {'value': 'tabla-ficticia'}, 'operation': 'get'}},
        ]
        self.connections = {
            'Inicio': {'main': [[{'node': 'Consultar', 'type': 'main', 'index': 0}]]},
            'Consultar': {'main': [[{'node': 'Código', 'type': 'main', 'index': 0}]]},
            'Código': {'main': [[{'node': 'Datos', 'type': 'main', 'index': 0}]]},
        }
        with closing(sqlite3.connect(self.database)) as db, db:
            db.executescript('''
                CREATE TABLE workflow_entity (
                    id TEXT, name TEXT, active INTEGER, versionId TEXT, activeVersionId TEXT,
                    updatedAt TEXT, isArchived INTEGER, settings TEXT, nodes TEXT, connections TEXT,
                    staticData TEXT, pinData TEXT);
                CREATE TABLE workflow_history (versionId TEXT, nodes TEXT, connections TEXT);
                CREATE TABLE credentials_entity (id TEXT, type TEXT, data TEXT);
                CREATE TABLE data_table (id TEXT, name TEXT);
                CREATE TABLE execution_entity (
                    id INTEGER, workflowId TEXT, status TEXT, mode TEXT, startedAt TEXT,
                    stoppedAt TEXT, retryOf TEXT, waitTill TEXT);
                CREATE TABLE execution_data (executionId INTEGER, data TEXT, workflowData TEXT);
            ''')
            db.execute('INSERT INTO workflow_entity VALUES (?,?,?,?,?,datetime("now"),?,?,?,?,?,?)', (
                'flujo-ficticio', 'F · Prueba ficticia', 1, 'borrador', 'publicada', 0,
                json.dumps({'executionTimeout': 300, 'errorWorkflow': 'vigilante', 'privado': self.secrets[5]}),
                json.dumps(self.nodes), json.dumps(self.connections), self.secrets[6], self.secrets[7],
            ))
            db.execute('INSERT INTO workflow_history VALUES (?,?,?)',
                       ('publicada', json.dumps(self.nodes), json.dumps(self.connections)))
            db.execute('INSERT INTO credentials_entity VALUES (?,?,?)',
                       ('cred-ficticia', 'httpHeaderAuth', self.secrets[8]))
            db.execute('INSERT INTO data_table VALUES (?,?)', ('tabla-ficticia', 'fab_prueba'))
            db.execute('INSERT INTO credentials_entity VALUES (?,?,?)',
                       ('cred-ajena', 'otroTipoAjeno', self.secrets[8]))
            db.execute('INSERT INTO data_table VALUES (?,?)', ('tabla-ajena', 'datos_ajenos'))
            self.add_execution(db, 1, 'error', '429 ' + self.secrets[2])
            self.add_execution(db, 2, 'waiting', None)

    def add_execution(self, db, identity, status, message):
        db.execute('INSERT INTO execution_entity VALUES (?,?,?,?,datetime("now"),NULL,NULL,NULL)',
                   (identity, 'flujo-ficticio', status, 'trigger'))
        if message is not None:
            flat = [{'resultData': '1'}, {'error': '2', 'lastNodeExecuted': '3'},
                    {'message': '4'}, 'Consultar', message]
            db.execute('INSERT INTO execution_data VALUES (?,?,?)',
                       (identity, json.dumps(flat), json.dumps({'nodes': self.nodes})))

    def test_exporta_solo_estructura_y_clasificacion(self):
        result = AUDITORIA.audit(self.database)
        encoded = json.dumps(result)
        for secret in self.secrets:
            self.assertNotIn(secret, encoded)
        self.assertFalse(result['respaldo_restaurable'])
        workflow = result['workflows'][0]
        self.assertEqual(workflow['id'], 'flujo-ficticio')
        self.assertEqual(workflow['settings']['executionTimeout'], 300)
        self.assertFalse(workflow['borrador_difiere_publicado'])
        request = workflow['draft']['nodes'][1]
        self.assertEqual(request['method'], 'GET')
        self.assertEqual(request['timeout'], 30000)
        self.assertEqual(request['credentials'], [{'id': 'cred-ficticia', 'type': 'httpHeaderAuth'}])
        self.assertEqual(result['fallos_recientes'][0]['causa'], 'rate_limit')
        self.assertEqual(result['fallos_recientes'][0]['nodo'], 'Consultar')
        self.assertEqual(result['ejecuciones_en_vuelo'][0]['id'], 2)
        self.assertEqual(result['referencias_credenciales_existentes'],
                         [{'id': 'cred-ficticia', 'type': 'httpHeaderAuth'}])
        self.assertEqual(result['tablas'], [{'id': 'tabla-ficticia', 'name': 'fab_prueba'}])

    def test_abre_solo_lectura_y_no_selecciona_columnas_privadas(self):
        original_connect = sqlite3.connect
        reads, statements = [], []

        def connection(*args, **kwargs):
            self.assertIn('?mode=ro', args[0])
            self.assertTrue(kwargs.get('uri'))
            db = original_connect(*args, **kwargs)
            db.set_trace_callback(statements.append)

            def authorize(action, table, column, _database, _trigger):
                if action == sqlite3.SQLITE_READ:
                    reads.append((table, column))
                    if (table, column) in [('credentials_entity', 'data'),
                                          ('workflow_entity', 'staticData'), ('workflow_entity', 'pinData')]:
                        return sqlite3.SQLITE_DENY
                return sqlite3.SQLITE_OK

            db.set_authorizer(authorize)
            return db

        before = hashlib.sha256(self.database.read_bytes()).digest()
        with mock.patch.object(AUDITORIA.sqlite3, 'connect', side_effect=connection):
            AUDITORIA.audit(self.database)
        self.assertEqual(hashlib.sha256(self.database.read_bytes()).digest(), before)
        self.assertIn('PRAGMA query_only=ON', statements)
        self.assertTrue(reads)
        self.assertFalse(any('SELECT *' in sql.upper() for sql in statements))

    def test_rechaza_base_ausente_sin_crearla(self):
        missing = Path(self.temp.name) / 'ausente.sqlite'
        with self.assertRaises(sqlite3.OperationalError):
            AUDITORIA.audit(missing)
        self.assertFalse(missing.exists())

    def test_distingue_borrador_y_publicacion_sin_exponer_parametros(self):
        published = json.loads(json.dumps(self.nodes))
        published[1]['parameters']['options']['timeout'] = 10000
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute('UPDATE workflow_history SET nodes=?', (json.dumps(published),))
        result = AUDITORIA.audit(self.database)['workflows'][0]
        self.assertTrue(result['borrador_difiere_publicado'])
        self.assertEqual(result['draft']['nodes'][1]['timeout'], 30000)
        self.assertEqual(result['published']['nodes'][1]['timeout'], 10000)

    def test_no_exporta_datos_de_factory_excluida(self):
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute('UPDATE workflow_entity SET name=?', ('D&S Factory',))
        result = AUDITORIA.audit(self.database)
        self.assertEqual(result['workflows'], [])
        self.assertEqual(result['excluidos'], [{'id': 'flujo-ficticio', 'motivo': 'fuera_de_alcance'}])
        for key in ['fallos_recientes', 'ejecuciones_en_vuelo', 'ejecuciones_7d',
                    'tablas', 'referencias_credenciales_existentes']:
            self.assertEqual(result[key], [], key + ': accedió a recursos fuera del alcance')

    def test_errores_sin_payload_y_nombre_de_nodo_no_validado(self):
        with closing(sqlite3.connect(self.database)) as db, db:
            self.add_execution(db, 3, 'crashed', None)
            self.add_execution(db, 4, 'error', 'ETIMEDOUT ' + self.secrets[0])
            raw = [{'resultData': '1'}, {'error': '2', 'lastNodeExecuted': '3'},
                   {'message': '4'}, self.secrets[1], '401 ' + self.secrets[0]]
            db.execute('UPDATE execution_data SET data=? WHERE executionId=4', (json.dumps(raw),))
        rows = {row['id']: row for row in AUDITORIA.audit(self.database)['fallos_recientes']}
        self.assertEqual(rows[3]['causa'], 'sin_detalle_guardado')
        self.assertEqual(rows[4]['causa'], 'autenticacion')
        self.assertIsNone(rows[4]['nodo'])
        for secret in self.secrets:
            self.assertNotIn(secret, json.dumps(rows))

    def test_error_en_run_data_sin_error_global_ni_last_node(self):
        flat = [{'resultData': '1'}, {'runData': '2'}, {'Consultar': '3'},
                ['4'], {'error': '5'}, {'message': '6'}, 'ETIMEDOUT ' + self.secrets[0]]
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute('UPDATE execution_data SET data=? WHERE executionId=1', (json.dumps(flat),))
        result = AUDITORIA.audit(self.database)['fallos_recientes'][0]
        self.assertEqual(result['causa'], 'timeout')
        self.assertEqual(result['nodo'], 'Consultar')
        self.assertNotIn(self.secrets[0], json.dumps(result))

    def test_grafo_detecta_islas_ciclicas_y_sigue_dependencias_de_ia(self):
        nodes = [
            {'name': 'Inicio', 'type': 'n8n-nodes-base.webhook'},
            {'name': 'Agente', 'type': '@n8n/n8n-nodes-langchain.agent'},
            {'name': 'Modelo', 'type': '@n8n/n8n-nodes-langchain.lmChatOpenAi'},
            {'name': 'Isla A', 'type': 'n8n-nodes-base.code'},
            {'name': 'Isla B', 'type': 'n8n-nodes-base.code'},
            {'name': 'Nota', 'type': 'n8n-nodes-base.stickyNote'},
        ]
        links = {'Inicio': {'main': [[{'node': 'Agente'}]]},
                 'Modelo': {'ai_languageModel': [[{'node': 'Agente'}]]},
                 'Isla A': {'main': [[{'node': 'Isla B'}]]},
                 'Isla B': {'main': [[{'node': 'Isla A'}, {'node': 'Ausente'}]]}}
        result = AUDITORIA.graph_findings(nodes, links)
        self.assertEqual(result['inalcanzables_desde_disparador'], ['Isla A', 'Isla B'])
        self.assertEqual(result['aislados'], [])
        self.assertEqual(result['conexiones_rotas'], [['Isla B', 'Ausente']])


if __name__ == '__main__':
    unittest.main()
