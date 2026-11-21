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
        self.ensayo = {'aplicacion': 'PASS', 'reversion': 'PASS', 'flujos_importados': 1,
                       'entrada_sha256': lote.operar.digest(self.entrada),
                       'manifiesto_sha256': lote.operar.digest(self.manifiesto)}

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
        validar = SimpleNamespace(inventory=inventory, column_result=lambda _: {'columnas': []})
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
