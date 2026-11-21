import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1]))
spec = importlib.util.spec_from_file_location('ajuste_texto', Path(__file__).parents[1] / 'preparar-ajuste-texto.py')
ajuste = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ajuste)


class AjusteTest(unittest.TestCase):
    def setUp(self):
        self.actual = {'id': ajuste.ID, 'name': ajuste.NAME, 'active': True, 'nodes': [
            {'name': 'Ajustes', 'type': 'n8n-nodes-base.code', 'parameters': {
                'jsCode': 'return [{json:{allowTextoApi: true, ejemplo:"FICTICIO_NO_MODIFICAR"}}];'}}],
                       'connections': {}, 'settings': {}, 'staticData': None, 'pinData': None}

    def test_solo_cierra_literal_y_preserva_resto_sin_modificar_origen(self):
        original = copy.deepcopy(self.actual)
        entry, diff = ajuste.preparar([self.actual])
        self.assertEqual(self.actual, original)
        self.assertTrue(diff['allowTextoApi_antes'])
        self.assertFalse(diff['allowTextoApi_despues'])
        expected = copy.deepcopy(original)
        expected['active'] = False
        expected['nodes'][0]['parameters']['jsCode'] = expected['nodes'][0]['parameters']['jsCode'].replace('true', 'false')
        self.assertEqual(entry, [expected])
        self.assertEqual(ajuste.validar_contrato(entry, diff), {ajuste.ID})

    def test_idempotente_y_literal_citado(self):
        self.actual['nodes'][0]['parameters']['jsCode'] = 'return [{json:{"allowTextoApi": false}}];'
        entry, diff = ajuste.preparar([self.actual])
        self.assertFalse(diff['allowTextoApi_antes'])
        self.assertEqual(entry[0]['nodes'], self.actual['nodes'])

    def test_rechaza_ambiguedad_o_expresion(self):
        for code in ['return [{json:{allowTextoApi: Boolean(1)}}];', 'const a={allowTextoApi:true};const b={allowTextoApi:false};']:
            self.actual['nodes'][0]['parameters']['jsCode'] = code
            with self.assertRaises(RuntimeError):
                ajuste.preparar([self.actual])

    def test_rechaza_cambio_ajeno_reapertura_y_otro_flujo(self):
        entry, diff = ajuste.preparar([self.actual])
        for alter in ('campo', 'pago', 'id'):
            mutated = copy.deepcopy(entry)
            if alter == 'campo':
                mutated[0]['settings']['extra'] = True
            elif alter == 'pago':
                mutated[0]['nodes'][0]['parameters']['jsCode'] = mutated[0]['nodes'][0]['parameters']['jsCode'].replace('false', 'true')
            else:
                mutated[0]['id'] = 'ajeno'
            with self.assertRaises(RuntimeError):
                ajuste.validar_contrato(mutated, diff)

    def test_aplicador_exige_publicacion_certificada_de_ajustes_solo(self):
        spec = importlib.util.spec_from_file_location('aplicar_ajuste', Path(__file__).parents[1] / 'aplicar-n8n-total.py')
        apply = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(apply)
        entry, diff = ajuste.preparar([self.actual])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entrada, manifest, plan = [root / name for name in ('entrada.json', 'columnas.json', 'publicar.json')]
            for path, data in [(entrada, entry), (manifest, {}), (plan, [ajuste.ID])]:
                path.write_text(json.dumps(data))
            receipt = {'aplicacion': 'PASS', 'reversion': 'PASS', 'publicacion': 'PASS', 'flujos_importados': 1,
                       'publicados': [ajuste.ID], 'publicar_sha256': ajuste.operar.digest(plan),
                       'entrada_sha256': ajuste.operar.digest(entrada), 'manifiesto_sha256': ajuste.operar.digest(manifest)}
            self.assertEqual(apply.validar_entradas(entrada, diff, receipt, manifest, plan), ({ajuste.ID}, [ajuste.ID]))
            receipt['publicacion'] = 'PENDIENTE'
            with self.assertRaisesRegex(RuntimeError, 'publicación'):
                apply.validar_entradas(entrada, diff, receipt, manifest, plan)

    def test_precondicion_compara_estado_actual_opaco(self):
        _, diff = ajuste.preparar([self.actual])
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'db.sqlite'
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE data_table(id TEXT,name TEXT)')
                db.execute("INSERT INTO data_table VALUES('eventos','fab_eventos')")
                db.execute('CREATE TABLE data_table_user_eventos(id INTEGER,tipo TEXT,detalle TEXT)')
                db.execute('CREATE TABLE workflow_entity(id TEXT,name TEXT,nodes TEXT,connections TEXT,settings TEXT,staticData TEXT,pinData TEXT)')
                values = [self.actual['id'], self.actual['name']] + [json.dumps(self.actual[k]) if self.actual[k] is not None else None for k in ajuste.FIELDS[1:]]
                db.execute('INSERT INTO workflow_entity VALUES(?,?,?,?,?,?,?)', values)
            ajuste.validar_actual(path, diff)
            with sqlite3.connect(path) as db:
                db.execute("INSERT INTO data_table_user_eventos VALUES(1,'ajustes_cooper',?)", ('{"valores":{"allowTextoApi":true}}',))
            with self.assertRaisesRegex(RuntimeError, 'administrativo'):
                ajuste.validar_actual(path, diff)
            with sqlite3.connect(path) as db:
                db.execute('DELETE FROM data_table_user_eventos')
                db.execute('UPDATE workflow_entity SET settings=?', ('{"cambio":true}',))
            with self.assertRaisesRegex(RuntimeError, 'cambió'):
                ajuste.validar_actual(path, diff)


if __name__ == '__main__':
    unittest.main()
