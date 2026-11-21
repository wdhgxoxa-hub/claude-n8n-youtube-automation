import copy
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('horario_radar_test', DEPLOY / 'horario-radar.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.configure(DEPLOY)


class HorarioRadar(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name) / 'base.sqlite'
        self.flow = {'id': mod.ID, 'name': mod.NAME, 'active': True, 'versionId': 'v1', 'activeVersionId': 'v1',
                     'connections': {}, 'settings': {}, 'staticData': None, 'pinData': {},
                     'nodes': [{'id': 'reloj', 'name': mod.NODE, 'type': 'n8n-nodes-base.scheduleTrigger',
                                'disabled': True, 'parameters': {'rule': {'interval': [{'field': 'days',
                                 'triggerAtHour': 7, 'triggerAtMinute': 40}]}}},
                               {'id': 'leer', 'name': 'Leer', 'type': 'n8n-nodes-base.httpRequest',
                                'parameters': {}, 'credentials': {'httpHeaderAuth': {'id': 'ficticia'}}}]}
        self.replace()
        self.guard = patch.object(mod.activations, 'permiso_cerrado')
        self.guard.start()
        self.addCleanup(self.guard.stop)

    def replace(self):
        with closing(sqlite3.connect(self.base)) as db, db:
            db.executescript('DROP TABLE IF EXISTS workflow_entity; DROP TABLE IF EXISTS workflow_history;'
                             'DROP TABLE IF EXISTS credentials_entity; DROP TABLE IF EXISTS data_table;'
                             'CREATE TABLE workflow_entity(id TEXT,name TEXT,nodes TEXT,connections TEXT,settings TEXT,'
                             'staticData TEXT,pinData TEXT,active INTEGER,versionId TEXT,activeVersionId TEXT);'
                             'CREATE TABLE workflow_history(workflowId TEXT,versionId TEXT,nodes TEXT,connections TEXT);'
                             'CREATE TABLE credentials_entity(id TEXT,type TEXT); CREATE TABLE data_table(id TEXT);')
            f = self.flow
            db.execute('INSERT INTO workflow_entity VALUES(?,?,?,?,?,?,?,?,?,?)',
                       [f['id'], f['name']] + [json.dumps(f[key]) if f[key] is not None else None for key in mod.FIELDS[1:]] +
                       [int(f['active']), f['versionId'], f['activeVersionId']])
            db.execute('INSERT INTO workflow_history VALUES(?,?,?,?)',
                       [f['id'], f['activeVersionId'], json.dumps(f['nodes']), json.dumps(f['connections'])])
            db.execute('INSERT INTO credentials_entity VALUES(?,?)', ['ficticia', 'httpHeaderAuth'])

    def prepare(self, reverse=None):
        return mod.prepare(self.base, [copy.deepcopy(self.flow)], reverse)

    def test_unico_disabled_sin_modificar_export(self):
        original = copy.deepcopy(self.flow)
        flows, diff = self.prepare()
        self.assertEqual(self.flow, original)
        self.assertFalse(mod.schedule(flows[0])['disabled'])
        restored = copy.deepcopy(flows[0]); restored['active'] = True
        mod.schedule(restored)['disabled'] = True
        self.assertEqual(restored, original)
        self.assertEqual(mod.validate_contract(flows, diff), {mod.ID})
        mod.validate_current(self.base, diff)

    def test_rechaza_todo_cambio_adicional(self):
        flows, diff = self.prepare()
        for kind in ['parametro', 'conexion', 'staticData', 'credencial', 'nombre', 'otro_workflow']:
            a = copy.deepcopy(flows)
            if kind == 'parametro': a[0]['nodes'][1]['parameters']['extra'] = True
            if kind == 'conexion': a[0]['connections']['extra'] = []
            if kind == 'staticData': a[0]['staticData'] = {'extra': 1}
            if kind == 'credencial': a[0]['nodes'][1]['credentials']['httpHeaderAuth']['id'] = 'otra'
            if kind == 'nombre': a[0]['name'] = 'otro'
            if kind == 'otro_workflow': a.append(copy.deepcopy(a[0]))
            with self.subTest(kind=kind), self.assertRaises(RuntimeError): mod.validate_contract(a, diff)

    def test_cas_rechaza_edicion_republicacion_o_desactivacion(self):
        _, diff = self.prepare()
        for key, value in [('versionId', 'v2'), ('activeVersionId', 'v2'), ('active', 0), ('nodes', '[]')]:
            self.replace()
            with closing(sqlite3.connect(self.base)) as db, db:
                db.execute('UPDATE workflow_entity SET ' + key + '=?', [value])
            with self.subTest(key=key), self.assertRaises((ValueError, RuntimeError)): mod.validate_current(self.base, diff)

    def test_horario_y_estado_previos_exactos(self):
        for kind in ['duplicado', 'hora', 'activo']:
            saved = copy.deepcopy(self.flow)
            if kind == 'duplicado': self.flow['nodes'].append(copy.deepcopy(self.flow['nodes'][0]))
            if kind == 'hora': self.flow['nodes'][0]['parameters']['rule']['interval'][0]['triggerAtHour'] = 8
            if kind == 'activo': self.flow['nodes'][0]['disabled'] = False
            self.replace()
            with self.subTest(kind=kind), self.assertRaises(RuntimeError): self.prepare()
            self.flow = saved

    def test_rechaza_credencial_ausente_sin_leer_valores(self):
        with closing(sqlite3.connect(self.base)) as db, db: db.execute('DELETE FROM credentials_entity')
        with self.assertRaisesRegex(RuntimeError, 'credencial'): self.prepare()

    def test_rechaza_publicacion_diferente_del_borrador(self):
        with closing(sqlite3.connect(self.base)) as db, db: db.execute("UPDATE workflow_history SET nodes='[]'")
        with self.assertRaisesRegex(RuntimeError, 'publicación'): self.prepare()

    def test_rechaza_dependencia_dinamica_o_ausente(self):
        for ref in ['={{ $json.id }}', 'ausente']:
            self.flow['nodes'][1].update(type='n8n-nodes-base.executeWorkflow', parameters={'workflowId': ref})
            self.replace()
            with self.subTest(ref=ref), self.assertRaises(RuntimeError): self.prepare()

    def test_permiso_cerrado_obligatorio_antes_de_preparar_y_cas(self):
        _, diff = self.prepare()
        with patch.object(mod.activations, 'permiso_cerrado', side_effect=RuntimeError('cerrar permiso')):
            with self.assertRaises(RuntimeError): self.prepare()
            with self.assertRaises(RuntimeError): mod.validate_current(self.base, diff)

    def test_reversa_exige_recibo_y_preserva_resto(self):
        flows, diff = self.prepare()
        self.flow = flows[0]; self.flow.update(active=True, versionId='v2', activeVersionId='v2')
        self.replace()
        receipt = {'estado': 'PASS', 'politica_disparadores': mod.POLICY, 'disabled_despues': False,
                   'resto_sha256': diff['resto_sha256']}
        reverse, _ = self.prepare(receipt)
        self.assertTrue(mod.schedule(reverse[0])['disabled'])
        receipt['estado'] = 'FALLO'
        with self.assertRaises(RuntimeError): self.prepare(receipt)

    def test_export_incompleto_o_distinto_bloqueado(self):
        with self.assertRaises(RuntimeError): mod.prepare(self.base, [])
        changed = copy.deepcopy(self.flow); changed['settings']['otro'] = True
        with self.assertRaises(RuntimeError): mod.prepare(self.base, [changed])


if __name__ == '__main__':
    unittest.main()
