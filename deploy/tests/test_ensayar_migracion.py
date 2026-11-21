import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
spec = importlib.util.spec_from_file_location('ensayo', DEPLOY / 'ensayar-migracion.py')
ensayo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ensayo)


class MigracionTest(unittest.TestCase):
    def test_conserva_datos_originales_y_reversion_con_migracion_aditiva(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'origen' / 'cooper.sqlite'
            source.parent.mkdir()
            with closing(sqlite3.connect(source)) as db, db:
                db.executescript('CREATE TABLE videos(id TEXT); INSERT INTO videos VALUES("ficticio"); CREATE TABLE __drizzle_migrations(id INT); INSERT INTO __drizzle_migrations VALUES(1);')
            def boot(image, path, engine):
                if image.endswith(':nueva'):
                    with closing(sqlite3.connect(path / 'cooper.sqlite')) as db, db:
                        db.executescript('CREATE TABLE lecciones(id TEXT); INSERT INTO __drizzle_migrations VALUES(2);')
            with patch.object(ensayo, 'boot', side_effect=boot):
                result = ensayo.rehearse(source, 'localhost/cooper:nueva', 'localhost/cooper:anterior', root / 'ensayo')
            self.assertEqual(result['migraciones_despues'], 2)
            self.assertEqual(result['reversion'], 'PASS')
            self.assertEqual(ensayo.count(source)['__drizzle_migrations'], 1)
            self.assertEqual(ensayo.count(root / 'ensayo/revertida/cooper.sqlite'), ensayo.count(source))

    def test_no_acepta_perdida_de_filas_como_migracion(self):
        with self.assertRaisesRegex(RuntimeError, 'conteo'):
            ensayo.preserve({'videos': 2, '__drizzle_migrations': 8}, {'videos': 1, '__drizzle_migrations': 11})

    def test_arranque_exige_un_gib_sin_swap_y_contrasta_cgroup_real(self):
        with patch.object(ensayo, 'command', return_value='') as command, patch.object(ensayo.subprocess, 'run', return_value=SimpleNamespace(returncode=0)):
            ensayo.boot('localhost/cooper:prueba', Path('/tmp/fixture-ficticio'), 'podman')
        launch = next(call.args[0] for call in command.call_args_list if call.args[0][1] == 'run')
        self.assertEqual(launch[launch.index('--memory') + 1], '1g')
        self.assertEqual(launch[launch.index('--memory-swap') + 1], '1g')
        checks = [call.args[0][-1] for call in command.call_args_list if call.args[0][1] == 'exec']
        self.assertTrue(any('memory.swap.max' in code and "==='0'" in code for code in checks))
        self.assertTrue(any('memory.max' in code and '1073741824' in code for code in checks))


if __name__ == '__main__':
    unittest.main(verbosity=2)
