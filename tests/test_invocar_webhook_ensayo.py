import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/cooper'))
spec = importlib.util.spec_from_file_location('invocar', ROOT / 'tools/cooper/invocar_webhook_ensayo.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Invocacion(unittest.TestCase):
    def workflow(self):
        return {'id': 'CoopEnsayoApr01', 'nodes': [{
            'type': 'n8n-nodes-base.webhook', 'parameters': {
                'httpMethod': 'POST', 'responseMode': 'onReceived',
                'path': 'cooper/v1/ensayo-a0e73852-6073-40a3-8576-aa5abd7569bc',
            },
        }]}

    def test_bloqueo_antes_de_cualquier_llamada_interna(self):
        for public_status, metadata in [(401, [[], []]), (404, [[], [(1, 'success')]])]:
            with self.subTest(status=public_status):
                with patch.object(m, 'metadata', side_effect=metadata), \
                     patch.object(m, 'publico', return_value=public_status), \
                     patch.object(m, 'interno') as internal:
                    with self.assertRaises(ValueError):
                        m.invocar(self.workflow())
                    internal.assert_not_called()

    def test_no_confunde_http200_con_ejecucion_correcta(self):
        for status in ['success', 'error', 'canceled', 'crashed']:
            with self.subTest(status=status):
                with patch.object(m, 'metadata', side_effect=[[], [], [(8, status)]]), \
                     patch.object(m, 'publico', return_value=404), \
                     patch.object(m, 'interno', return_value=200):
                    result = m.invocar(self.workflow())
                    self.assertEqual(result['ok'], status == 'success')

    def test_timeout_no_acredita_exito(self):
        with patch.object(m, 'metadata', return_value=[]), \
             patch.object(m, 'publico', return_value=404), \
             patch.object(m, 'interno', return_value=200), patch.object(m.time, 'sleep'):
            self.assertFalse(m.invocar(self.workflow())['ok'])

    def test_rechaza_ids_y_rutas_ajenos(self):
        workflow = self.workflow()
        workflow['id'] = 'FabPublicacion01'
        with self.assertRaises(ValueError):
            m.entrada(workflow)
        workflow = self.workflow()
        workflow['nodes'][0]['parameters']['path'] = 'cooper/v1'
        with self.assertRaises(ValueError):
            m.entrada(workflow)


if __name__ == '__main__':
    unittest.main()
