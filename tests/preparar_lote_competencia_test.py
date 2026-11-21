"""El lote describe Git con altas y bajas, sin acceder a n8n ni secretos."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


RUTA = Path(__file__).resolve().parents[1] / 'tools/cooper/preparar_lote_competencia.py'
SPEC = importlib.util.spec_from_file_location('lote_competencia', RUTA)
LOTE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LOTE)


class PrepararLote(unittest.TestCase):
    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporal.cleanup)
        self.root = Path(self.temporal.name) / 'repo'
        self.root.mkdir()
        self.original = LOTE.ROOT
        self.addCleanup(setattr, LOTE, 'ROOT', self.original)
        LOTE.ROOT = self.root
        self.git('init', '--quiet')
        self.git('config', 'user.name', 'Ensayo ficticio')
        self.git('config', 'user.email', 'ensayo@example.invalid')
        self.flujo('modificado', 'anterior')
        self.flujo('retirado', 'retirar')
        self.base = self.commit()
        self.salida = Path(self.temporal.name) / 'lote'

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], text=True).strip()

    def commit(self):
        self.git('add', '.')
        self.git('commit', '--quiet', '-m', 'Datos ficticios')
        return self.git('rev-parse', 'HEAD')

    def flujo(self, nombre, nodo, active=False):
        ruta = self.root / f'workflows/v2/{nombre}.json'
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(json.dumps({'id': nombre, 'name': nombre, 'active': active,
                                    'nodes': [{'name': nodo}], 'connections': {}}))

    def test_altas_cambios_y_bajas_con_hashes_reales(self):
        self.flujo('nuevo', 'nuevo')
        self.flujo('modificado', 'posterior')
        (self.root / 'workflows/v2/retirado.json').unlink()
        head = self.commit()
        manifest = LOTE.preparar(self.salida, self.base)
        self.assertEqual(manifest['origen'], head)
        self.assertFalse(manifest['respaldo_real'])
        self.assertFalse(manifest['desplegado'])
        flujos = {f['id']: f for f in manifest['flujos']}
        self.assertEqual(flujos['nuevo']['cambio'], 'alta')
        self.assertFalse(flujos['nuevo']['referencia_anterior'])
        self.assertEqual(flujos['modificado']['nodos_modificados'], ['posterior'])
        self.assertEqual(flujos['modificado']['nodos_retirados'], ['anterior'])
        self.assertEqual(flujos['retirado']['cambio'], 'baja')
        self.assertTrue(flujos['retirado']['referencia_anterior'])
        self.assertFalse((self.salida / 'referencia-anterior/workflows/v2/nuevo.json').exists())
        self.assertFalse((self.salida / 'entrada/workflows/v2/retirado.json').exists())
        for archivo in manifest['archivos']:
            contenido = (self.salida / archivo['ruta']).read_bytes()
            self.assertEqual(archivo['sha256'], hashlib.sha256(contenido).hexdigest())
        self.assertIn('new file mode', (self.salida / 'flujos-y-fuentes.patch').read_text())
        with self.assertRaises(FileExistsError):
            LOTE.preparar(self.salida, self.base)

    def test_rechaza_un_flujo_nuevo_activo(self):
        self.flujo('activo', 'inicio', active=True)
        self.commit()
        with self.assertRaisesRegex(ValueError, 'debe estar inactivo'):
            LOTE.preparar(self.salida, self.base)
        self.assertFalse((self.salida / 'manifest.json').exists())


if __name__ == '__main__':
    unittest.main()
