from contextlib import closing
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
spec = importlib.util.spec_from_file_location('aplicar_infra_test', DEPLOY / 'aplicar-infra.py')
infra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(infra)


class InfraTest(unittest.TestCase):
    def scenario(self, failure=False, rollback_failure=False, running=False):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target, candidate, state, data = [root / name for name in ('deploy', 'candidato', 'estado', 'datos')]
            for path in (target, candidate, state, data): path.mkdir()
            images = json.loads((DEPLOY / 'infra-imagenes.json').read_text())['servicios']
            for name in infra.FILES:
                shutil.copyfile(DEPLOY / name, candidate / name)
                if name != 'infra-imagenes.json':
                    (target / name).write_text('PUBLICO ANTERIOR ' + name)
            # El secreto ficticio representa un archivo ajeno a la copia pública.
            (target / '.env').write_text('FICTICIO=no-copiar')
            for name in infra.operar.VOLUMENES: (data / name).mkdir()
            with closing(sqlite3.connect(data / 'cooper/cooper.sqlite')) as db, db:
                db.executescript('CREATE TABLE videos(id INTEGER); INSERT INTO videos VALUES(42);')
            with closing(sqlite3.connect(data / 'n8n/database.sqlite')) as db, db:
                db.executescript('''CREATE TABLE workflow_entity(id TEXT,active INTEGER,versionId TEXT,activeVersionId TEXT,versionCounter INTEGER);
                INSERT INTO workflow_entity VALUES('ficticio',1,'v1','v1',1);
                CREATE TABLE data_table_user_prueba(id INTEGER,valor TEXT);
                INSERT INTO data_table_user_prueba VALUES(1,'original');
                CREATE TABLE execution_entity(status TEXT);
                CREATE TABLE migrations(id INTEGER); INSERT INTO migrations VALUES(1);''')
                if running: db.execute("INSERT INTO execution_entity VALUES('running')")
            original_hash = infra.operar.digest(data / 'n8n/database.sqlite')
            receipt = {'estado':'PASS', 'compose_bloques':8, 'servicios':images, 'cooper_image_id':'cooper-id',
                       'archivos':{name: infra.operar.digest(candidate / name) for name in infra.FILES},
                       'motor':{'migracion':'PASS','reversion':'PASS','idempotencia':'PASS','imagen_nueva':images['n8n']['imagen'],'imagen_anterior':images['n8n']['anterior']}}
            events = []
            failed_once = False

            class Operator:
                def __init__(self):
                    self.state, self.data, self.engine, self.env, self.env_file = state, data, 'docker', {}, target / '.env'
                def compose(self, *args):
                    nonlocal failed_once
                    events.append(args)
                    if args[0] == 'ps': return args[-1]
                    if args[0] == 'up' and failure and (not failed_once or rollback_failure):
                        failed_once = True
                        with closing(sqlite3.connect(data / 'n8n/database.sqlite')) as db, db:
                            db.execute("UPDATE data_table_user_prueba SET valor='intento fallido'")
                        raise RuntimeError('Fallo ficticio de salud')
                    return ''
                def snapshot(self, **kwargs):
                    events.append(('snapshot', kwargs))
                    infra.operar.copy_data(data, root / 'snapshot')
                    return 'a' * 64
                def restore(self, snapshot, destination):
                    self.assertion = snapshot == 'a' * 64
                    infra.operar.copy_data(root / 'snapshot', destination / 'datos')
                    return destination / 'datos'
                def ownership(self): events.append(('ownership',))

            def command(args, **_kwargs):
                if args[1] == 'compose':
                    self.assertEqual(args[-2:], ['config','--images'])
                    return '\n'.join([value['imagen'] for value in images.values()] + ['cooper-id'])
                if args[1:3] == ['image','inspect']:
                    return next(name + ('-nuevo-id' if value['imagen'] == args[3] else '-anterior-id') for name, value in images.items() if args[3] in (value['imagen'], value['anterior']))
                template, name = args[-2:]
                if '.State.Status' in template: return 'running healthy'
                is_new = not (target / 'compose.yaml').read_text().startswith('PUBLICO ANTERIOR')
                if name == 'cooper': return 'cooper-id'
                return name + ('-nuevo-id' if is_new else '-anterior-id')

            operator = Operator()
            output = state / 'resultado.json'
            with patch.object(infra.operar, 'DEPLOY', target), patch.object(infra.operar, 'run', command):
                if failure or running:
                    with self.assertRaises(RuntimeError): infra.apply(operator, candidate, receipt, output)
                else:
                    self.assertEqual(infra.apply(operator, candidate, receipt, output)['estado'], 'PASS')
            if running:
                self.assertFalse(output.exists())
                self.assertFalse(any(event[0] == 'snapshot' for event in events))
            elif failure and not rollback_failure:
                self.assertEqual(json.loads(output.read_text())['estado'], 'FALLO_REVERTIDO')
                self.assertEqual(infra.operar.digest(data / 'n8n/database.sqlite'), original_hash)
                self.assertTrue((target / 'Caddyfile').read_text().startswith('PUBLICO ANTERIOR'))
                self.assertFalse((target / 'infra-imagenes.json').exists())
                archived = list(state.glob('infra-*/datos-del-intento/n8n/database.sqlite'))
                self.assertEqual(len(archived), 1)
                self.assertNotEqual(infra.operar.digest(archived[0]), original_hash)
                self.assertIn(('ownership',), events)
            if not running:
                backups = list(state.glob('infra-*/configuracion-anterior'))
                self.assertEqual(len(backups), 1)
                self.assertFalse((backups[0] / '.env').exists())
            self.assertEqual((target / '.env').read_text(), 'FICTICIO=no-copiar')
            self.assertEqual((state / 'mantenimiento').exists(), rollback_failure)

    def test_actualizacion_exige_imagenes_y_preserva_cooper(self): self.scenario()
    def test_fallo_restaura_archivos_y_datos_reales_del_fixture(self): self.scenario(failure=True)
    def test_reversa_incompleta_conserva_marcador(self): self.scenario(failure=True, rollback_failure=True)
    def test_no_corta_si_existen_ejecuciones(self): self.scenario(running=True)

    def test_rechaza_candidato_distinto_antes_de_operar(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(RuntimeError):
                infra.validate_bundle(Path(temporary), {'estado':'PASS','compose_bloques':8,'archivos':{}})

    def test_arranca_proxy_al_final_y_recrea_relays(self):
        with tempfile.TemporaryDirectory() as temporary:
            class Operator:
                state = Path(temporary)
                calls = []
                def compose(self, *args): self.calls.append(args)
            op = Operator()
            (op.state / 'chat-tunel.enabled').touch()
            infra.start(op)
            self.assertEqual(op.calls[-1][-1], 'caddy')
            self.assertIn('--no-deps', op.calls[-1])
            for relay in ('chat-cooper','chat-n8n','chat-runner'):
                self.assertIn(relay, op.calls[0])
            self.assertTrue(all('--force-recreate' in call for call in op.calls))

class ImageIdentityTest(unittest.TestCase):
    def image(self, tag='localhost/cooper:ensayo', wrong_link=False):
        import hashlib
        import io
        import tarfile
        config = b'{"architecture":"amd64","Env":["FICTICIO=valor-no-proyectar"]}'
        config_id = hashlib.sha256(config).hexdigest()
        manifest = json.dumps({'schemaVersion':2,'config':{'digest':'sha256:' + ('b'*64 if wrong_link else config_id)},'layers':[]}).encode()
        manifest_id = hashlib.sha256(manifest).hexdigest()
        values = {config_id+'.json':config, 'blobs/sha256/'+manifest_id:manifest,
                  'manifest.json':json.dumps([{'Config':config_id+'.json','RepoTags':[tag],'Layers':[]}]).encode(),
                  'index.json':json.dumps({'manifests':[{'digest':'sha256:'+manifest_id}]}).encode()}
        stream=io.BytesIO()
        with tarfile.open(fileobj=stream,mode='w') as archive:
            for name,data in values.items():
                member=tarfile.TarInfo(name); member.size=len(data)
                archive.addfile(member,io.BytesIO(data))
        return stream.getvalue(), config_id, manifest_id

    def read(self, data, config, **kwargs):
        import io
        import tarfile
        with tarfile.open(fileobj=io.BytesIO(data),mode='r|*') as archive:
            return infra.archive_identity(archive,config,**kwargs)

    def test_enlaza_configuracion_y_manifiesto_sin_proyectar_entorno(self):
        data,config,manifest=self.image()
        result=self.read(data,config,tag='localhost/cooper:ensayo',manifest_id='sha256:'+manifest)
        self.assertEqual(result['config_sha256'],config)
        self.assertNotIn('valor-no-proyectar',json.dumps(result))

    def test_rechaza_etiqueta_ajena(self):
        data,config,_=self.image()
        with self.assertRaises(RuntimeError): self.read(data,config,tag='localhost/cooper:otra')

    def test_rechaza_configuracion_distinta_aun_con_etiqueta_correcta(self):
        data,_,_=self.image()
        with self.assertRaises(RuntimeError): self.read(data,'a'*64,tag='localhost/cooper:ensayo')

    def test_rechaza_manifiesto_ajeno(self):
        data,config,_=self.image()
        with self.assertRaises(RuntimeError): self.read(data,config,manifest_id='sha256:'+'a'*64)

    def test_rechaza_enlace_manifiesto_config_falso(self):
        data,config,manifest=self.image(wrong_link=True)
        with self.assertRaises(RuntimeError): self.read(data,config,manifest_id='sha256:'+manifest)

    def test_runtime_distinto_exige_archivo_y_prueba_criptografica(self):
        import io
        data,config,manifest=self.image()
        class Process:
            stdout=io.BytesIO(data)
            def wait(self,**_): return 0
            def poll(self): return 0
        class Operator:
            engine='docker';env={}
        current={'id':'sha256:'+manifest,'imagen':'localhost/cooper:ensayo'}
        with tempfile.TemporaryDirectory() as temporary:
            archive=Path(temporary)/'imagen.tar';archive.write_bytes(data)
            receipt={'cooper_image_id':'sha256:'+config,'cooper_artefacto':{'sha256':infra.operar.digest(archive),'etiqueta':current['imagen']}}
            with patch.object(infra.operar,'run',return_value=current['id']), patch.object(infra.subprocess,'Popen',return_value=Process()) as launch:
                result=infra.verify_cooper_identity(Operator(),current,receipt,archive)
            self.assertEqual(result['manifiesto'],current['id'])
            self.assertEqual(launch.call_args.args[0],['docker','image','save',current['id']])
            with self.assertRaises(RuntimeError): infra.verify_cooper_identity(Operator(),current,receipt)
            archive.write_bytes(b'alterado')
            with self.assertRaises(RuntimeError): infra.verify_cooper_identity(Operator(),current,receipt,archive)

    def test_recibo_anterior_no_permite_identidad_distinta(self):
        with self.assertRaises(RuntimeError):
            infra.verify_cooper_identity(None,{'id':'otra'}, {'cooper_image_id':'ensayada'})
