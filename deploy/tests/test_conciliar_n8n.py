import copy
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from test_conservar_disparadores import flow, lote, node


def edge(target):
    return {'main': [[{'node': target, 'type': 'main', 'index': 0}]]}


class ConciliacionTest(unittest.TestCase):
    def setUp(self):
        self.base = [flow(wid, [node('Reloj', 'scheduleTrigger', disabled=True)])
                     for wid in sorted(lote.DEPENDENCIAS_SEGURAS)]
        self.base.append(flow('principal', [node('Entrada', 'webhook'),
                                           node('Uno', 'code', parameters={'jsCode': 'base-uno'}),
                                           node('Dos', 'code', parameters={'jsCode': 'base-dos'})]))
        self.base[-1]['connections'] = {'Entrada': edge('Uno'), 'Uno': edge('Dos')}
        self.base[-1]['settings'] = {'timezone': 'UTC', 'saveDataSuccessExecution': 'none'}
        self.base.append(flow('FabAjustes000001', [node('Ajustes', 'code', parameters={'jsCode': 'defaults'})]))
        self.sources = copy.deepcopy(self.base)
        self.current = copy.deepcopy(self.base)
        self.metadata = {'tablas': [], 'credenciales': []}
        self.current[-1]['nodes'][0]['parameters'] = {'jsCode': 'ajuste-ficticio-vivo', 'extra': 'opaco-ficticio'}

    def prepare(self):
        return lote.preparar(self.current, self.sources, 'https://flujos.cooperestudio.com',
                             self.metadata, True, True, self.base)

    def principal(self, workflows):
        return next(w for w in workflows if w['id'] == 'principal')

    def by_name(self, workflow):
        return {n['name']: n for n in workflow['nodes']}

    def assert_private(self, report):
        encoded = json.dumps(report)
        for value in ('base-uno', 'base-dos', 'codigo-integrado-ficticio', 'codigo-vivo-ficticio',
                      'ajuste-ficticio-vivo', 'opaco-ficticio', 'America/Lima'):
            self.assertNotIn(value, encoded)

    def test_combina_cambios_exclusivos_nodos_nuevos_conexiones_y_ajustes(self):
        source, current = self.principal(self.sources), self.principal(self.current)
        source['nodes'][1]['parameters']['jsCode'] = 'codigo-integrado-ficticio'
        current['nodes'][2]['parameters']['jsCode'] = 'codigo-vivo-ficticio'
        source['nodes'].append(node('Nuevo integrado', 'code'))
        current['nodes'].append(node('Nuevo vivo', 'code'))
        source['connections']['Dos'] = edge('Nuevo integrado')
        current['connections']['Nuevo vivo'] = edge('Entrada')
        source['settings']['executionTimeout'] = 900
        current['settings']['timezone'] = 'America/Lima'
        current['settings']['saveDataSuccessExecution'] = 'all'
        output, diff = self.prepare()
        principal = self.principal(output)
        nodes = self.by_name(principal)
        self.assertEqual(nodes['Uno']['parameters']['jsCode'], 'codigo-integrado-ficticio')
        self.assertEqual(nodes['Dos']['parameters']['jsCode'], 'codigo-vivo-ficticio')
        self.assertIn('Nuevo vivo', nodes)
        self.assertIn('Nuevo integrado', nodes)
        self.assertEqual(principal['connections'], {**source['connections'], 'Nuevo vivo': edge('Entrada')})
        self.assertEqual(principal['settings'], {'executionTimeout': 900, 'timezone': 'America/Lima',
                                                 'saveDataSuccessExecution': 'all'})
        self.assertEqual(output[-1]['nodes'][0], self.current[-1]['nodes'][0])
        self.assert_private(diff)
        lote.validar_conservacion(output, diff)

    def test_normaliza_ids_posiciones_credenciales_y_referencias_sin_perderlas(self):
        for workflows in (self.base, self.sources, self.current):
            self.principal(workflows)['nodes'][1]['credentials'] = {
                'httpHeaderAuth': {'id': 'credencial-versionada', 'name': 'Cuenta ficticia'}}
        source, current = self.principal(self.sources), self.principal(self.current)
        source['nodes'][1]['parameters']['jsCode'] = 'codigo-integrado-ficticio'
        current['nodes'][1].update({'id': 'id-vivo', 'position': [750, 25], 'webhookId': 'webhook-vivo'})
        current['nodes'][1]['credentials']['httpHeaderAuth']['id'] = 'credencial-viva'
        self.metadata['credenciales'] = [{'id': 'credencial-viva', 'name': 'Cuenta ficticia', 'type': 'httpHeaderAuth'}]
        for workflows in (self.base, self.sources, self.current):
            self.principal(workflows)['nodes'].append(node('Invocar', 'executeWorkflow', parameters={
                'workflowId': {'value': 'FabRadar00000001'}}))
        next(w for w in self.current if w['id'] == 'FabRadar00000001')['id'] = 'radar-vivo'
        current['nodes'][-1]['parameters']['workflowId']['value'] = 'radar-vivo'
        output, diff = self.prepare()
        nodes = self.by_name(self.principal(output))
        for field in ('id', 'position', 'webhookId', 'credentials'):
            self.assertEqual(nodes['Uno'][field], current['nodes'][1][field])
        self.assertEqual(nodes['Uno']['parameters']['jsCode'], 'codigo-integrado-ficticio')
        self.assertEqual(nodes['Invocar']['parameters']['workflowId']['value'], 'radar-vivo')
        self.assertLess(diff['plan_publicacion'].index('radar-vivo'), diff['plan_publicacion'].index('principal'))

    def test_nuevos_disparadores_bloqueados_y_existentes_conservados_despues_del_merge(self):
        source, current = self.principal(self.sources), self.principal(self.current)
        source['nodes'][0]['disabled'] = True
        current['nodes'][0]['disabled'] = False
        source['nodes'].append(node('Nuevo', 'webhook'))
        current['nodes'].append(node('Solo vivo', 'webhook', disabled=False))
        output, diff = self.prepare()
        nodes = self.by_name(self.principal(output))
        self.assertFalse(nodes['Entrada']['disabled'])
        self.assertTrue(nodes['Nuevo']['disabled'])
        self.assertFalse(nodes['Solo vivo']['disabled'])
        self.assertEqual(len(diff['disparadores_nuevos_bloqueados']), 1)

    def test_bloquea_conflictos_de_nodo_conexion_y_settings_sin_contenido_en_informe(self):
        source, current = self.principal(self.sources), self.principal(self.current)
        source['nodes'][1]['parameters']['jsCode'] = 'codigo-integrado-ficticio'
        current['nodes'][1]['parameters']['jsCode'] = 'codigo-vivo-ficticio'
        source['connections']['Entrada'] = edge('Dos')
        current['connections']['Entrada'] = edge('Entrada')
        source['settings']['timezone'] = 'Europe/Madrid'
        current['settings']['timezone'] = 'America/Lima'
        before = copy.deepcopy([self.base, self.sources, self.current])
        with self.assertRaises(lote.ConflictoConciliacion) as raised:
            self.prepare()
        rows = raised.exception.comparacion['componentes']
        self.assertEqual({r['componente'] for r in rows if r['decision'] == 'conflicto'},
                         {'nodo', 'conexiones', 'ajuste'})
        self.assert_private(raised.exception.comparacion)
        self.assertEqual([self.base, self.sources, self.current], before)

    def test_eliminaciones_no_reaparecen_y_conflictos_de_eliminacion_bloquean(self):
        source, current = self.principal(self.sources), self.principal(self.current)
        current['nodes'].pop(2)
        current['connections'].pop('Uno')
        output, _ = self.prepare()
        self.assertNotIn('Dos', self.by_name(self.principal(output)))
        self.assertNotIn('Uno', self.principal(output)['connections'])
        source['nodes'][2]['parameters']['jsCode'] = 'codigo-integrado-ficticio'
        with self.assertRaises(lote.ConflictoConciliacion):
            self.prepare()

    def test_borra_solo_nodo_inalterado_y_rechaza_conexion_viva_al_borrado(self):
        source, current = self.principal(self.sources), self.principal(self.current)
        source['nodes'].pop(2)
        source['connections'].pop('Uno')
        output, _ = self.prepare()
        self.assertNotIn('Dos', self.by_name(self.principal(output)))
        current['nodes'].append(node('Extra vivo', 'code'))
        current['connections']['Extra vivo'] = edge('Dos')
        with self.assertRaises(lote.ConflictoConciliacion) as raised:
            self.prepare()
        self.assertTrue(any(r['decision'] == 'conflicto_referencia_a_nodo_ausente'
                            for r in raised.exception.comparacion['componentes']))

    def test_cambio_igual_en_ambos_se_conserva_y_cuenta_distinta_se_revisa(self):
        source, current = self.principal(self.sources), self.principal(self.current)
        for workflow in (source, current):
            workflow['nodes'][1]['parameters']['jsCode'] = 'codigo-integrado-ficticio'
        _, diff = self.prepare()
        self.assertTrue(any(r['nombre'] == 'Uno' and r['decision'] == 'coinciden'
                            for r in diff['conciliacion_tres_vias']['componentes']))
        current['nodes'][1]['credentials'] = {'httpHeaderAuth': {'id': 'otra', 'name': 'Otra cuenta'}}
        with self.assertRaises(lote.ConflictoConciliacion):
            self.prepare()

    def test_guards_vivos_y_ajustes_opacos_no_se_sustituyen_por_defaults(self):
        for workflows in (self.base, self.sources):
            self.principal(workflows)['nodes'].append(node('Voz', 'httpRequest', credentials={
                'httpHeaderAuth': {'id': 'ausente', 'name': 'Voz ficticia'}}))
        self.principal(self.current)['nodes'].append(node('Voz', 'code', parameters={
            'jsCode': 'throw new Error("Falta Voz ficticia");'}))
        self.sources[-1]['nodes'][0]['parameters']['jsCode'] = 'defaults-distintos'
        output, _ = self.prepare()
        self.assertEqual(self.by_name(self.principal(output))['Voz'], self.principal(self.current)['nodes'][-1])
        self.assertEqual(output[-1]['nodes'][0], self.current[-1]['nodes'][0])

    def test_workflow_base_ausente_no_se_recrea_y_alta_nueva_permanece_inactiva(self):
        self.current.pop(-2)
        with self.assertRaises(lote.ConflictoConciliacion) as raised:
            self.prepare()
        self.assertTrue(any(r['decision'] == 'conflicto_workflow_base_ausente'
                            for r in raised.exception.comparacion['componentes']))
        self.base.pop(-2)
        output, diff = self.prepare()
        self.assertFalse(self.principal(output)['active'])
        self.assertNotIn('principal', diff['plan_publicacion'])
        self.assertTrue(self.principal(output)['nodes'][0]['disabled'])

    def test_exige_modo_conservador_y_nombres_no_ambiguos(self):
        with self.assertRaisesRegex(ValueError, 'exige conservar'):
            lote.preparar(self.current, self.sources, 'https://flujos.cooperestudio.com', bases=self.base)
        self.principal(self.current)['nodes'].append(node('Uno', 'httpRequest'))
        with self.assertRaisesRegex(ValueError, 'Identidad ambigua'):
            self.prepare()

    def test_cli_conflicto_solo_escribe_hashes_y_nombres_sin_lote_importable(self):
        self.principal(self.sources)['nodes'][1]['parameters']['jsCode'] = 'codigo-integrado-ficticio'
        self.principal(self.current)['nodes'][1]['parameters']['jsCode'] = 'codigo-vivo-ficticio'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, workflows in [('base', self.base), ('fuente', self.sources)]:
                (root / name).mkdir()
                for workflow in workflows:
                    (root / name / (workflow['id'] + '.json')).write_text(json.dumps(workflow))
            (root / 'actual.json').write_text(json.dumps(self.current))
            (root / 'metadata.json').write_text(json.dumps(self.metadata))
            result = subprocess.run([sys.executable, str(Path(lote.__file__)), '--base', str(root / 'base'),
                                     '--entrada', str(root / 'fuente'), '--export', str(root / 'actual.json'),
                                     '--metadata', str(root / 'metadata.json'), '--salida', str(root / 'salida'),
                                     '--conservar-disparadores', '--publicar-dependencias-seguras'],
                                    text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(result.stderr, '')
            self.assertEqual(json.loads(result.stdout)['estado'], 'BLOQUEADO')
            self.assertFalse((root / 'salida/entrada.json').exists())
            self.assertEqual((root / 'salida/conflictos.json').stat().st_mode & 0o777, 0o600)
            self.assert_private(json.loads((root / 'salida/conflictos.json').read_text()))

    def test_merge_conserva_cas_sobre_contenido_original(self):
        output, diff = self.prepare()
        self.assertEqual(next(r for r in diff['flujos'] if r['id'] == 'principal')['estado_antes_sha256'],
                         lote.digest(lote.estado_cas(self.principal(self.current))))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'database.sqlite'
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('CREATE TABLE workflow_entity (id TEXT PRIMARY KEY, nodes TEXT, connections TEXT, '
                           'settings TEXT, versionId TEXT, activeVersionId TEXT, active INTEGER)')
                for w in self.current:
                    db.execute('INSERT INTO workflow_entity VALUES (?,?,?,?,?,?,?)', (
                        w['id'], json.dumps(w['nodes']), json.dumps(w['connections']), json.dumps(w['settings']),
                        w['versionId'], w['activeVersionId'], int(w['active'])))
            lote.validar_actual(path, diff)
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('UPDATE workflow_entity SET settings=? WHERE id=?', ('{}', 'principal'))
            with self.assertRaisesRegex(ValueError, 'contenido o las versiones cambiaron'):
                lote.validar_actual(path, diff)
        lote.validar_conservacion(output, diff)

    def test_verifica_conexiones_settings_y_nodos_del_resultado_exacto(self):
        output, diff = self.prepare()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'database.sqlite'
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('CREATE TABLE workflow_entity (id TEXT PRIMARY KEY, nodes TEXT, connections TEXT, settings TEXT)')
                for w in output:
                    db.execute('INSERT INTO workflow_entity VALUES (?,?,?,?)', (
                        w['id'], json.dumps(w['nodes']), json.dumps(w['connections']), json.dumps(w['settings'])))
            lote.validar_actual(path, diff, despues=True)
            for field in ('connections', 'settings'):
                with self.subTest(field=field):
                    with closing(sqlite3.connect(path)) as db, db:
                        db.execute('UPDATE workflow_entity SET ' + field + '=? WHERE id=?', ('{}', 'principal'))
                    with self.assertRaisesRegex(ValueError, 'contenido o las versiones cambiaron'):
                        lote.validar_actual(path, diff, despues=True)
                    with closing(sqlite3.connect(path)) as db, db:
                        db.execute('UPDATE workflow_entity SET ' + field + '=? WHERE id=?',
                                   (json.dumps(self.principal(output)[field]), 'principal'))
        changed = copy.deepcopy(output)
        self.principal(changed)['settings']['timezone'] = 'cambio-no-ensayado'
        with self.assertRaisesRegex(ValueError, 'contenido difiere'):
            lote.validar_conservacion(changed, diff)
        diff['conciliacion_tres_vias']['componentes'][0]['decision'] = 'conflicto'
        with self.assertRaisesRegex(ValueError, 'conflictos sin resolver'):
            lote.validar_conservacion(output, diff)


if __name__ == '__main__':
    unittest.main()
