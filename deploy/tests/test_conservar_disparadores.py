import copy
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parents[1]))


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


lote = load('conservar', 'preparar-n8n-total.py')
aplicador = load('aplicar_conservar', 'aplicar-n8n-total.py')


def node(name, kind, **extra):
    return {'id': name, 'name': name, 'type': 'n8n-nodes-base.' + kind, 'parameters': {}, **extra}


def flow(wid, nodes, active=True):
    return {'id': wid, 'name': wid, 'nodes': nodes, 'connections': {}, 'settings': {},
            'active': active, 'versionId': 'version-ficticia-' + wid,
            'activeVersionId': 'version-ficticia-' + wid if active else None}


class ConservacionTest(unittest.TestCase):
    def setUp(self):
        self.sources = [
            flow('FabYouTube000001', [node('Retorno', 'webhook')]),
            flow('FabRadar00000001', [node('Reloj', 'scheduleTrigger', disabled=True)]),
            flow('FabConfirmar0001', [node('Reloj', 'scheduleTrigger')]),
            flow('FabAprendizaje01', [node('Reloj', 'scheduleTrigger', disabled=True)]),
            flow('historico', [node('Entrada', 'webhook')], False),
            flow('principal', [node('Llamar', 'executeWorkflow', parameters={
                'workflowId': {'value': 'FabRadar00000001'}})]),
            flow('FabAjustes000001', [node('Ajustes', 'code', parameters={'jsCode': 'defaults'})]),
        ]
        self.current = copy.deepcopy(self.sources)
        by_id = {w['id']: w for w in self.current}
        by_id['FabRadar00000001']['id'] = 'radar-real'
        by_id['FabRadar00000001']['nodes'][0]['disabled'] = False
        by_id['FabConfirmar0001']['nodes'][0]['disabled'] = True
        by_id['FabAprendizaje01']['nodes'][0].pop('disabled')
        by_id['FabAjustes000001']['nodes'][0]['parameters'] = {
            'jsCode': "return [{json:{allowTextoApi:false,baseUrl:'https://previo.ngrok-free.dev'}}];",
            'otro': 'ajuste-ficticio-conservado',
        }
        by_id['FabYouTube000001']['nodes'][0].update({
            'id': 'webhook-anterior', 'webhookId': 'ruta-ficticia',
            'credentials': {'httpHeaderAuth': {'id': 'credencial-ficticia', 'name': 'Prueba'}},
        })
        self.sources.append(flow('nuevo', [node('Reloj nuevo', 'scheduleTrigger'),
                                           node('Interno', 'executeWorkflowTrigger'),
                                           node('Manual', 'manualTrigger')], False))
        self.metadata = {'tablas': [], 'credenciales': [
            {'id': 'credencial-ficticia', 'name': 'Prueba', 'type': 'httpHeaderAuth'}]}

    def prepare(self):
        return lote.preparar(self.current, self.sources, 'https://flujos.cooperestudio.com',
                             self.metadata, True, True)

    def write_database(self, path, workflows):
        with closing(sqlite3.connect(path)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS workflow_entity '
                       '(id TEXT PRIMARY KEY,nodes TEXT,connections TEXT,settings TEXT,'
                       'versionId TEXT,activeVersionId TEXT,active INTEGER)')
            db.execute('DELETE FROM workflow_entity')
            for w in workflows:
                db.execute('INSERT INTO workflow_entity VALUES(?,?,?,?,?,?,?)', (
                    w['id'], json.dumps(w['nodes']), json.dumps(w['connections']),
                    json.dumps(w['settings']), w['versionId'], w['activeVersionId'], int(w['active'])))

    def receipt(self, root, output, diff):
        entry, manifest, plan = (root / name for name in ('entrada.json', 'columnas.json', 'publicar.json'))
        for path, value in [(entry, output), (manifest, {}), (plan, diff['plan_publicacion'])]:
            path.write_text(json.dumps(value))
        schema = aplicador.modulo_ensayo().esquema
        ensayo = {'aplicacion': 'PASS', 'reversion': 'PASS', 'publicacion': 'PASS',
                  'entrada_sha256': aplicador.operar.digest(entry),
                  'manifiesto_sha256': aplicador.operar.digest(manifest),
                  'publicar_sha256': aplicador.operar.digest(plan),
                  'publicados': diff['plan_publicacion'], 'flujos_importados': len(output),
                  'contrato_productivo_sha256': aplicador.operar.digest(schema.CONTRACT),
                  'comparador_esquema_sha256': aplicador.operar.digest(schema.CHECKER),
                  'puerta_esquema_sha256': aplicador.operar.digest(Path(schema.__file__))}
        return entry, manifest, plan, ensayo

    def test_preserva_activaciones_ajustes_credenciales_y_topologia(self):
        originals = copy.deepcopy(self.current)
        output, diff = self.prepare()
        by_id = {w['id']: w for w in output}
        self.assertFalse(by_id['radar-real']['nodes'][0]['disabled'])
        self.assertTrue(by_id['FabConfirmar0001']['nodes'][0]['disabled'])
        self.assertFalse(by_id['FabAprendizaje01']['nodes'][0]['disabled'])
        self.assertTrue(by_id['nuevo']['nodes'][0]['disabled'])
        self.assertNotIn('disabled', by_id['nuevo']['nodes'][1])
        self.assertNotIn('disabled', by_id['nuevo']['nodes'][2])
        self.assertNotIn('nuevo', diff['plan_publicacion'])
        self.assertNotIn('historico', diff['plan_publicacion'])
        self.assertLess(diff['plan_publicacion'].index('radar-real'), diff['plan_publicacion'].index('principal'))
        self.assertEqual(set(diff['plan_publicacion']), {w['id'] for w in self.current if w['active']})
        self.assertTrue(all(w['active'] is False for w in output))
        self.assertEqual(by_id['FabAjustes000001']['nodes'][0]['parameters'], originals[-1]['nodes'][0]['parameters'])
        self.assertEqual(by_id['FabYouTube000001']['nodes'][0]['credentials'], originals[0]['nodes'][0]['credentials'])
        self.assertEqual(by_id['FabYouTube000001']['nodes'][0]['webhookId'], 'ruta-ficticia')
        self.assertEqual(by_id['FabYouTube000001']['nodes'][0]['id'], 'webhook-anterior')
        self.assertEqual(diff['disparadores_dependencias_pausados'], [])
        self.assertEqual(self.current, originals)
        self.assertNotIn('ajuste-ficticio-conservado', json.dumps(diff))

    def test_tipo_nuevo_con_mismo_nombre_se_bloquea_y_duplicados_se_rechazan(self):
        self.sources[0]['nodes'][0]['type'] = 'n8n-nodes-base.formTrigger'
        output, diff = self.prepare()
        self.assertTrue(output[0]['nodes'][0]['disabled'])
        self.assertNotIn('credentials', output[0]['nodes'][0])
        self.assertTrue(any(x['workflow'] == 'FabYouTube000001' for x in diff['disparadores_nuevos_bloqueados']))
        self.current[0]['nodes'].append(copy.deepcopy(self.current[0]['nodes'][0]))
        with self.assertRaisesRegex(ValueError, 'ambiguos'):
            self.prepare()

    def test_no_activa_dependencia_historica_ni_acepta_export_sin_version(self):
        self.current[0]['active'] = False
        with self.assertRaisesRegex(ValueError, 'ya activas'):
            self.prepare()
        self.current[0]['active'] = True
        del self.current[0]['activeVersionId']
        with self.assertRaisesRegex(ValueError, 'versiones'):
            self.prepare()

    def test_credenciales_ausentes_siguen_bloqueadas_incluso_en_disparador(self):
        self.metadata['credenciales'] = []
        self.sources[2]['nodes'].append(node('Voz', 'httpRequest', credentials={
            'httpHeaderAuth': {'id': 'ausente', 'name': 'Voz ficticia'}}))
        output, diff = self.prepare()
        self.assertEqual(output[0]['nodes'][0]['type'], 'n8n-nodes-base.code')
        self.assertTrue(output[0]['nodes'][0]['parameters']['jsCode'].startswith('throw new Error('))
        self.assertEqual(output[2]['nodes'][1]['type'], 'n8n-nodes-base.code')
        self.assertEqual(len(diff['bloqueos_explicitos']), 2)
        lote.validar_conservacion(output, diff)

    def test_contrato_rechaza_disparador_reabierto_aun_con_hash_actualizado(self):
        output, diff = self.prepare()
        nuevo = next(w for w in output if w['id'] == 'nuevo')
        nuevo['nodes'][0]['disabled'] = False
        next(r for r in diff['flujos'] if r['id'] == 'nuevo')['nodos_despues_sha256'] = lote.digest(nuevo['nodes'])
        with self.assertRaisesRegex(ValueError, 'disparador conservado'):
            lote.validar_conservacion(output, diff)
        diff['disparadores_nuevos_bloqueados'][0]['deshabilitado'] = False
        with self.assertRaisesRegex(ValueError, 'nuevo debe permanecer bloqueado'):
            lote.validar_conservacion(output, diff)

    def test_cas_rechaza_cambios_de_contenido_y_version_sin_cambiar_active(self):
        _, diff = self.prepare()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'database.sqlite'
            self.write_database(path, self.current)
            lote.validar_actual(path, diff)
            for field, value in [('nodes', '[{"cambio":"ficticio"}]'), ('connections', '{"nuevo":[]}'),
                                 ('settings', '{"timezone":"America/Lima"}'), ('versionId', 'otra-version'),
                                 ('activeVersionId', 'otra-version-activa')]:
                with self.subTest(field=field):
                    self.write_database(path, self.current)
                    with closing(sqlite3.connect(path)) as db, db:
                        db.execute('UPDATE workflow_entity SET ' + field + '=? WHERE id=?', (value, 'radar-real'))
                    with self.assertRaisesRegex(ValueError, 'contenido o las versiones cambiaron'):
                        lote.validar_actual(path, diff)

    def test_cas_rechaza_id_nueva_ocupada_y_verifica_nodos_despues(self):
        output, diff = self.prepare()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'database.sqlite'
            self.write_database(path, self.current + [self.sources[-1]])
            with self.assertRaisesRegex(ValueError, 'apareció'):
                lote.validar_actual(path, diff)
            self.write_database(path, output)
            lote.validar_actual(path, diff, despues=True)
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('UPDATE workflow_entity SET nodes=? WHERE id=?', ('[]', 'radar-real'))
            with self.assertRaisesRegex(ValueError, 'contenido o las versiones cambiaron'):
                lote.validar_actual(path, diff, despues=True)

    def test_aplicador_exige_plan_ensayado_y_cas_antes_del_snapshot(self):
        output, diff = self.prepare()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry, manifest, plan, ensayo = self.receipt(root, output, diff)
            self.assertEqual(aplicador.validar_entradas(entry, diff, ensayo, manifest, plan)[1], diff['plan_publicacion'])
            with self.assertRaisesRegex(RuntimeError, 'Falta plan'):
                aplicador.validar_entradas(entry, diff, ensayo, manifest)
            data, state = root / 'datos', root / 'estado'
            (data / 'n8n').mkdir(parents=True)
            state.mkdir()
            changed = copy.deepcopy(self.current)
            changed[0]['versionId'] = 'cambio-concurrente'
            self.write_database(data / 'n8n/database.sqlite', changed)
            op = SimpleNamespace(data=data, state=state, snapshot=Mock())
            with self.assertRaisesRegex(ValueError, 'contenido o las versiones cambiaron'):
                aplicador.aplicar(op, entry, diff, ensayo, manifest, state / 'recibo.json', plan)
            op.snapshot.assert_not_called()
            self.assertEqual(list(state.iterdir()), [])

    def test_cambio_entre_preflight_y_snapshot_revierte_sin_importar(self):
        output, diff = self.prepare()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry, manifest, plan, ensayo = self.receipt(root, output, diff)
            data, state, backup = root / 'datos', root / 'estado', root / 'respaldo'
            for folder in (data / 'n8n', state, backup / 'n8n'):
                folder.mkdir(parents=True)
            database = data / 'n8n/database.sqlite'
            self.write_database(database, self.current)
            def snapshot(**_):
                # Un escritor se adelantó al cierre; la copia contiene su última versión.
                with closing(sqlite3.connect(database)) as db, db:
                    db.execute('UPDATE workflow_entity SET versionId=? WHERE id=?',
                               ('version-concurrente', 'radar-real'))
                shutil.copyfile(database, backup / 'n8n/database.sqlite')
                return 'a' * 64
            op = SimpleNamespace(data=data, state=state, snapshot=Mock(side_effect=snapshot),
                                 compose=Mock(), restore=Mock(return_value=backup), ownership=Mock())
            schema = aplicador.modulo_ensayo().esquema
            rehearsal = SimpleNamespace(esquema=schema, inventory=Mock(return_value={'flujos': {}}))
            receipt = state / 'recibo.json'
            with patch.object(aplicador, 'modulo_ensayo', return_value=rehearsal), patch.object(aplicador.os, 'chown'):
                with self.assertRaisesRegex(ValueError, 'contenido o las versiones cambiaron'):
                    aplicador.aplicar(op, entry, diff, ensayo, manifest, receipt, plan)
            self.assertEqual(json.loads(receipt.read_text())['estado'], 'FALLO_REVERTIDO')
            self.assertFalse((state / 'mantenimiento').exists())
            self.assertEqual(database.read_bytes(), (backup / 'n8n/database.sqlite').read_bytes())
            op.restore.assert_called_once()
            self.assertTrue(all('import:workflow' not in call.args and '--aplicar' not in call.args
                                for call in op.compose.call_args_list))


if __name__ == '__main__':
    unittest.main()
