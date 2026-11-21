import contextlib
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))

SPEC = importlib.util.spec_from_file_location('app_extra_test', Path(__file__).parents[1] / 'recuperar-app.py')
app = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(app)
app.set_support(Path(__file__).parents[1] / 'recuperar-infra.py')


def sha(text): return 'sha256:' + hashlib.sha256(text.encode()).hexdigest()


class RecoveryApp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.state = self.root / 'state'; self.state.mkdir()
        self.data = self.root / 'data'; self.live = self.data / 'cooper'; self.live.mkdir(parents=True)
        self.old = 'localhost/cooper:' + '1' * 40; self.new = 'localhost/cooper:' + '2' * 40
        self.database(self.live)
        (self.live / 'medios').mkdir(); (self.live / 'medios/video.bin').write_bytes(b'medio anterior')
        self.phase = {'configuracion': {'a': 'b'}, 'n8n_cas': 'inicial'}
        self.rows = {n: {'contenedor': n + '-original', 'imagen_id': sha(self.old if n in ('cooper', 'chat-cooper') else n), 'inicio': 'antes', 'salud': 'healthy'} for n in app.SERVICES}
        self.calls = []; self.fail_start = False; self.stop_hook = None
        parent = self
        class Op:
            state = parent.state; data = parent.data; release = parent.state / 'release.json'
            engine = 'docker'; env = {}
            def compose(self, *args, **kwargs):
                parent.calls.append((args, kwargs))
                if args[:2] == ('ps', '--status'): return '\n'.join(n for n,v in parent.rows.items() if v['salud'] == 'healthy')
                raise AssertionError(args)
        self.op = Op(); app.operar.write_json(self.op.release, {'image': self.old})
        for target, fn in [('services', lambda op, **kw: json.loads(json.dumps(self.rows))),
                           ('phase', lambda op: json.loads(json.dumps(self.phase))),
                           ('image_id', lambda op, ref: sha(ref)),
                           ('stop_app', self.stop), ('start_app', self.start)]:
            p = patch.object(app, target, side_effect=fn); p.start(); self.addCleanup(p.stop)
        self.prepared = self.state / 'preparacion.json'
        app.prepare(self.op, self.new, self.prepared)
        directory = self.state / 'solo-cooper-fixture'; directory.mkdir()
        self.backup = directory / 'respaldo'
        app.copy_verified(self.live, self.backup, app.manifest(self.live))
        old = {'image': self.old, 'id': sha(self.old), 'release': {'image': self.old}}
        app.operar.write_json(directory / 'anterior.json', old)
        for n in ('cooper', 'chat-cooper'): self.rows[n].update(imagen_id=sha(self.new), contenedor=n+'-nuevo', inicio='nuevo')
        app.operar.write_json(self.op.release, {'image': self.new})
        self.receipt = directory / 'resultado.json'
        app.operar.write_json(self.receipt, {'resultado':'PASS','imagen':self.new,'imagen_id_desplegada':sha(self.new),'anterior':self.old,'respaldo':str(self.backup),'respaldo_sha256':app.operar.digest(self.backup/'cooper.sqlite')})
        self.sealed = self.state / 'sello.json'; self.output = self.state / 'recuperacion.json'
        self.seal()

    def database(self, path):
        with contextlib.closing(sqlite3.connect(path / 'cooper.sqlite')) as db, db:
            db.execute('CREATE TABLE __drizzle_migrations(id INTEGER)'); db.execute('INSERT INTO __drizzle_migrations VALUES(1)')
            db.execute('CREATE TABLE datos(id INTEGER)'); db.execute('INSERT INTO datos VALUES(1)')

    def stop(self, op):
        for n in ('cooper', 'chat-cooper'): self.rows[n]['salud']='stopped'
        if self.stop_hook: self.stop_hook()

    def start(self, op, image):
        if self.fail_start: raise RuntimeError('Fallo ficticio')
        for n in ('cooper', 'chat-cooper'): self.rows[n].update(salud='healthy', imagen_id=sha(image), contenedor=n+'-recuperado', inicio='recuperado')

    def seal(self):
        return app.seal(self.op,self.prepared,app.operar.digest(self.prepared),self.receipt,app.operar.digest(self.receipt),self.sealed)

    def recover(self): return app.recover(self.op,self.sealed,app.operar.digest(self.sealed),self.output)

    def test_pass_archiva_wal_medios_y_conserva_cinco(self):
        (self.live/'medios/posterior.bin').write_bytes(b'escritura posterior')
        with contextlib.closing(sqlite3.connect(self.live/'cooper.sqlite')) as db, db: db.execute('INSERT INTO datos VALUES(2)')
        before={n:dict(self.rows[n]) for n in app.OTHERS}
        result=self.recover()
        self.assertEqual(result['estado'],'PASS'); archived=Path(result['datos_desplazados'])
        self.assertEqual((archived/'medios/posterior.bin').read_bytes(),b'escritura posterior')
        self.assertEqual(app.solo.counts(archived/'cooper.sqlite')['datos'],2)
        self.assertEqual(app.solo.counts(self.live/'cooper.sqlite')['datos'],1)
        self.assertEqual(before,{n:self.rows[n] for n in app.OTHERS})
        self.assertFalse((self.state/'anterior.json').exists());self.assertFalse((self.state/'mantenimiento').exists())

    def test_manifiesto_incluye_wal_y_medios_sin_shm(self):
        (self.backup/'cooper.sqlite-wal').write_bytes(b'wal ficticio');(self.backup/'cooper.sqlite-shm').write_bytes(b'indice')
        value=app.manifest(self.backup)
        self.assertIn('cooper.sqlite-wal',value);self.assertIn('medios/video.bin',value);self.assertNotIn('cooper.sqlite-shm',value)

    def test_seal_rechaza_fase_posterior(self):
        self.sealed.unlink();self.phase['n8n_cas']='lote posterior'
        with self.assertRaisesRegex(RuntimeError,'fase posterior'): self.seal()

    def test_seal_rechaza_otro_servicio_recreado(self):
        self.sealed.unlink();self.rows['n8n']['inicio']='recreado'
        with self.assertRaisesRegex(RuntimeError,'otro servicio'): self.seal()

    def test_seal_rechaza_resultado_no_pass(self):
        self.sealed.unlink();d=json.loads(self.receipt.read_text());d['resultado']='REVERTIDO';app.operar.write_json(self.receipt,d)
        with self.assertRaisesRegex(RuntimeError,'preparación y PASS'): self.seal()

    def test_rechaza_sello_alterado(self):
        old=app.operar.digest(self.sealed);self.sealed.write_text(self.sealed.read_text()+' ')
        with self.assertRaisesRegex(RuntimeError,'Recibo alterado'):app.recover(self.op,self.sealed,old,self.output)
        self.assertFalse((self.state/'mantenimiento').exists())

    def test_rechaza_medios_o_wal_alterados(self):
        (self.backup/'medios/video.bin').write_bytes(b'alterado')
        with self.assertRaisesRegex(RuntimeError,'Respaldo completo'):self.recover()
        self.assertFalse((self.state/'mantenimiento').exists())

    def test_rechaza_imagen_release_y_fase_distintas(self):
        for change in ('imagen','release','fase'):
            with self.subTest(change=change):
                with patch.object(app,'validate',wraps=app.validate):
                    if change=='imagen':self.rows['runner']['imagen_id']=sha('ajena')
                    elif change=='release':app.operar.write_json(self.op.release,{'image':'ajena'})
                    else:self.phase['n8n_cas']='otra'
                    with self.assertRaises(RuntimeError):self.recover()
                    self.rows['runner']['imagen_id']=sha('runner');app.operar.write_json(self.op.release,{'image':self.new});self.phase['n8n_cas']='inicial'
        self.assertFalse((self.state/'mantenimiento').exists())

    def test_rechaza_enlaces_y_salida_existente(self):
        link=self.state/'enlace.json';link.symlink_to(self.sealed)
        with self.assertRaises(RuntimeError):app.recover(self.op,link,app.operar.digest(self.sealed),self.output)
        self.output.touch()
        with self.assertRaises(RuntimeError):self.recover()

    def test_fallo_arranque_conserva_datos_y_mantenimiento(self):
        (self.live/'posterior').write_bytes(b'nuevo');self.fail_start=True
        with self.assertRaisesRegex(RuntimeError,'Fallo ficticio'):self.recover()
        d=json.loads(self.output.read_text());self.assertEqual(d['estado'],'FALLO_MANTENIMIENTO')
        self.assertEqual((Path(d['datos_desplazados'])/'posterior').read_bytes(),b'nuevo')
        self.assertTrue((self.state/'mantenimiento').exists())

    def test_revalida_fase_bajo_corte(self):
        self.stop_hook=lambda:self.phase.update(n8n_cas='posterior')
        with self.assertRaisesRegex(RuntimeError,'Fase posterior'):self.recover()
        self.assertTrue((self.state/'mantenimiento').exists());self.assertTrue(self.live.exists())

    def test_revalida_servicios_ajenos_bajo_corte(self):
        self.stop_hook=lambda:self.rows['n8n'].update(inicio='ajeno')
        with self.assertRaisesRegex(RuntimeError,'ajeno cambió'):self.recover()
        self.assertEqual(json.loads(self.output.read_text())['estado'],'FALLO_MANTENIMIENTO')

    def test_puntero_global_ajeno_no_se_usa_ni_cambia(self):
        global_file=self.state/'anterior.json';global_file.write_text('{"image":"ajena"}')
        before=global_file.read_bytes();self.recover();self.assertEqual(global_file.read_bytes(),before)

    def test_copia_recupera_transaccion_real_persistida_solo_en_wal(self):
        source=self.root/'wal-real';source.mkdir()
        script="import sqlite3,os,sys;d=sqlite3.connect(sys.argv[1]);d.execute('PRAGMA journal_mode=WAL');d.execute('PRAGMA wal_autocheckpoint=0');d.execute('CREATE TABLE prueba(id INTEGER)');d.execute('INSERT INTO prueba VALUES(7)');d.commit();os._exit(0)"
        subprocess.run([sys.executable,'-c',script,str(source/'cooper.sqlite')],check=True,capture_output=True)
        self.assertTrue((source/'cooper.sqlite-wal').stat().st_size>0)
        manifest=app.manifest(source);target=self.root/'wal-restaurado'
        app.copy_verified(source,target,manifest)
        self.assertEqual(app.solo.counts(target/'cooper.sqlite')['prueba'],1)
        self.assertEqual(app.manifest(source),manifest)

    def test_rechaza_codigo_distinto_antes_del_corte(self):
        with patch.object(app,'code_hashes',return_value={'extra':'otro'}):
            with self.assertRaisesRegex(RuntimeError,'código distinto'):self.recover()
        self.assertFalse((self.state/'mantenimiento').exists())

    def test_rechaza_etiqueta_anterior_movida(self):
        with patch.object(app,'image_id',side_effect=lambda op,ref:sha('movida') if ref==self.old else sha(ref)):
            with self.assertRaisesRegex(RuntimeError,'Etiqueta movida'):self.recover()
        self.assertFalse((self.state/'mantenimiento').exists())

    def test_recibo_scoped_o_preparacion_alterados_bloquean(self):
        for path in (self.receipt,self.prepared):
            original=path.read_bytes();path.write_bytes(original+b' ')
            with self.assertRaisesRegex(RuntimeError,'Recibo alterado'):self.recover()
            path.write_bytes(original)
        self.assertFalse((self.state/'mantenimiento').exists())

    def test_preparacion_no_admite_reles_de_otra_imagen(self):
        self.rows['cooper']['imagen_id']=sha(self.old);app.operar.write_json(self.op.release,{'image':self.old})
        with self.assertRaisesRegex(RuntimeError,'Imagen anterior'):app.prepare(self.op,self.new,self.state/'preparacion-otra.json')

    def test_identidades_normalizan_prefijo_sin_inspeccion_amplia(self):
        spec=importlib.util.spec_from_file_location('scoped_ids',Path(app.__file__));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        mod.set_support(Path(__file__).parents[1]/'recuperar-infra.py')
        class Op:
            engine='podman';env={}
            def compose(self,*a):return 'c'*64
        for prefix in ('','sha256:'):
            with patch.object(mod.operar,'run',return_value=json.dumps(prefix+'d'*64)+'|"inicio"|"healthy"') as run:
                rows=mod.services(Op())
                self.assertEqual(rows['cooper']['imagen_id'],'sha256:'+'d'*64)
                self.assertNotIn('.Id',run.call_args.args[0][3]);self.assertNotIn('.Env',run.call_args.args[0][3])

    def test_comandos_limitan_corte_y_arranque(self):
        # Se validan las funciones originales mediante un módulo independiente.
        spec=importlib.util.spec_from_file_location('scoped_commands',Path(app.__file__));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        class Fake:
            def compose(self,*args,**kwargs): self.args=args;self.kwargs=kwargs
        op=Fake();mod.stop_app(op);self.assertEqual(op.args,('stop','chat-cooper','cooper'))
        mod.start_app(op,self.old);self.assertEqual(op.args[-2:],('cooper','chat-cooper'));self.assertIn('--no-deps',op.args);self.assertEqual(op.kwargs,{'image':self.old})


if __name__=='__main__':unittest.main()
