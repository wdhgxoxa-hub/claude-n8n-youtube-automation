import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
spec = importlib.util.spec_from_file_location('aplicar_lote', Path(__file__).parents[1] / 'aplicar-n8n-total.py')
lote = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lote)


class AplicarTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.entrada = Path(self.tmp.name) / 'entrada.json'
        self.entrada.write_text(json.dumps([{'id': 'uno', 'active': False}]))
        self.manifiesto = Path(self.tmp.name) / 'columnas.json'
        self.manifiesto.write_text('{}')
        self.diff = {'republicar_originales': ['uno']}
        self.esquema = lote.modulo_ensayo().esquema
        self.ensayo = {'aplicacion': 'PASS', 'reversion': 'PASS', 'flujos_importados': 1,
                       'entrada_sha256': lote.operar.digest(self.entrada),
                       'manifiesto_sha256': lote.operar.digest(self.manifiesto),
                       'contrato_productivo_sha256': lote.operar.digest(self.esquema.CONTRACT),
                       'comparador_esquema_sha256': lote.operar.digest(self.esquema.CHECKER),
                       'puerta_esquema_sha256': lote.operar.digest(Path(self.esquema.__file__))}

    def validar(self):
        return lote.validar_entradas(self.entrada, self.diff, self.ensayo, self.manifiesto)

    def test_solo_lote_identico_ensayado(self):
        self.assertEqual(self.validar(), ({'uno'}, ['uno']))
        self.entrada.write_text('[]')
        with self.assertRaisesRegex(RuntimeError, 'difiere'):
            self.validar()

    def test_no_acepta_rollback_pendiente(self):
        self.ensayo['reversion'] = 'PENDIENTE'
        with self.assertRaisesRegex(RuntimeError, 'reversa'):
            self.validar()

    def test_no_activa_flujos_fuera_del_lote(self):
        self.diff['republicar_originales'].append('ajeno')
        with self.assertRaisesRegex(RuntimeError, 'fuera'):
            self.validar()

    def test_rechaza_entrada_activa_aunque_tenga_hash(self):
        self.entrada.write_text(json.dumps([{'id': 'uno', 'active': True}]))
        self.ensayo['entrada_sha256'] = lote.operar.digest(self.entrada)
        with self.assertRaisesRegex(RuntimeError, 'inactiva'):
            self.validar()

    def test_rechaza_otro_manifiesto(self):
        self.manifiesto.write_text('{"otro":true}')
        with self.assertRaisesRegex(RuntimeError, 'manifiesto'):
            self.validar()

    def test_credencial_ausente_mantiene_el_flujo_inactivo(self):
        self.diff['credenciales_faltantes'] = [{'workflow': 'uno', 'nombre': 'Voz ausente'}]
        self.assertEqual(self.validar(), ({'uno'}, []))

    def test_plan_nuevo_exige_ensayo_de_publicacion_y_orden_exacto(self):
        ids = ['uno', 'FabYouTube000001', 'FabRadar00000001', 'FabConfirmar0001']
        self.entrada.write_text(json.dumps([{'id': x, 'active': False} for x in ids]))
        self.ensayo.update({'entrada_sha256': lote.operar.digest(self.entrada), 'flujos_importados': 4})
        self.diff['plan_publicacion'] = ids
        plan = Path(self.tmp.name) / 'publicar.json'
        plan.write_text(json.dumps(ids))
        with self.assertRaisesRegex(RuntimeError, 'publicación difiere'):
            lote.validar_entradas(self.entrada, self.diff, self.ensayo, self.manifiesto, plan)
        self.ensayo.update({'publicacion': 'PASS', 'publicados': ids, 'publicar_sha256': lote.operar.digest(plan)})
        self.assertEqual(lote.validar_entradas(self.entrada, self.diff, self.ensayo, self.manifiesto, plan)[1], ids)
        self.diff['plan_publicacion'] = list(reversed(ids))
        with self.assertRaisesRegex(RuntimeError, 'Orden'):
            lote.validar_entradas(self.entrada, self.diff, self.ensayo, self.manifiesto, plan)

    def solo_columnas(self):
        self.entrada.write_text('[]')
        self.diff = {'modalidad': 'solo_columnas', 'republicar_originales': []}
        self.ensayo.update({'modalidad': 'solo_columnas', 'flujos_importados': 0,
                           'entrada_sha256': lote.operar.digest(self.entrada), 'plan_columnas': [],
                           'columnas_script_sha256': lote.operar.digest(Path(lote.__file__).with_name('n8n-columnas.cjs'))})

    def test_columnas_sin_workflows_exige_script_y_plan_ensayados(self):
        self.solo_columnas()
        self.assertEqual(self.validar(), (set(), []))
        self.ensayo['columnas_script_sha256'] = 'otro'
        with self.assertRaisesRegex(RuntimeError, 'migrador'):
            self.validar()

    def test_solo_columnas_rechaza_publicaciones_o_ensayo_normal(self):
        self.solo_columnas()
        self.diff['republicar_originales'] = ['ajeno']
        with self.assertRaisesRegex(RuntimeError, 'publicaciones'):
            self.validar()
        self.diff['republicar_originales'] = []
        self.ensayo['modalidad'] = 'workflows'
        with self.assertRaisesRegex(RuntimeError, 'solo columnas'):
            self.validar()

    def test_fallo_tras_columnas_restaurado_sin_importar_ni_publicar(self):
        self.solo_columnas()
        base = Path(self.tmp.name)
        data, state, restore = (base / n for n in ('datos', 'estado', 'restaurado'))
        for folder in (data / 'n8n', state, restore / 'n8n'):
            folder.mkdir(parents=True)
        for folder in (data / 'n8n', restore / 'n8n'):
            (folder / 'database.sqlite').write_bytes(b'original')
        calls = []
        def compose(*args):
            calls.append(args)
            self.assertNotIn('import:workflow', args)
            self.assertNotIn('/lote/publicar.cjs', args)
            if '--aplicar' in args:
                (data / 'n8n/database.sqlite').write_bytes(b'columnas-agregadas')
            return '{"columnas":[]}'
        before = {'flujos': {'ajeno': [True]}, 'columnas': {}}
        op = SimpleNamespace(data=data, state=state, compose=compose, snapshot=lambda **_: 'b' * 64,
                             restore=lambda *_: restore, ownership=lambda: None)
        validar = SimpleNamespace(esquema=SimpleNamespace(CONTRACT=self.esquema.CONTRACT, CHECKER=self.esquema.CHECKER, __file__=self.esquema.__file__, validate=lambda *_: {'ok': True}), inventory=lambda *_: before, column_result=lambda _: {'columnas': []},
                                  validate_import=lambda *_: (_ for _ in ()).throw(RuntimeError('fallo inyectado tras columnas')))
        recibo = state / 'resultado.json'
        with patch.object(lote, 'modulo_ensayo', return_value=validar), patch.object(lote.os, 'chown'):
            with self.assertRaisesRegex(RuntimeError, 'fallo inyectado'):
                lote.aplicar(op, self.entrada, self.diff, self.ensayo, self.manifiesto, recibo)
        self.assertEqual((data / 'n8n/database.sqlite').read_bytes(), b'original')
        self.assertFalse((state / 'mantenimiento').exists())
        self.assertEqual(json.loads(recibo.read_text())['reversa'], 'PASS')
        self.assertTrue(any('--aplicar' in args for args in calls))

    def test_fallo_despues_de_importar_restaura_datos_y_reabre_stack(self):
        base = Path(self.tmp.name)
        data, state, restore = (base / n for n in ('datos', 'estado', 'restaurado'))
        for folder in (data / 'n8n', state, restore / 'n8n'):
            folder.mkdir(parents=True)
        (data / 'n8n/database.sqlite').write_bytes(b'original')
        (restore / 'n8n/database.sqlite').write_bytes(b'original')
        llamadas = []

        def compose(*args):
            llamadas.append(args)
            if 'import:workflow' in args:
                (data / 'n8n/database.sqlite').write_bytes(b'lote-aplicado')
            return '{}'

        before = {'flujos': {'uno': [True]}, 'columnas': {}}
        inventarios = iter([before, RuntimeError('fallo inyectado después del import')])

        def inventory(*_):
            value = next(inventarios)
            if isinstance(value, Exception):
                raise value
            return value

        op = SimpleNamespace(data=data, state=state, compose=compose,
                             snapshot=lambda **_: 'a' * 64,
                             restore=lambda *_: restore, ownership=lambda: None)
        validar = SimpleNamespace(esquema=SimpleNamespace(CONTRACT=self.esquema.CONTRACT, CHECKER=self.esquema.CHECKER, __file__=self.esquema.__file__, validate=lambda *_: {'ok': True}), inventory=inventory, column_result=lambda _: {'columnas': []})
        recibo = state / 'resultado.json'
        with patch.object(lote, 'modulo_ensayo', return_value=validar), patch.object(lote.os, 'chown'):
            with self.assertRaisesRegex(RuntimeError, 'fallo inyectado'):
                lote.aplicar(op, self.entrada, self.diff, self.ensayo, self.manifiesto, recibo)
        self.assertEqual((data / 'n8n/database.sqlite').read_bytes(), b'original')
        self.assertFalse((state / 'mantenimiento').exists())
        self.assertEqual(json.loads(recibo.read_text())['estado'], 'FALLO_REVERTIDO')
        self.assertEqual(llamadas[-2:], [('stop',), ('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')])
        archivado = list(state.glob('n8n-fallido-*'))
        self.assertEqual(len(archivado), 1)
        self.assertEqual((archivado[0] / 'database.sqlite').read_bytes(), b'lote-aplicado')


if __name__ == '__main__':
    unittest.main()
