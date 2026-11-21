import copy
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

DEPLOY = Path(__file__).parents[1]
sys.path.insert(0, str(DEPLOY))
spec = importlib.util.spec_from_file_location('resolver_api_test', DEPLOY / 'preparar-resolver-api.py')
resolver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolver)


class ResolverTest(unittest.TestCase):
    def setUp(self):
        self.old = {'id': 'apiReal', 'name': resolver.NAME, 'active': True, 'nodes': [
            {'id': 'r', 'name': 'Resolver', 'type': 'n8n-nodes-base.code', 'parameters': {'jsCode': 'return anterior;'}},
            {'id': 'otro', 'name': 'Conservar', 'type': 'n8n-nodes-base.set', 'parameters': {'ejemplo': 'FICTICIO_NO_TOCAR'}}],
            'connections': {}, 'settings': {'saveManualExecutions': False}, 'staticData': None, 'pinData': None}
        self.source = copy.deepcopy(self.old)
        self.source['id'] = resolver.CANONICAL
        self.source['nodes'][0]['parameters']['jsCode'] = 'return agrupado;'

    def test_copia_real_solo_cambia_codigo_resolver(self):
        before = copy.deepcopy(self.old)
        entry, diff = resolver.preparar([self.old], self.source)
        expected = copy.deepcopy(before)
        expected['active'] = False
        expected['nodes'][0]['parameters']['jsCode'] = 'return agrupado;'
        self.assertEqual(entry, [expected])
        self.assertEqual(before, self.old)
        self.assertNotIn('FICTICIO_NO_TOCAR', json.dumps(diff))
        self.assertEqual(resolver.validar_contrato(entry, diff), {'apiReal'})
        self.assertNotEqual(diff['resolver_antes_sha256'], diff['resolver_despues_sha256'])

    def test_rechaza_parametro_nodo_ajeno_conexiones_y_otro_codigo(self):
        entry, diff = resolver.preparar([self.old], self.source)
        for change in ('ajeno', 'conexion', 'codigo', 'id'):
            altered = copy.deepcopy(entry)
            if change == 'ajeno': altered[0]['nodes'][1]['parameters']['ejemplo'] = 'otro'
            if change == 'conexion': altered[0]['connections']['otra'] = []
            if change == 'codigo': altered[0]['nodes'][0]['parameters']['jsCode'] = 'return distinto;'
            if change == 'id': altered[0]['id'] = 'ajeno'
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                resolver.validar_contrato(altered, diff)

    def test_rechaza_api_duplicada_inactiva_fuente_ajena_y_resolver_ambiguo(self):
        with self.assertRaises(RuntimeError): resolver.preparar([self.old, self.old], self.source)
        self.old['active'] = False
        with self.assertRaises(RuntimeError): resolver.preparar([self.old], self.source)
        self.old['active'] = True
        self.source['id'] = 'ajena'
        with self.assertRaises(RuntimeError): resolver.preparar([self.old], self.source)
        self.source['id'] = resolver.CANONICAL
        self.old['nodes'].append(copy.deepcopy(self.old['nodes'][0]))
        with self.assertRaises(RuntimeError): resolver.preparar([self.old], self.source)

    def test_precondicion_detecta_cambio_desde_export_y_verifica_destino(self):
        entry, diff = resolver.preparar([self.old], self.source)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'db.sqlite'
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('CREATE TABLE workflow_entity(id TEXT,name TEXT,nodes TEXT,connections TEXT,settings TEXT,staticData TEXT,pinData TEXT)')
                values = [self.old['id'], self.old['name']] + [json.dumps(self.old[k]) if self.old[k] is not None else None for k in resolver.FIELDS[1:]]
                db.execute('INSERT INTO workflow_entity VALUES(?,?,?,?,?,?,?)', values)
            resolver.validar_actual(path, diff)
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('UPDATE workflow_entity SET nodes=?', (json.dumps(entry[0]['nodes']),))
            resolver.validar_actual(path, diff, despues=True)
            with self.assertRaises(RuntimeError): resolver.validar_actual(path, diff)

    def test_aplicador_exige_publicacion_unica_certificada(self):
        spec = importlib.util.spec_from_file_location('aplicar_resolver', DEPLOY / 'aplicar-n8n-total.py')
        apply = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(apply)
        entry, diff = resolver.preparar([self.old], self.source)
        with tempfile.TemporaryDirectory() as folder:
            paths = [Path(folder) / n for n in ('entrada.json', 'manifest.json', 'plan.json')]
            for p, data in zip(paths, [entry, {}, ['apiReal']]): p.write_text(json.dumps(data))
            a, m, p = paths
            proof = {'aplicacion': 'PASS', 'reversion': 'PASS', 'publicacion': 'PASS', 'flujos_importados': 1,
                     'publicados': ['apiReal'], 'publicar_sha256': resolver.operar.digest(p),
                     'entrada_sha256': resolver.operar.digest(a), 'manifiesto_sha256': resolver.operar.digest(m)}
            self.assertEqual(apply.validar_entradas(a, diff, proof, m, p), ({'apiReal'}, ['apiReal']))
            proof['publicacion'] = 'PENDIENTE'
            with self.assertRaises(RuntimeError): apply.validar_entradas(a, diff, proof, m, p)


if __name__ == '__main__':
    unittest.main()
