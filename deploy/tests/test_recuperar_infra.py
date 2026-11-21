from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
SPEC = importlib.util.spec_from_file_location('recuperar_infra_test', DEPLOY / 'recuperar-infra.py')
recovery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recovery)
oplib = recovery.operar


def sha(value):
    return hashlib.sha256(value.encode()).hexdigest()


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target, self.state, self.data = [self.root / name for name in ('deploy', 'state', 'data')]
        for path in (self.target, self.state, self.data):
            path.mkdir()
        self.backup = self.state / 'infra-123/configuracion-anterior'
        self.backup.mkdir(parents=True)
        self.previous, self.new = {}, {}
        for name in recovery.infra.FILES:
            (self.target / name).write_text('PUBLICO NUEVO ' + name)
            self.new[name] = oplib.digest(self.target / name)
            self.previous[name] = None
            if name != 'infra-imagenes.json':
                (self.backup / name).write_text('PUBLICO ANTERIOR ' + name)
                self.previous[name] = oplib.digest(self.backup / name)
        for name in oplib.VOLUMENES:
            (self.data / name).mkdir()
        with closing(sqlite3.connect(self.data / 'cooper/cooper.sqlite')) as db, db:
            db.executescript('CREATE TABLE videos(id INTEGER); INSERT INTO videos VALUES(1);')
        with closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as db, db:
            db.executescript("CREATE TABLE execution_entity(status TEXT); INSERT INTO execution_entity VALUES('waiting'); CREATE TABLE migrations(id INTEGER); INSERT INTO migrations VALUES(1);")
            db.execute('CREATE TABLE workflow_entity(id TEXT,name TEXT,nodes TEXT,connections TEXT,settings TEXT,versionId TEXT,activeVersionId TEXT,active INTEGER,versionCounter INTEGER)')
            db.execute('INSERT INTO workflow_entity VALUES(?,?,?,?,?,?,?,?,?)',
                       ('ficticio', 'Sintético', '[]', '{}', '{}', 'v1', 'v1', 1, 1))
        self.snapshot = self.root / 'snapshot'
        oplib.copy_data(self.data, self.snapshot)
        self.original = oplib.manifest(self.snapshot)
        with closing(sqlite3.connect(self.data / 'cooper/cooper.sqlite')) as db, db:
            db.execute('INSERT INTO videos VALUES(2)')
        (self.data / 'cooper/posterior.txt').write_text('ESCRITURA SINTETICA POSTERIOR')
        self.displaced = oplib.manifest(self.data)
        (self.state / 'chat-tunel.enabled').touch()
        self.cooper = 'localhost/cooper:' + 'a' * 40
        self.references = {self.cooper: sha('cooper')}
        self.services = {}
        self.new_images = {}
        for name in ('cooper', 'n8n', 'runner', 'caddy', 'chat-cooper', 'chat-n8n', 'chat-runner'):
            image = self.cooper if name == 'cooper' or name.startswith('chat-') else name + ':old'
            self.references.setdefault(image, sha(image))
            self.services[name] = {'imagen': image, 'id': self.references[image]}
            if name in ('n8n', 'runner', 'caddy'):
                reference = name + ':new@sha256:' + sha(name + '-manifest')
                self.references[reference] = sha(name + '-new-image')
                self.new_images[name] = {'imagen': reference, 'anterior': image}
        self.receipt = {
            'estado': 'PASS', 'configuracion_anterior': self.previous,
            'configuracion_ensayada': self.new, 'servicios_anteriores': self.services,
            'servicios_nuevos': self.new_images, 'respaldo_configuracion': str(self.backup),
            'snapshot_previo': 'a' * 64, 'codigo_operar_sha256': oplib.digest(Path(oplib.__file__)),
            'codigo_aplicador_sha256': oplib.digest(Path(recovery.infra.__file__)),
            'identidad_cooper': {'runtime_id': self.references[self.cooper], 'config_sha256': sha('config-cooper')},
            'identidades_nuevas': {name: {'runtime_id': self.references[value['imagen']],
                                         'id_local': self.references[value['imagen']],
                                         'referencia': value['imagen'], 'identidad_exacta': True}
                                  for name, value in self.new_images.items()},
        }
        self.rollback_images = self.backup.parent / 'imagenes-reversa.json'
        self.write_overrides()
        self.receipt_path = self.state / 'aplicacion.json'
        self.output = self.state / 'recuperacion.json'
        self.write_receipt()
        oplib.write_json(self.state / 'release.json', {'image': self.cooper})
        oplib.write_json(self.state / 'anterior.json', {'image': 'localhost/cooper:reversion-1', 'snapshot': 'c' * 64})
        self.pointers = {name: oplib.digest(self.state / name) for name in ('release.json', 'anterior.json')}
        self.events = []
        self.override_calls = []
        self.running = True
        self.fail_start = False
        self.fail_restore = False
        self.current_override = {}
        self.reference_override = {}
        self.snapshot_hook = None
        case = self

        class Operator:
            state, data, engine = case.state, case.data, 'docker'
            env, env_file = {}, case.root / 'NO-LEER.env'

            def compose(self, *args, **kwargs):
                case.events.append(args)
                if kwargs:
                    case.override_calls.append((args, kwargs))
                if args[:2] == ('ps', '--all'):
                    return args[-1]
                if args[:2] == ('ps', '-q'):
                    return args[-1]
                if args[0] == 'ps':
                    return 'cooper n8n' if case.running else ''
                if args[0] == 'up':
                    if case.fail_start:
                        raise RuntimeError('Fallo ficticio de salud')
                    case.running = True
                if args[0] == 'stop':
                    case.running = False
                return ''

            def restore(self, snapshot, destination):
                case.assertEqual(snapshot, 'a' * 64)
                if case.fail_restore:
                    raise RuntimeError('Snapshot ficticio no disponible')
                oplib.copy_data(case.snapshot, destination / 'datos')
                return destination / 'datos'

            def snapshot(self, **kwargs):
                case.events.append(('snapshot', kwargs))
                case.assertEqual(kwargs, {'resume': False, 'tag': 'reversion'})
                case.running = False
                if case.snapshot_hook:
                    case.snapshot_hook()
                oplib.copy_data(case.data, case.root / 'snapshot-desplazado')
                return 'b' * 64

            def ownership(self):
                case.events.append(('ownership',))

        self.operator = Operator()
        self.addCleanup(patch.stopall)
        patch.object(oplib, 'DEPLOY', self.target).start()
        patch.object(oplib, 'run', self.command).start()

    def write_receipt(self):
        oplib.write_json(self.receipt_path, self.receipt)
        self.receipt_hash = oplib.digest(self.receipt_path)

    def write_overrides(self):
        oplib.write_json(self.rollback_images, {'services': {name: {'image': value['imagen']} for name, value in self.services.items()}})
        self.receipt['imagenes_reversa_sha256'] = oplib.digest(self.rollback_images)

    def command(self, args, **kwargs):
        if args[1:3] == ['image', 'inspect']:
            if args[-1] == '{{.Architecture}}':
                return 'amd64'
            return self.references[args[3]]
        self.assertEqual(args[1:3], ['inspect', '--format'])
        fmt, name = args[-2:]
        if '.State.Status' in fmt:
            return 'running healthy' if self.running else 'exited'
        is_new = (self.target / 'compose.yaml').read_text().startswith('PUBLICO NUEVO')
        image = self.new_images[name]['imagen'] if is_new and name in self.new_images else self.services[name]['imagen']
        if is_new and name.startswith('chat-'):
            image = self.cooper
        if fmt == '{{.Config.Image}}':
            return self.reference_override.get(name, image) if is_new else image
        self.assertEqual(fmt, '{{.Image}}')
        return self.current_override.get(name, self.references[image]) if is_new else self.references[image]

    def invoke(self):
        return recovery.recover(self.operator, self.receipt_path, self.receipt_hash, self.output)

    def assert_no_cut(self):
        self.assertFalse(any(event[0] in ('snapshot', 'stop', 'up') for event in self.events))
        self.assertFalse((self.state / 'mantenimiento').exists())
        self.assertEqual(oplib.manifest(self.data), self.displaced)

    def test_pass_recupera_con_huellas_y_preserva_escrituras_punteros_y_cooper(self):
        result = self.invoke()
        self.assertEqual(result['estado'], 'PASS')
        self.assertEqual(oplib.manifest(self.data), self.original)
        self.assertEqual(oplib.manifest(Path(result['datos_desplazados'])), self.displaced)
        self.assertEqual(oplib.verify(self.root / 'snapshot-desplazado'), self.displaced)
        self.assertEqual(result['snapshot_desplazado'], 'b' * 64)
        self.assertTrue(result['imagen_cooper_conservada'])
        self.assertEqual(result['servicios_despues'], self.services)
        self.assertEqual(self.pointers, {name: oplib.digest(self.state / name) for name in self.pointers})
        self.assertFalse((self.state / 'mantenimiento').exists())
        self.assertFalse((self.target / 'infra-imagenes.json').exists())
        for name, expected in self.previous.items():
            if expected:
                self.assertEqual(oplib.digest(self.target / name), expected)
        starts = [event for event in self.events if event[0] == 'up']
        self.assertEqual(starts[-1][-1], 'caddy')
        self.assertTrue(all('--no-build' in event and event[event.index('--pull') + 1] == 'never' for event in starts))
        self.assertEqual(oplib.digest(self.receipt_path), self.receipt_hash)

    def test_fallo_antes_de_restaurar_no_para_servicios(self):
        self.fail_restore = True
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.assert_no_cut()
        self.assertFalse(self.output.exists())

    def test_fallo_de_arranque_cierra_y_conserva_ambos_estados(self):
        self.fail_start = True
        with self.assertRaises(RuntimeError):
            self.invoke()
        result = json.loads(self.output.read_text())
        self.assertEqual(result['estado'], 'FALLO_MANTENIMIENTO')
        self.assertTrue((self.state / 'mantenimiento').exists())
        self.assertFalse(self.running)
        self.assertEqual(oplib.manifest(Path(result['datos_desplazados'])), self.displaced)
        self.assertEqual(oplib.manifest(self.data), self.original)
        self.assertEqual(self.pointers, {name: oplib.digest(self.state / name) for name in self.pointers})

    def test_rechaza_recibo_modificado_sin_parar(self):
        self.receipt_path.write_text(self.receipt_path.read_text() + '\n')
        with self.assertRaisesRegex(RuntimeError, 'huella'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_configuracion_actual_distinta_sin_parar(self):
        (self.target / 'Caddyfile').write_text('OTRO DESPLIEGUE')
        with self.assertRaisesRegex(RuntimeError, 'configuración activa'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_respaldo_alterado_sin_parar(self):
        (self.backup / 'compose.yaml').write_text('CORRUPTO')
        with self.assertRaisesRegex(RuntimeError, 'Respaldo público'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_codigo_distinto_sin_parar(self):
        self.receipt['codigo_operar_sha256'] = '0' * 64
        self.write_receipt()
        with self.assertRaisesRegex(RuntimeError, 'Operator difiere'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_imagen_ajena_sin_parar(self):
        self.current_override['n8n'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'servicio actual'):
            self.invoke()
        self.assert_no_cut()

    def test_acepta_nombre_normalizado_por_podman_solo_con_id_del_digest_exacto(self):
        self.reference_override = {name: value['imagen'].split('@', 1)[0] for name, value in self.new_images.items()}
        # No existe esa referencia sin digest en el doble del motor: el helper
        # debe seguir inspeccionando el digest ensayado, no una etiqueta móvil.
        self.assertTrue(all(value not in self.references for value in self.reference_override.values()))
        self.assertEqual(self.invoke()['estado'], 'PASS')
        self.assertEqual(oplib.manifest(self.data), self.original)

    def test_nombre_normalizado_no_acepta_otro_id(self):
        self.reference_override['n8n'] = self.new_images['n8n']['imagen'].split('@', 1)[0]
        self.current_override['n8n'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'servicio actual'):
            self.invoke()
        self.assert_no_cut()

    def test_acepta_otro_alias_solo_si_id_del_digest_coincide_y_conserva_observacion(self):
        self.reference_override['n8n'] = 'n8n:otra-etiqueta'
        result = self.invoke()
        self.assertEqual(result['estado'], 'PASS')
        self.assertEqual(result['servicios_antes']['n8n']['imagen'], 'n8n:otra-etiqueta')
        self.assertEqual(result['servicios_antes']['n8n']['id'], self.references[self.new_images['n8n']['imagen']])

    def test_rechaza_imagen_anterior_movida_sin_parar(self):
        self.references['n8n:old'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'referencia anterior'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_ejecucion_activa_y_conserva_waiting(self):
        with closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as db, db:
            db.execute("INSERT INTO execution_entity VALUES('running')")
        self.displaced = oplib.manifest(self.data)
        with self.assertRaisesRegex(RuntimeError, 'ejecuciones n8n'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_enlace_al_recibo_sin_parar(self):
        link = self.state / 'recibo-enlace.json'
        link.symlink_to(self.receipt_path)
        with self.assertRaisesRegex(RuntimeError, 'enlaces operativos'):
            recovery.recover(self.operator, link, self.receipt_hash, self.output)
        self.assert_no_cut()

    def test_rechaza_recibo_no_pass_sin_parar(self):
        self.receipt['estado'] = 'FALLO_REVERTIDO'
        self.write_receipt()
        with self.assertRaisesRegex(RuntimeError, 'terminada PASS'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_puntero_generico_sin_inventar_reversas(self):
        # Rojo del contrato histórico: el scoped guarda anterior.json dentro de
        # su propio directorio; la receta genérica busca otro archivo global.
        scoped = self.state / 'solo-cooper-20261121T000000Z'
        scoped.mkdir()
        oplib.write_json(scoped / 'anterior.json', {'image': 'old', 'id': sha('old')})
        (self.state / 'anterior.json').unlink()
        operator = oplib.Operator({'DATA_ROOT': str(self.data), 'STATE_ROOT': str(self.state)}, self.root / 'NO-LEER.env')
        with self.assertRaises(FileNotFoundError), patch.object(operator, 'compose') as compose:
            operator.rollback()
        compose.assert_not_called()
        self.assert_no_cut()

    def test_pass_recupera_reles_mixtos_con_override_certificado(self):
        old = 'localhost/cooper:' + 'b' * 40
        self.references[old] = sha('relay-anterior')
        for name in ('chat-n8n', 'chat-runner'):
            self.services[name] = {'imagen': old, 'id': self.references[old]}
        self.write_overrides(); self.write_receipt()
        result = self.invoke()
        self.assertEqual(result['servicios_despues'], self.services)
        self.assertTrue(result['workflows_ajenos_preservados'])
        self.assertEqual(result['servicios_antes']['chat-n8n']['id'], self.references[self.cooper])
        self.assertEqual(len(self.override_calls), 3)
        self.assertTrue(all(kwargs == {'image_overrides': self.rollback_images} for _, kwargs in self.override_calls))

    def test_identidad_oci_no_confunde_indice_config_y_manifiesto(self):
        reference = self.new_images['n8n']['imagen']
        runtime = sha('manifiesto-plataforma')
        self.current_override['n8n'] = runtime
        self.receipt['identidades_nuevas']['n8n']['runtime_id'] = runtime
        self.write_receipt()
        with patch.object(recovery.infra, 'platform_manifest', return_value={
                'manifiesto': 'sha256:' + runtime, 'configuracion': 'sha256:' + sha('config-distinta')}) as manifest:
            self.assertEqual(self.invoke()['estado'], 'PASS')
        self.assertEqual(manifest.call_args.args[1], reference)
        self.assertGreaterEqual(manifest.call_count, 2)

    def test_rechaza_id_actual_distinto_del_pass_aunque_referencia_exista(self):
        self.receipt['identidades_nuevas']['n8n']['runtime_id'] = sha('otro-runtime')
        self.write_receipt()
        with patch.object(recovery.infra, 'verify_service_identity'):
            with self.assertRaisesRegex(RuntimeError, 'servicio actual'):
                self.invoke()
        self.assert_no_cut()

    def test_rechaza_override_ausente_antes_de_parar(self):
        self.rollback_images.unlink()
        with self.assertRaisesRegex(RuntimeError, 'Falta archivo'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_override_alterado_antes_de_parar(self):
        self.rollback_images.write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'Override'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_override_contenido_ajeno_aun_con_huella_actualizada(self):
        self.rollback_images.write_text('{}')
        self.receipt['imagenes_reversa_sha256'] = oplib.digest(self.rollback_images)
        self.write_receipt()
        with self.assertRaisesRegex(RuntimeError, 'Override'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_override_enlace_fuera_de_estado(self):
        outside = self.root / 'externo.json'
        self.rollback_images.rename(outside)
        self.rollback_images.symlink_to(outside)
        with self.assertRaisesRegex(RuntimeError, 'enlaces operativos'):
            self.invoke()
        self.assert_no_cut()

    def mutate_workflow(self):
        with closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as db, db:
            db.execute('UPDATE workflow_entity SET nodes=?', ('[{"name":"Cambio posterior"}]',))

    def test_rechaza_lote_posterior_con_misma_version_y_activacion(self):
        self.mutate_workflow()
        self.displaced = oplib.manifest(self.data)
        with self.assertRaisesRegex(RuntimeError, 'lote o edición'):
            self.invoke()
        self.assert_no_cut()

    def test_cas_repetido_detecta_edicion_durante_snapshot_sin_sustituir_datos(self):
        self.snapshot_hook = self.mutate_workflow
        with self.assertRaisesRegex(RuntimeError, 'Cambió un workflow'):
            self.invoke()
        self.assertTrue((self.state / 'mantenimiento').exists())
        self.assertFalse(self.running)
        self.assertTrue((self.data / 'cooper/posterior.txt').exists())
        self.assertFalse(any(p.name == 'datos-desplazados' for p in self.state.rglob('*')))
        self.assertEqual(oplib.manifest(self.data), oplib.verify(self.root / 'snapshot-desplazado'))

    def test_cas_override_repetido_detecta_cambio_durante_snapshot(self):
        self.snapshot_hook = lambda: self.rollback_images.write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'Override'):
            self.invoke()
        self.assertTrue((self.state / 'mantenimiento').exists())
        self.assertEqual(oplib.manifest(self.data), self.displaced)

    def test_rechaza_puntero_cooper_modificado_durante_corte(self):
        self.snapshot_hook = lambda: oplib.write_json(self.state / 'release.json', {'image': 'OTRA'})
        with self.assertRaisesRegex(RuntimeError, 'puntero de Cooper'):
            self.invoke()
        self.assertTrue((self.state / 'mantenimiento').exists())
        self.assertEqual(oplib.manifest(self.data), self.displaced)

    def test_cas_json_equivalente_no_inventa_lote_posterior(self):
        with closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as db, db:
            db.execute('UPDATE workflow_entity SET nodes=?,settings=?', ('[ ]', '{ }'))
        self.assertEqual(self.invoke()['estado'], 'PASS')

    def test_rechaza_lote_solo_columnas_sin_cambiar_version_workflow(self):
        with closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as db, db:
            db.execute('CREATE TABLE data_table_user_ficticia(id INTEGER, nueva TEXT)')
        self.displaced = oplib.manifest(self.data)
        with self.assertRaisesRegex(RuntimeError, 'lote o edición'):
            self.invoke()
        self.assert_no_cut()

    def test_rechaza_base_sin_columnas_cas_obligatorias(self):
        with closing(sqlite3.connect(self.data / 'n8n/database.sqlite')) as db, db:
            db.execute('ALTER TABLE workflow_entity DROP COLUMN versionCounter')
        self.displaced = oplib.manifest(self.data)
        with self.assertRaisesRegex(RuntimeError, 'contrato CAS'):
            self.invoke()
        self.assert_no_cut()

    def test_helper_independiente_carga_aplicador_junto_al_operador_certificado(self):
        extra = self.root / 'artefacto-separado'
        extra.mkdir()
        helper = extra / 'recuperar-infra.py'
        shutil.copyfile(Path(recovery.__file__), helper)
        spec = importlib.util.spec_from_file_location('helper_independiente', helper)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(Path(module.infra.__file__), Path(oplib.__file__).with_name('aplicar-infra.py'))
        self.assertEqual(module.operar, oplib)


if __name__ == '__main__':
    unittest.main()
