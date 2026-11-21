#!/usr/bin/env python3
"""Extra exacto: publish → cron real con cola vacía → unpublish, solo fixture local.
Reutiliza el laboratorio de siete servicios; la red interna impide salida externa.
"""
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from socketserver import ThreadingUnixStreamServer
DEPLOY=Path(__file__).resolve().parents[1];sys.path.insert(0,str(DEPLOY))
import operar

def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
lab=load('lab_marcas',DEPLOY/'tests/infra-recuperacion-mixta.py')
extra=load('extra_marcas',DEPLOY/'activar-marcas-simuladas.py')

def main():
 assert os.geteuid()!=0
 output=Path(sys.argv[1]).resolve();assert not output.exists()
 restic=Path.home()/'.cache/cooper-marcas-restic'
 if not restic.exists():
  name='cooper-marcas-restic-'+str(time.time_ns())
  subprocess.run(['podman','create','--name',name,'docker.io/restic/restic:0.20.0'],check=True,stdout=subprocess.DEVNULL)
  try:subprocess.run(['podman','cp',name+':/usr/bin/restic',str(restic)],check=True,stdout=subprocess.DEVNULL)
  finally:subprocess.run(['podman','rm',name],check=True,stdout=subprocess.DEVNULL)
 op,root,override=lab.setup('localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea',restic)
 op.env.update(COOPER_MARCAS_HABILITAR='1',COOPER_MARCAS_URL='https://cooper.test')
 op.env_file.write_text(''.join(k+'='+v+'\n' for k,v in op.env.items()));op.env_file.chmod(0o600)
 for row in override['services'].values():row['cpuset']='16-23'
 override['services']['caddy']['networks']={'backend':{'aliases':['cooper.test','flujos.test']},'salida':{}}
 caddy=root/'Caddyfile.local';caddy.write_text(caddy.read_text().replace('{$COOPER_DOMAIN} {','{$COOPER_DOMAIN} {\n log {\n output file /data/marcas-acceso.json\n format json\n }',1))
 operar.write_json(Path(op.env['COOPER_COMPOSE_OVERRIDE']),override)
 server=ThreadingUnixStreamServer(str(root/'tunel/puente.sock'),lab.FakeBridge);server.daemon_threads=True;(root/'tunel/puente.sock').chmod(0o600)
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 process=subprocess.Popen(['podman','--runtime','runc','system','service','--time=0',op.env['DOCKER_HOST']],env=op.env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 result={'estado':'INICIADO','fixture':str(root),'fuente_extra_sha256':operar.digest(DEPLOY/'activar-marcas-simuladas.py'),'imagen':op.env['COOPER_IMAGE'],'vps_accedido':False,'datos_sinteticos':True}
 try:
  for _ in range(100):
   if (root/'podman.sock').exists():break
   time.sleep(.1)
  with op.lock():
   op.restic('init');operar.write_json(op.release,{'image':op.env['COOPER_IMAGE']})
   print('Iniciando siete servicios de laboratorio',flush=True)
   op.compose('up','-d','--no-build','--wait','--wait-timeout','240')
   # Inicialización efímera ya usada en compose.mjs y cotejada con OwnerController 2.47.6.
   owner="fetch('http://127.0.0.1:5678/rest/owner/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'owner@example.test',firstName:'Ensayo',lastName:'Marcas',password:'Aa1!'+require('crypto').randomBytes(20).toString('hex')})}).then(r=>{if(r.status!==200)process.exit(1);console.log('PASS')}).catch(()=>process.exit(1))"
   assert op.compose('exec','-T','n8n','node','-e',owner).strip()=='PASS'
   ca=root/'ca';ca.mkdir();shutil.copyfile(op.data/'caddy-data/caddy/pki/authorities/local/root.crt',ca/'root.crt')
   override['services']['n8n'].setdefault('environment',{})['NODE_EXTRA_CA_CERTS']='/ca/root.crt'
   override['services']['n8n']['volumes']=[str(ca)+':/ca:ro']
   operar.write_json(Path(op.env['COOPER_COMPOSE_OVERRIDE']),override)
   op.compose('stop')
   source=DEPLOY.parent/'workflows/v2';seed=op.data/'n8n/marcas-semilla.json'
   flows=[json.loads((source/(wid+'.json')).read_text()) for wid in extra.IDS]
   assert all(w['active'] is False for w in flows)
   operar.write_json(seed,flows)
   op.compose('run','--rm','--no-deps','-T','--entrypoint','n8n','n8n','import:workflow','--input=/home/node/.n8n/marcas-semilla.json');seed.unlink()
   op.compose('up','-d','--no-build','--wait','--wait-timeout','240')
   result['servicios_antes']=lab.check(op)
   result['redes']={name:operar.run(['podman','network','inspect','--format','{{.Internal}}',op.env['COMPOSE_PROJECT_NAME']+'_'+name],env=op.env).strip() for name in ('backend','salida')}
   assert set(result['redes'].values())=={'true'}
   prepared=extra.prepare(op,source);operar.write_json(op.state/'marcas-preparado.json',prepared)
   print('Publicando únicamente los dos workers exactos',flush=True)
   enabled=extra.change(op,prepared,op.state/'marcas-activado.json')
   print('Observando cron real y firma HMAC con cola vacía',flush=True)
   end=time.time()+360;executions=[];worker=[]
   while time.time()<end:
    with closing(sqlite3.connect((op.data/'n8n/database.sqlite').as_uri()+'?mode=ro',uri=True)) as db:
     executions=[dict(zip(('id','workflow','status','mode'),r)) for r in db.execute('SELECT id,workflowId,status,mode FROM execution_entity ORDER BY id')]
    access=op.data/'caddy-data/marcas-acceso.json'
    accesses=[json.loads(x) for x in access.read_text().splitlines() if x] if access.exists() else []
    worker=[x for x in accesses if x.get('request',{}).get('uri')=='/api/marcas/operar']
    if worker:break
    if any(r['status']=='error' for r in executions):raise RuntimeError('Cron falló')
    time.sleep(2)
   assert all(r['workflow'] in extra.IDS and r['status'] in ('success','running') for r in executions)
   # saveDataSuccessExecution=none es parte de la fuente exacta: observar POST,
   # sin cambiar el workflow para retener datos o adelantar el horario real.
   result['cron']={'fuente_exacta':True,'disparo_manual':False,'ejecuciones_guardadas':len(executions)}
   assert worker and all(x['request']['method']=='POST' and x['status']==200 for x in worker)
   result['worker_http']={'posts_firmados_200':len(worker),'gets':sum(x['request']['method']=='GET' for x in worker)}
   result['cola_despues']=extra.assert_empty(op)
   print('Revirtiendo publicación y comprobando contenido, versiones y ajenos',flush=True)
   reversed=extra.change(op,enabled,op.state/'marcas-revertido.json',True)
   for wid,before in prepared['antes']['flujos'].items():
    after=reversed['despues']['flujos'][wid]
    for key in ('active','version','publicada','contenido'):assert after[key]==before[key]
   result['servicios_despues']=lab.check(op)
   assert result['servicios_antes']['servicios']==result['servicios_despues']['servicios']
   result.update(estado='PASS',activacion='PASS',cron_real='PASS',reversa_contenido_version_publicacion='PASS',tablas_preservadas=True,cola_vacia=True,get_externos=0,red_externa='bloqueada_por_ambas_redes_internas',conteos_publicacion_n8n='Contadores de versión avanzan por la CLI oficial; no se atribuye reversa byte a byte de la base.',alcance='Siete contenedores Podman reales, fuente exacta de ambos workers, cron de Publicación real y HMAC de producción hacia Cooper b3. Sin seeds, aprobación ni publicación real; Métricas queda publicado/revertido, no se espera su intervalo de una hora.')
 except Exception:
  result['estado']='FALLO'
  import traceback
  (root/'error-privado.log').write_text(traceback.format_exc());raise
 finally:
  try:
   op.compose('down','--remove-orphans','--timeout','15');result['limpieza']='PASS'
  except Exception:result['limpieza']='FALLO'
  process.terminate();process.wait(timeout=15);server.shutdown();server.server_close();thread.join(timeout=5)
  output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 return result
if __name__=='__main__':
 try:print(json.dumps({'estado':main()['estado']}))
 except BaseException as e:print(json.dumps({'estado':'FALLO','clase':type(e).__name__}));sys.exit(1)
