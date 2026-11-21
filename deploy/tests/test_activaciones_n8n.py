import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1]))
spec = importlib.util.spec_from_file_location('activaciones', Path(__file__).parents[1] / 'preparar-activaciones-n8n.py')
act = importlib.util.module_from_spec(spec)
spec.loader.exec_module(act)


class ActivacionesTest(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).parents[2]
        self.sources = [json.loads(p.read_text()) for p in sorted((root / 'workflows/v2').glob('*.json'))]
        self.actual = copy.deepcopy(self.sources)
        tables, credentials = set(), {}
        for flow in self.actual:
            flow['active'] = flow['id'] not in ('FabErrores000001', 'FabAprendizaje01')
            if flow['id'] == 'FabCooperProgr01':
                flow['id'] = 'progreso-real'
            for node in flow['nodes']:
                if flow['id'] == 'FabConfirmar0001' and node['type'].endswith('.scheduleTrigger'):
                    node['disabled'] = True
                ref = node.get('parameters', {}).get('dataTableId')
                if isinstance(ref, dict) and isinstance(ref.get('value'), str):
                    tables.add(ref['value'])
                for kind, ref in node.get('credentials', {}).items():
                    credentials[(kind, ref['id'])] = {'id': ref['id'], 'name': ref['name'], 'type': kind}
        self.metadata = {'tablas': list(tables), 'credenciales': list(credentials.values())}

    def prepare(self):
        return act.preparar(self.actual, self.sources, self.metadata)

    def test_solo_tres_objetivos_con_una_pausa_horaria_reabierta_y_referencia_real(self):
        before = copy.deepcopy(self.actual)
        output, diff = self.prepare()
        self.assertEqual(self.actual, before)
        self.assertEqual(set(w['id'] for w in output), set(act.OBJETIVOS))
        self.assertTrue(all(not w['active'] for w in output))
        self.assertEqual(diff['plan_publicacion'], act.ORDEN)
        self.assertEqual(diff['republicar_originales'], ['FabConfirmar0001'])
        self.assertEqual(diff['activar_previamente_pausados'], ['FabErrores000001', 'FabAprendizaje01'])
        self.assertEqual(diff['disparadores_habilitados'], [{'workflow': 'FabConfirmar0001', 'nodo': 'Cada hora'}])
        self.assertEqual(diff['dependencias']['FabCooperProgr01'], 'progreso-real')

    def test_rechaza_escritura_proveedor_nueva_entrada_y_retencion(self):
        output, diff = self.prepare()
        for change in ('post', 'webhook', 'horario', 'datos'):
            altered = copy.deepcopy(output)
            flow = next(w for w in altered if w['id'] == 'FabConfirmar0001')
            if change == 'post':
                next(n for n in flow['nodes'] if n['type'].endswith('.httpRequest'))['parameters']['method'] = 'POST'
            elif change == 'webhook':
                flow['nodes'].append({'name': 'Externo', 'type': 'n8n-nodes-base.webhook'})
            elif change == 'horario':
                next(n for n in flow['nodes'] if n['type'].endswith('.scheduleTrigger'))['parameters']['rule']['interval'][0]['hoursInterval'] = 2
            else:
                flow['settings']['saveManualExecutions'] = True
            with self.assertRaises(RuntimeError):
                act.validar_contrato(altered, diff)

    def test_rechaza_credencial_ausente_dependencia_inactiva_y_otro_objetivo(self):
        self.metadata['credenciales'] = []
        with self.assertRaisesRegex(RuntimeError, 'credenciales'):
            self.prepare()
        self.setUp()
        next(w for w in self.actual if w['id'] == 'FabYouTube000001')['active'] = False
        with self.assertRaisesRegex(RuntimeError, 'Dependencia'):
            self.prepare()
        self.setUp()
        output, diff = self.prepare()
        output.append({'id': 'FabRutina0000001'})
        with self.assertRaisesRegex(RuntimeError, 'tres'):
            act.validar_contrato(output, diff)

    def test_exige_permiso_de_pago_cerrado_y_sin_override(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'db.sqlite'
            nodes = [{'name': 'Ajustes', 'type': 'n8n-nodes-base.code', 'parameters': {'jsCode': 'return [{json:{allowTextoApi:false}}];'}}]
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE workflow_entity(id TEXT,nodes TEXT)')
                db.execute('INSERT INTO workflow_entity VALUES(?,?)', ('FabAjustes000001', json.dumps(nodes)))
                db.execute('CREATE TABLE data_table(id TEXT,name TEXT)')
                db.execute("INSERT INTO data_table VALUES('eventos','fab_eventos')")
                db.execute('CREATE TABLE data_table_user_eventos(tipo TEXT,detalle TEXT)')
            act.permiso_cerrado(path)
            with sqlite3.connect(path) as db:
                db.execute("INSERT INTO data_table_user_eventos VALUES('ajustes_cooper',?)", ('{"valores":{"allowTextoApi":true}}',))
            with self.assertRaisesRegex(RuntimeError, 'override'):
                act.permiso_cerrado(path)
            with sqlite3.connect(path) as db:
                db.execute('DELETE FROM data_table_user_eventos')
                db.execute('UPDATE workflow_entity SET nodes=?', (json.dumps(nodes).replace('false', 'true'),))
            with self.assertRaisesRegex(RuntimeError, 'allowTextoApi'):
                act.permiso_cerrado(path)

    def test_aplicador_exige_certificar_publicacion_tres_y_sus_pausas(self):
        apply = act.module('aplicar-n8n-total')
        output, diff = self.prepare()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entry, manifest, plan = [root / name for name in ('entrada.json', 'columnas.json', 'publicar.json')]
            for path, data in [(entry, output), (manifest, {}), (plan, act.ORDEN)]:
                path.write_text(json.dumps(data))
            receipt = {'aplicacion': 'PASS', 'reversion': 'PASS', 'publicacion': 'PASS', 'flujos_importados': 3,
                       'publicados': act.ORDEN, 'publicar_sha256': act.operar.digest(plan),
                       'entrada_sha256': act.operar.digest(entry), 'manifiesto_sha256': act.operar.digest(manifest)}
            self.assertEqual(apply.validar_entradas(entry, diff, receipt, manifest, plan)[1], act.ORDEN)
            receipt['publicacion'] = 'PENDIENTE'
            with self.assertRaisesRegex(RuntimeError, 'publicación'):
                apply.validar_entradas(entry, diff, receipt, manifest, plan)


if __name__ == '__main__':
    unittest.main()
