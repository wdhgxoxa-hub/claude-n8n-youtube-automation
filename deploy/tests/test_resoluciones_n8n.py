import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import test_conciliar_n8n as fixtures
from test_conservar_disparadores import lote, node


class ResolucionesTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ConciliacionTest()
        self.fixture.setUp()

    def prepare(self, resolutions=None):
        f = self.fixture
        return lote.preparar(f.current, f.sources, 'https://flujos.cooperestudio.com',
                             f.metadata, True, True, f.base, resolutions)

    def conflict(self, name='Uno'):
        f = self.fixture
        for flows, code in ((f.sources, 'codigo-integrado-ficticio'), (f.current, 'codigo-vivo-ficticio')):
            f.by_name(f.principal(flows))[name]['parameters']['jsCode'] = code

    def resolutions(self, choose='vivo'):
        with self.assertRaises(lote.ConflictoConciliacion) as raised:
            self.prepare()
        return [{key: row[key] for key in ('workflow', 'componente', 'nombre', *lote.CAMPOS_HUELLAS)}
                | {'elegir': choose, 'motivo': 'Resolución técnica revisada con datos ficticios'}
                for row in raised.exception.comparacion['componentes'] if row['decision'] == 'conflicto']

    def test_eleccion_explicita_conserva_triple_huella_auditoria_y_cas(self):
        self.conflict()
        for choice, expected in [('vivo', 'codigo-vivo-ficticio'), ('integrado', 'codigo-integrado-ficticio')]:
            with self.subTest(choice=choice):
                resolutions = self.resolutions(choice)
                output, diff = self.prepare(resolutions)
                f = self.fixture
                self.assertEqual(f.by_name(f.principal(output))['Uno']['parameters']['jsCode'], expected)
                comparison = diff['conciliacion_tres_vias']
                self.assertEqual(comparison['resoluciones'], resolutions)
                self.assertIsNot(comparison['resoluciones'], resolutions)
                row = next(r for r in comparison['componentes'] if r['nombre'] == 'Uno' and r['componente'] == 'nodo')
                self.assertEqual(row['decision'], 'resuelto_' + choice)
                self.assertEqual(row['decision_previa'], 'conflicto')
                self.assertEqual(row['elegido_sha256'], resolutions[0][choice + '_sha256'])
                self.assertEqual(next(r for r in diff['flujos'] if r['id'] == 'principal')['estado_antes_sha256'],
                                 lote.digest(lote.estado_cas(f.principal(f.current))))
                lote.validar_conservacion(output, diff)
                f.assert_private(diff)

    def test_diez_conflictos_guardas_y_http_conservan_control_y_fiabilidad(self):
        f = self.fixture
        for index in range(4):
            original = node('Guarda ' + str(index), 'httpRequest', parameters={'operation': 'anterior'},
                            credentials={'httpHeaderAuth': {'id': 'ausente', 'name': 'Proveedor ficticio'}})
            f.principal(f.base)['nodes'].append(copy.deepcopy(original))
            desired = copy.deepcopy(original)
            desired['parameters']['operation'] = 'integrada'
            f.principal(f.sources)['nodes'].append(desired)
            f.principal(f.current)['nodes'].append(node(original['name'], 'code', parameters={
                'jsCode': 'throw new Error("Proveedor ficticio sin configurar");'}))
        for index in range(6):
            desired = node('HTTP ' + str(index), 'httpRequest', parameters={
                'options': {'timeout': 15000, 'batching': {'batch': {'batchSize': 1, 'batchInterval': 1100}}}})
            current = copy.deepcopy(desired)
            current['id'] = 'id-operativo-' + str(index)
            current['retryOnFail'] = False
            del current['parameters']['options']['batching']
            f.principal(f.sources)['nodes'].append(desired)
            f.principal(f.current)['nodes'].append(current)
        resolutions = self.resolutions()
        self.assertEqual(len(resolutions), 10)
        for row in resolutions:
            row['elegir'] = 'vivo' if row['nombre'].startswith('Guarda') else 'integrado'
        output, diff = self.prepare(resolutions)
        final = f.by_name(f.principal(output))
        for index in range(4):
            guard = final['Guarda ' + str(index)]
            self.assertEqual(guard['type'], 'n8n-nodes-base.code')
            self.assertTrue(guard['parameters']['jsCode'].startswith('throw new Error('))
            self.assertNotIn('credentials', guard)
        for index in range(6):
            http = final['HTTP ' + str(index)]
            self.assertEqual(http['id'], 'id-operativo-' + str(index))
            self.assertNotIn('retryOnFail', http)
            self.assertEqual(http['parameters']['options']['batching']['batch']['batchInterval'], 1100)
        self.assertEqual(len(diff['conciliacion_tres_vias']['resoluciones']), 10)
        lote.validar_conservacion(output, diff)

    def test_rechaza_cada_hash_obsoleto_y_contenido_cambiado_desde_revision(self):
        self.conflict()
        resolutions = self.resolutions()
        for field in lote.CAMPOS_HUELLAS:
            with self.subTest(field=field):
                changed = copy.deepcopy(resolutions)
                changed[0][field] = '0' * 64
                with self.assertRaisesRegex(ValueError, 'obsoleta'):
                    self.prepare(changed)
        self.fixture.by_name(self.fixture.principal(self.fixture.current))['Uno']['parameters']['jsCode'] += '-nuevo'
        with self.assertRaisesRegex(ValueError, 'obsoleta'):
            self.prepare(resolutions)

    def test_rechaza_duplicados_desconocidos_y_resoluciones_sobrantes(self):
        self.conflict()
        resolutions = self.resolutions()
        with self.assertRaisesRegex(ValueError, 'duplicada'):
            self.prepare(resolutions + resolutions)
        for field in ('workflow', 'nombre'):
            with self.subTest(field=field):
                extra = {**resolutions[0], field: 'desconocido'}
                with self.assertRaisesRegex(ValueError, 'sobrantes o desconocidas'):
                    self.prepare(resolutions + [extra])

    def test_no_decide_coincidencias_ni_ajustes_opacos(self):
        _, diff = self.prepare()
        rows = diff['conciliacion_tres_vias']['componentes']
        for name in ('Uno', 'Ajustes'):
            row = next(r for r in rows if r['componente'] == 'nodo' and r['nombre'] == name)
            resolution = {key: row[key] for key in ('workflow', 'componente', 'nombre', *lote.CAMPOS_HUELLAS)}
            resolution.update(elegir='integrado', motivo='No debe sustituir el contrato opaco')
            with self.assertRaisesRegex(ValueError, 'conflicto real'):
                self.prepare([resolution])

    def test_resoluciones_parciales_no_omiten_conflictos_pendientes(self):
        self.conflict('Uno')
        self.conflict('Dos')
        resolutions = self.resolutions()
        with self.assertRaises(lote.ConflictoConciliacion) as raised:
            self.prepare(resolutions[:1])
        rows = raised.exception.comparacion['componentes']
        self.assertEqual(sum(r['decision'] == 'resuelto_vivo' for r in rows), 1)
        self.assertEqual(sum(r['decision'] == 'conflicto' for r in rows), 1)

    def test_rechaza_formato_motivo_eleccion_y_componentes_desconocidos(self):
        self.conflict()
        resolutions = self.resolutions()
        invalid = [{**resolutions[0], 'motivo': ''}, {**resolutions[0], 'elegir': 'ambos'},
                   {**resolutions[0], 'componente': 'workflow'}, {**resolutions[0], 'extra': 'no permitido'},
                   {**resolutions[0], 'base_sha256': 'no es hash'}]
        for row in invalid:
            with self.subTest(row_fields=list(row)):
                with self.assertRaisesRegex(ValueError, 'desconocida o incompleta'):
                    self.prepare([row])
        with self.assertRaisesRegex(ValueError, 'lista explícita'):
            self.prepare({})
        with self.assertRaisesRegex(ValueError, 'base explícita'):
            lote.preparar([], [], 'https://flujos.cooperestudio.com', resoluciones=[])

    def test_auditoria_rechaza_ledger_modificado_o_sin_resolucion(self):
        self.conflict()
        output, original = self.prepare(self.resolutions())
        mutations = [lambda c: c['resoluciones'][0].update(elegir='integrado'),
                     lambda c: c.pop('resoluciones'),
                     lambda c: c['resoluciones'].append(copy.deepcopy(c['resoluciones'][0])),
                     lambda c: next(r for r in c['componentes'] if r['decision'] == 'resuelto_vivo').update(decision_previa='coinciden'),
                     lambda c: next(r for r in c['componentes'] if r['decision'] == 'resuelto_vivo').update(elegido_sha256='0' * 64),
                     lambda c: next(r for r in c['componentes'] if r['decision'] == 'resuelto_vivo').update(motivo='No coincide'),
                     lambda c: next(r for r in c['componentes'] if r['decision'] == 'resuelto_vivo').update(base_sha256='0' * 64)]
        for index, mutation in enumerate(mutations):
            with self.subTest(index=index):
                diff = copy.deepcopy(original)
                comparison = diff['conciliacion_tres_vias']
                mutation(comparison)
                # Recalcular la huella no permite alterar elección, motivo o identidad del ledger.
                if 'resoluciones' in comparison:
                    comparison['resoluciones_sha256'] = lote.digest(comparison['resoluciones'])
                with self.assertRaises(ValueError):
                    lote.validar_conservacion(output, diff)

    def test_auditoria_exige_conflicto_previo_real_y_sin_resoluciones_sobrantes(self):
        self.conflict()
        output, diff = self.prepare(self.resolutions())
        comparison = diff['conciliacion_tres_vias']
        row = next(r for r in comparison['componentes'] if r['decision'] == 'resuelto_vivo')
        comparison['resoluciones'][0]['base_sha256'] = row['vivo_sha256']
        row['base_sha256'] = row['vivo_sha256']
        comparison['resoluciones_sha256'] = lote.digest(comparison['resoluciones'])
        with self.assertRaisesRegex(ValueError, 'Auditoría'):
            lote.validar_conservacion(output, diff)
        output, diff = self.prepare(self.resolutions())
        comparison = diff['conciliacion_tres_vias']
        comparison['resoluciones'].append({**comparison['resoluciones'][0], 'nombre': 'desconocido'})
        comparison['resoluciones_sha256'] = lote.digest(comparison['resoluciones'])
        with self.assertRaisesRegex(ValueError, 'sobrantes'):
            lote.validar_conservacion(output, diff)

    def test_resolucion_de_conexiones_aun_rechaza_nodo_ausente(self):
        f = self.fixture
        f.principal(f.sources)['connections']['Entrada'] = fixtures.edge('Inexistente')
        f.principal(f.current)['connections']['Entrada'] = fixtures.edge('Dos')
        resolutions = self.resolutions('integrado')
        with self.assertRaises(lote.ConflictoConciliacion) as raised:
            self.prepare(resolutions)
        self.assertTrue(any(r['decision'] == 'conflicto_referencia_a_nodo_ausente'
                            for r in raised.exception.comparacion['componentes']))

    def test_cli_resoluciones_no_imprime_contenido_y_entrega_diff_auditable(self):
        self.conflict()
        resolutions = self.resolutions()
        f = self.fixture
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, workflows in [('base', f.base), ('fuente', f.sources)]:
                (root / name).mkdir()
                for workflow in workflows:
                    (root / name / (workflow['id'] + '.json')).write_text(json.dumps(workflow))
            for name, value in [('actual', f.current), ('metadata', f.metadata), ('resoluciones', resolutions)]:
                (root / (name + '.json')).write_text(json.dumps(value))
            result = subprocess.run([sys.executable, str(Path(lote.__file__)), '--base', str(root / 'base'),
                                     '--entrada', str(root / 'fuente'), '--export', str(root / 'actual.json'),
                                     '--metadata', str(root / 'metadata.json'), '--salida', str(root / 'salida'),
                                     '--resoluciones', str(root / 'resoluciones.json'),
                                     '--conservar-disparadores', '--publicar-dependencias-seguras'],
                                    text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stderr, '')
            self.assertNotIn('codigo-vivo-ficticio', result.stdout)
            output = json.loads((root / 'salida/entrada.json').read_text())
            diff = json.loads((root / 'salida/diff.json').read_text())
            self.assertEqual((root / 'salida/diff.json').stat().st_mode & 0o777, 0o600)
            self.assertEqual(diff['conciliacion_tres_vias']['resoluciones'], resolutions)
            lote.validar_conservacion(output, diff)


if __name__ == '__main__':
    unittest.main()
