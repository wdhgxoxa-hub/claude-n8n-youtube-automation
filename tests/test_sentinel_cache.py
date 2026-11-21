"""Verificación de la caché con fuentes ficticias; no necesita el repo privado."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'cooper/scripts'))
from sentinel_cache import verificar_cache


class CacheSentinel(unittest.TestCase):
    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporal.cleanup)
        self.raiz = Path(self.temporal.name)
        self.cache = self.raiz / 'cache'
        self.fuente = self.cache / 'src/sentinel/contrato.py'
        self.fuente.parent.mkdir(parents=True)
        self.fuente.write_text('# Ficticio\n')
        self.manifiesto = self.raiz / 'origen.json'
        self.origen = {'revision': 'a' * 40, 'archivos': {
            'src/sentinel/contrato.py': hashlib.sha256(self.fuente.read_bytes()).hexdigest()}}
        self.manifiesto.write_text(json.dumps(self.origen))

    def test_hash_publico_y_no_bytecode(self):
        self.assertEqual(verificar_cache(self.cache, self.manifiesto), 'a' * 40)
        self.assertTrue(sys.dont_write_bytecode)

    def test_modificado_y_faltante(self):
        self.fuente.write_text('# Alterado')
        with self.assertRaisesRegex(ValueError, 'Sentinel modificado'):
            verificar_cache(self.cache, self.manifiesto)
        self.fuente.unlink()
        with self.assertRaisesRegex(ValueError, 'Faltan archivos'):
            verificar_cache(self.cache, self.manifiesto)

    def test_archivos_y_directorios_extra(self):
        extra = self.cache / 'origen.json'
        extra.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'inesperado'):
            verificar_cache(self.cache, self.manifiesto)
        extra.unlink()
        (self.fuente.parent / '__pycache__').mkdir()
        with self.assertRaisesRegex(ValueError, 'inesperado'):
            verificar_cache(self.cache, self.manifiesto)

    def test_enlaces_a_fuentes_y_cache(self):
        self.fuente.unlink()
        self.fuente.symlink_to(self.raiz / 'ausente')
        with self.assertRaisesRegex(ValueError, 'enlaces simbólicos'):
            verificar_cache(self.cache, self.manifiesto)
        enlace = self.raiz / 'enlace'
        enlace.symlink_to(self.cache)
        with self.assertRaisesRegex(ValueError, 'enlaces simbólicos'):
            verificar_cache(enlace, self.manifiesto)

    def test_no_acepta_ruta_fuera_del_modulo(self):
        self.origen['archivos'] = {'../../intruso.py': '0' * 64}
        self.manifiesto.write_text(json.dumps(self.origen))
        with self.assertRaisesRegex(ValueError, 'Ruta o huella inválida'):
            verificar_cache(self.cache, self.manifiesto)


if __name__ == '__main__':
    unittest.main()
