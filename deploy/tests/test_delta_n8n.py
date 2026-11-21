import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1]))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


delta = load('delta', 'preparar-delta-n8n.py')
apply = load('aplicar_delta', 'aplicar-n8n-total.py')


def node(name, kind, parameters=None):
    return {'id': name, 'name': name, 'type': 'n8n-nodes-base.' + kind, 'parameters': parameters or {}}


def call(target):
    return node('Llamar', 'executeWorkflow', {'workflowId': {'value': target}})


class DeltaTest(unittest.TestCase):
    def setUp(self):
        self.sources = [{'id': wid, 'name': name, 'nodes': [], 'connections': {}, 'active': False,
                         'settings': {}} for wid, name in delta.CANONICOS.items()]
        source = {w['id']: w for w in self.sources}
        source['FabCooperAPI0001']['nodes'] = [node('API', 'webhook'), call('FabOrquestador01')]
        source['FabRetornoClaud1']['nodes'] = [node('Retorno', 'webhook')]
        source['FabOrquestador01']['nodes'] = [call('FabRadar00000001')]
        source['FabRadar00000001']['nodes'] = [node('Reloj', 'scheduleTrigger'), call(delta.NUEVO)]
        source[delta.NUEVO]['nodes'] = [node('Inicio', 'executeWorkflowTrigger'), call('token-existente')]
        source[delta.NUEVO]['settings'] = {'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none',
                                         'saveManualExecutions': False, 'saveExecutionProgress': False}
        self.actual = copy.deepcopy(self.sources[:-1])
        for w in self.actual:
            w['active'] = w['id'] != 'FabRetornoClaud1'
            if w['id'] == 'FabCooperAPI0001':
                w['id'] = 'api-real'
            if w['id'] == 'FabRadar00000001':
                w['nodes'][0]['disabled'] = True
        self.actual.append({'id': 'token-existente', 'name': 'Token interno', 'active': True, 'nodes': []})
        self.metadata = {'tablas': [], 'credenciales': []}

    def prepare(self):
        return delta.preparar(self.actual, self.sources, self.metadata)

    def test_delta_seis_conserva_pausa_y_ordena_solo_cinco_publicaciones(self):
        output, diff = self.prepare()
        self.assertEqual(len(output), 6)
        self.assertTrue(all(not w['active'] for w in output))
        self.assertNotIn('FabRetornoClaud1', diff['plan_publicacion'])
        self.assertEqual(len(diff['plan_publicacion']), 5)
        self.assertLess(diff['plan_publicacion'].index(delta.NUEVO), diff['plan_publicacion'].index('FabRadar00000001'))
        self.assertLess(diff['plan_publicacion'].index('FabOrquestador01'), diff['plan_publicacion'].index('api-real'))
        radar = next(w for w in output if w['id'] == 'FabRadar00000001')
        self.assertTrue(radar['nodes'][0]['disabled'])
        self.assertFalse(self.sources[4]['nodes'][0].get('disabled', False))

    def test_no_crea_otro_objetivo_ni_usa_dependencia_inactiva(self):
        self.actual = [w for w in self.actual if w['id'] != 'FabLlamarClaude1']
        with self.assertRaisesRegex(RuntimeError, 'crear otro'):
            self.prepare()
        self.setUp()
        self.actual[-1]['active'] = False
        with self.assertRaisesRegex(RuntimeError, 'inactiva'):
            self.prepare()

    def test_rechaza_entrada_externa_y_respuestas_guardadas_en_subflujo(self):
        self.sources[-1]['nodes'].append(node('Reloj nuevo', 'scheduleTrigger'))
        with self.assertRaisesRegex(RuntimeError, 'Tipo de nodo|externas'):
            self.prepare()
        self.setUp()
        self.sources[-1]['settings']['saveManualExecutions'] = True
        with self.assertRaisesRegex(RuntimeError, 'respuestas'):
            self.prepare()

    def test_no_reabre_entrada_ni_admite_credencial_faltante(self):
        output, diff = self.prepare()
        next(w for w in output if w['id'] == 'FabRadar00000001')['nodes'][0]['disabled'] = False
        with self.assertRaisesRegex(RuntimeError, 'entrada externa'):
            delta.validar_contrato(output, diff)
        self.sources[-1]['nodes'].append({**node('Consulta', 'httpRequest'), 'credentials': {'httpHeaderAuth': {'id': 'falta', 'name': 'ficticia'}}})
        with self.assertRaisesRegex(RuntimeError, 'credencial ausente'):
            self.prepare()

    def test_aplicador_exige_plan_certificado_exacto_sin_dependencias_historicas(self):
        output, diff = self.prepare()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry, manifest, plan = (root / name for name in ('entrada.json', 'columnas.json', 'publicar.json'))
            for path, value in [(entry, output), (manifest, {}), (plan, diff['plan_publicacion'])]:
                path.write_text(json.dumps(value))
            receipt = {'aplicacion': 'PASS', 'reversion': 'PASS', 'publicacion': 'PASS',
                       'flujos_importados': 6, 'publicados': diff['plan_publicacion'],
                       'entrada_sha256': apply.operar.digest(entry), 'manifiesto_sha256': apply.operar.digest(manifest),
                       'publicar_sha256': apply.operar.digest(plan)}
            self.assertEqual(apply.validar_entradas(entry, diff, receipt, manifest, plan)[1], diff['plan_publicacion'])
            altered = copy.deepcopy(diff)
            altered.pop('plan_publicacion')
            with self.assertRaisesRegex(RuntimeError, 'certificados'):
                apply.validar_entradas(entry, altered, receipt, manifest, plan)
            altered = copy.deepcopy(diff)
            altered['plan_publicacion'].append('FabConfirmar0001')
            with self.assertRaisesRegex(RuntimeError, 'Orden'):
                apply.validar_entradas(entry, altered, receipt, manifest, plan)


if __name__ == '__main__':
    unittest.main()
