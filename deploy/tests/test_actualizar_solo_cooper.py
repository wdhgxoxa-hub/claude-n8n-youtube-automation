import contextlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('solo', Path(__file__).parents[1] / 'actualizar-solo-cooper.py')
solo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(solo)


class ScopedDeployment(unittest.TestCase):
    def test_start_never_operates_factory_or_proxy(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(solo, 'STATE', Path(tmp)), patch.object(solo, 'compose') as compose:
            solo.start('image')
            self.assertEqual(compose.call_args.args[-1], 'cooper')
            self.assertIn('--no-deps', compose.call_args.args)
            (Path(tmp) / 'chat-tunel.enabled').touch()
            solo.start('image')
            self.assertEqual(compose.call_args.args[-2:], ('cooper', 'chat-cooper'))
            self.assertNotIn('n8n', compose.call_args.args)
            self.assertNotIn('runner', compose.call_args.args)
            self.assertNotIn('caddy', compose.call_args.args)

    def test_stop_only_cooper_and_its_relay(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(solo, 'STATE', Path(tmp)), patch.object(solo, 'run') as run:
            (Path(tmp) / 'chat-tunel.enabled').touch()
            solo.stop()
            self.assertEqual([x.args[0][-1] for x in run.call_args_list], ['cooper-chat-cooper-1', 'cooper-cooper-1'])

    def scenario(self, fail=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); state = root / 'state'; state.mkdir()
            data = root / 'data'; data.mkdir()
            config = root / 'deploy'; config.mkdir()
            (config / 'Caddyfile').write_text('cooper.test { respond ok }')
            with contextlib.closing(sqlite3.connect(data / 'cooper.sqlite')) as db, db:
                db.execute('CREATE TABLE __drizzle_migrations(id INTEGER)')
                db.execute('INSERT INTO __drizzle_migrations VALUES(1)')
                db.execute('CREATE TABLE videos(id INTEGER)')
                db.execute('INSERT INTO videos VALUES(42)')
            baseline = solo.counts(data / 'cooper.sqlite')
            (state / 'release.json').write_text(json.dumps({'image': 'old'}))
            new = 'localhost/cooper:' + 'a' * 40; expected = 'sha256:' + 'b' * 64

            def inspect(name, fmt):
                if fmt == '{{.State.Health.Status}}': return 'healthy'
                if name != 'cooper-cooper-1': return 'unchanged'
                return {'{{.Config.Image}}': 'old', '{{.Image}}': expected, '{{.State.Health.Status}}': 'healthy'}[fmt]

            def boot(image, directory):
                if image == new:
                    with contextlib.closing(sqlite3.connect(directory / 'cooper.sqlite')) as db, db:
                        db.execute('INSERT INTO __drizzle_migrations VALUES(2)')
                        db.execute('CREATE TABLE nueva(id INTEGER)')

            def start(image):
                if image == new:
                    boot(image, data)
                    if fail: raise RuntimeError('Simular fallo de salud')

            class Response:
                status = 200
                def __enter__(self): return self
                def __exit__(self, *args): pass
                def read(self): return b'{"ok":true}'

            with patch.object(solo, 'STATE', state), patch.object(solo, 'DATA', data), patch.object(solo, 'DEPLOY', config), patch.object(solo.os, 'geteuid', return_value=0), patch.object(solo.os, 'chown'), patch.object(solo, 'run'), patch.object(solo, 'inspect', side_effect=inspect), patch.object(solo, 'stop'), patch.object(solo, 'start', side_effect=start) as starts, patch.object(solo, 'boot_isolated', side_effect=boot), patch.object(solo.urllib.request, 'urlopen', return_value=Response()):
                if fail:
                    with self.assertRaises(RuntimeError): solo.deploy(new, expected)
                    self.assertEqual(solo.counts(data / 'cooper.sqlite'), baseline)
                    self.assertEqual(starts.call_args.args, ('old',))
                    self.assertEqual(json.loads((state / 'release.json').read_text()), {'image': 'old'})
                    archived = list(state.glob('solo-cooper-*/datos-del-intento/cooper.sqlite'))
                    self.assertEqual(len(archived), 1)
                    self.assertEqual(solo.counts(archived[0])['__drizzle_migrations'], 2)
                else:
                    result = solo.deploy(new, expected)
                    self.assertEqual(result['reversa_aislada'], 'PASS')
                    self.assertEqual(result['migraciones_despues'], 2)
                    self.assertTrue(result['servicios_ajenos_sin_cambios'])
                    self.assertEqual(json.loads((state / 'release.json').read_text()), {'image': new})
                self.assertFalse((state / 'mantenimiento').exists())

    def test_upgrade_and_rollback_rehearsal(self):
        self.scenario()

    def test_failed_upgrade_restores_data_and_preserves_attempt(self):
        self.scenario(fail=True)

    def test_rejects_other_image_before_stopping(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(solo, 'STATE', Path(tmp)), patch.object(solo.os, 'geteuid', return_value=0), patch.object(solo, 'inspect', return_value='different'), patch.object(solo, 'stop') as stop:
            with self.assertRaises(RuntimeError):
                solo.deploy('localhost/cooper:' + 'a' * 40, 'sha256:' + 'b' * 64)
            stop.assert_not_called()

    def test_rejects_incomplete_maintenance_recovery(self):
        def inspect(name, fmt):
            return 'sha256:' + 'b' * 64 if fmt == '{{.Image}}' else 'unhealthy'
        with tempfile.TemporaryDirectory() as tmp, patch.object(solo, 'STATE', Path(tmp)), patch.object(solo.os, 'geteuid', return_value=0), patch.object(solo, 'inspect', side_effect=inspect), patch.object(solo, 'run'), patch.object(solo, 'stop') as stop:
            with self.assertRaisesRegex(RuntimeError, 'todavía no está saludable'):
                solo.deploy('localhost/cooper:' + 'a' * 40, 'sha256:' + 'b' * 64)
            stop.assert_not_called()


if __name__ == '__main__':
    unittest.main()
