#!/usr/bin/env python3
"""Ciclo scoped local real: anterior → PASS b3 → escritura → recuperación anterior."""
import argparse
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sqlite3
import sys
import threading
import time
from unittest.mock import patch

DEPLOY=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(DEPLOY))
import operar


def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod


lab=load('lab_app_mixto',DEPLOY/'tests/infra-recuperacion-mixta.py')
app=load('extra_app_real',DEPLOY/'recuperar-app.py');app.set_support(DEPLOY/'recuperar-infra.py')


class ScopedLab(lab.LabOperator):
    def compose(self,*args,**kw):
        if args and args[0]=='up' and 'cooper' in args and not any(n in args for n in ('n8n','runner')):
            running=operar.Operator.compose(self,'ps','--status','running','--services',**kw).split()
            operar.require('chat-cooper' not in running,'Relé scoped aún activo')
            operar.Operator.compose(self,'rm','--force','chat-cooper',**kw)
            return operar.Operator.compose(self,*args,**kw)
        return super().compose(*args,**kw)


def main(args):
    operar.require(os.geteuid()!=0 and DEPLOY.is_relative_to(Path.home()/'.cache'),'Solo laboratorio rootless nuevo')
    receipt=json.loads(args.ensayo.read_text());lab.infra.validate_bundle(DEPLOY,receipt)
    image=receipt['cooper_artefacto']['etiqueta'];operar.require(operar.digest(args.imagen_archivo)==receipt['cooper_artefacto']['sha256'],'Imagen distinta')
    op,root,override=lab.setup(args.imagen_anterior,args.restic_bin);op.__class__=ScopedLab
    for name, value in json.loads((DEPLOY/'infra-imagenes.json').read_text())['servicios'].items():
        override['services'][name]['image']=value['anterior']
    operar.write_json(Path(op.env['COOPER_COMPOSE_OVERRIDE']),override)
    print(json.dumps({'fixture':str(root)}),flush=True)
    server=lab.ThreadingUnixStreamServer(str(root/'tunel/puente.sock'),lab.FakeBridge);server.daemon_threads=True
    (root/'tunel/puente.sock').chmod(0o600);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    service=subprocess.Popen(['podman','--runtime','runc','system','service','--time=0',op.env['DOCKER_HOST']],env=op.env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    result={'estado':'INICIADO','codigo':app.code_hashes(),'arnes_sha256':operar.digest(Path(__file__)),'imagen':image,'artefacto_sha256':operar.digest(args.imagen_archivo),'vps_accedido':False}
    try:
        for _ in range(100):
            if (root/'podman.sock').exists():break
            time.sleep(.1)
        with op.lock():
            operar.write_json(op.release,{'image':args.imagen_anterior})
            op.compose('up','-d','--no-build','--wait','--wait-timeout','240')
            result['antes']=lab.check(op)
            # Fila y medio previos para verificar restauración íntegra.
            with contextlib.closing(sqlite3.connect(op.data/'cooper/cooper.sqlite')) as db, db:
                db.execute('CREATE TABLE ensayo_recuperacion(id INTEGER PRIMARY KEY)');db.execute('INSERT INTO ensayo_recuperacion VALUES(1)')
            media=op.data/'cooper/medios-ensayo';media.mkdir();(media/'anterior.bin').write_bytes(b'medio anterior ficticio')
            prepared=op.state/'preparacion-app.json';app.prepare(op,image,prepared)
            before=app.services(op);other_before={n:before[n] for n in app.OTHERS}
            def cid_for(name):
                operar.require(name.startswith('cooper-') and name.endswith('-1'),'Nombre fuera del fixture')
                short=name[len('cooper-'):-2]
                operar.require(short in app.SERVICES,'Servicio fuera de fixture')
                return op.compose('ps','--all','-q',short).strip()
            def inspect(name,fmt):
                value=operar.run(['podman','inspect','--format',fmt,cid_for(name)],env=op.env).strip()
                if fmt=='{{.Image}}': value='sha256:'+value.removeprefix('sha256:')
                return value
            def transport(command,timeout=240,env=None):
                command=list(command)
                if command[0]=='docker':command[0]='podman'
                if command[1]=='stop':command[-1]=cid_for(command[-1])
                if command[1]=='run':command[2:2]=['--runtime','runc','--userns','keep-id','--cpuset-cpus','0-1','--cpus','0.5','--memory','1g','--memory-swap','1g']
                p=subprocess.run(command,env={**op.env,**(env or {})},capture_output=True,text=True,timeout=timeout)
                if p.returncode:
                    (root/'transporte-privado.log').write_text(p.stderr)
                operar.require(p.returncode==0,'Transporte scoped local falló')
                return p.stdout.strip()
            class Health:
                status=200
                def __enter__(self):return self
                def __exit__(self,*_):pass
                def read(self):
                    c=op.compose('ps','-q','cooper').strip()
                    text=operar.run(['podman','exec',c,'node','-e',"fetch('http://127.0.0.1:3000/api/salud').then(async r=>{if(!r.ok)process.exit(1);console.log(JSON.stringify(await r.json()))})"],env=op.env)
                    return text.encode()
            # Solo adaptación del transporte, rutas/UID y verificación HTTP local.
            # deploy(), copia, ensayo/migración, checks y rama except no se sustituyen.
            with patch.dict(os.environ,op.env),patch.object(app.solo,'STATE',op.state),patch.object(app.solo,'DATA',op.data/'cooper'),patch.object(app.solo,'DEPLOY',DEPLOY),patch.object(app.solo.os,'geteuid',return_value=0),patch.object(app.solo,'inspect',side_effect=inspect),patch.object(app.solo,'run',side_effect=transport),patch.object(app.solo,'compose',side_effect=lambda image,*a:op.compose(*a,image=image)),patch.object(app.solo.urllib.request,'urlopen',return_value=Health()):
                deployed=app.solo.deploy(image,before['cooper']['imagen_id'])
            result['despliegue']=deployed
            receipt_path=Path(deployed['respaldo']).parent/'resultado.json'
            sealed=op.state/'sello-app.json'
            app.seal(op,prepared,operar.digest(prepared),receipt_path,operar.digest(receipt_path),sealed)
            result['aplicada']=lab.check(op)
            (media/'posterior.bin').write_bytes(b'medio posterior ficticio')
            with contextlib.closing(sqlite3.connect(op.data/'cooper/cooper.sqlite')) as db, db:
                db.execute('INSERT INTO ensayo_recuperacion VALUES(2)')
            output=op.state/'recuperacion-app.json';recovered=app.recover(op,sealed,operar.digest(sealed),output)
            result['recuperada']=lab.check(op)
            archived=Path(recovered['datos_desplazados'])
            operar.require((archived/'medios-ensayo/posterior.bin').read_bytes()==b'medio posterior ficticio','Medio posterior perdido')
            operar.require(app.solo.counts(archived/'cooper.sqlite')['ensayo_recuperacion']==2,'Fila posterior perdida')
            operar.require(app.solo.counts(op.data/'cooper/cooper.sqlite')['ensayo_recuperacion']==1,'No volvió fila anterior')
            # Otra copia comprobada del estado desplazado acredita recuperabilidad.
            app.copy_verified(archived,op.state/'restauracion-desplazado',recovered['manifiesto_desplazado'])
            after=app.services(op);operar.require({n:after[n] for n in app.OTHERS}==other_before,'Cambió uno de otros cinco servicios')
            operar.require(not (op.state/'anterior.json').exists(),'Puntero global inventado')
            operar.require(not (op.state/'mantenimiento').exists(),'Mantenimiento pendiente')
            result.update(estado='PASS',cinco_identidades_y_arranques_intactos=True,datos_anteriores_restaurados=True,datos_posteriores_archivados_y_restaurables=True,anterior_global_ausente=True,recibo_sello=str(sealed),recibo_recuperacion=str(output),codigo_final=app.code_hashes())
            operar.require(result['codigo']==result['codigo_final'],'Código productivo cambió')
    except Exception:
        result['estado']='FALLO'
        import traceback
        (root/'error-privado.log').write_text(traceback.format_exc())
        raise
    finally:
        try:op.compose('down','--timeout','30');result['limpieza']='PASS'
        finally:
            server.shutdown();server.server_close();thread.join(timeout=5)
            service.terminate()
            try:service.wait(timeout=15)
            except subprocess.TimeoutExpired:service.kill();service.wait()
            operar.write_json(root/'resultado-app.json',result)
    return result


if __name__=='__main__':
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('ensayo','imagen-archivo','restic-bin'):parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--imagen-anterior',required=True)
    try:print(json.dumps(main(parser.parse_args())))
    except Exception:print('Ensayo app detenido; consultar recibo sintético privado.',file=sys.stderr);sys.exit(1)
