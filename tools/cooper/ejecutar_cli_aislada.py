"""CLI n8n + runner externo efímero, sin extraer entorno ni guardar salida cruda."""
import json
import subprocess
import sys
import sqlite3
import fcntl
import copy
from pathlib import Path

CONFIG={'task-runners':[{
 'runner-type':'javascript','workdir':'/home/runner','command':'/usr/local/bin/node',
 'args':['--disallow-code-generation-from-strings','--disable-proto=delete','--no-experimental-webstorage','/opt/runners/task-runner-javascript/dist/start.js'],
 'health-check-server-port':'5687',
 'allowed-env':['PATH','HOME','NODE_OPTIONS','N8N_RUNNERS_AUTO_SHUTDOWN_TIMEOUT','N8N_RUNNERS_TASK_TIMEOUT','N8N_RUNNERS_MAX_CONCURRENCY'],
 'env-overrides':{'NODE_FUNCTION_ALLOW_BUILTIN':'crypto','NODE_FUNCTION_ALLOW_EXTERNAL':'','N8N_BLOCK_ENV_ACCESS_IN_NODE':'true','N8N_RUNNERS_HEALTH_CHECK_SERVER_HOST':'127.0.0.1'}
}]}

def configuracion(wid):
 config=copy.deepcopy(CONFIG)
 if wid=='CoopRadarReal001':
  # Texto necesita solo la URL pública; la autenticación HTTP se evalúa en n8n.
  js=config['task-runners'][0]
  js['allowed-env'].append('PUENTE_CODEX_URL')
  js['env-overrides']['N8N_BLOCK_ENV_ACCESS_IN_NODE']='false'
 return config

def ejecutar(wid, base='file:/var/lib/cooper/n8n/database.sqlite?mode=ro'):
 if wid not in ['CoopEnsayoApr01','CoopEnsayoLec01','CoopSondaVidIQ01','CoopSondaYtComp1','CoopRadarReal001']:
  raise ValueError('ID no autorizado')
 with sqlite3.connect(base,uri=True) as c:
  previo=c.execute('SELECT COALESCE(MAX(id),0) FROM execution_entity').fetchone()[0]
 ruta='/tmp/cooper-ensayo-runner.json'
 subprocess.run(['docker','exec','-i','cooper-runner-1','sh','-c','cat > '+ruta],input=json.dumps(configuracion(wid)).encode(),check=True)
 pid='/tmp/cooper-ensayo-runner.pid'
 runner_cmd=['docker','exec','-e','N8N_RUNNERS_CONFIG_PATH='+ruta,
 '-e','N8N_RUNNERS_TASK_BROKER_URI=http://n8n:5689','-e','N8N_RUNNERS_LAUNCHER_HEALTH_CHECK_PORT=5688',
 '-e','N8N_RUNNERS_LAUNCHER_LOG_LEVEL=error','-e','N8N_RUNNERS_AUTO_SHUTDOWN_TIMEOUT=0',
 'cooper-runner-1','sh','-c','echo $$ > '+pid+'; exec /usr/local/bin/task-runner-launcher javascript']
 runner=subprocess.Popen(runner_cmd,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  cli=['docker','exec','-e','N8N_RUNNERS_BROKER_PORT=5689',
   '-e','EXECUTIONS_DATA_SAVE_ON_ERROR=none','-e','EXECUTIONS_DATA_SAVE_ON_SUCCESS=none',
   '-e','EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=false','-e','EXECUTIONS_DATA_SAVE_ON_PROGRESS=false',
   '-e','N8N_LOG_LEVEL=error','cooper-n8n-1','timeout','260','n8n','execute','--id',wid]
  r=subprocess.run(cli,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=300)
  with sqlite3.connect(base,uri=True) as c:
   ejecuciones=[{'id':e[0],'estado':e[1]} for e in c.execute('SELECT id,status FROM execution_entity WHERE id>? AND workflowId=? ORDER BY id',(previo,wid))]
  return {'workflow':wid,'codigo_cli':r.returncode,'ejecuciones':ejecuciones,'runner_externo_aislado':True,'salida_cruda_descartada':True}
 finally:
  subprocess.run(['docker','exec','cooper-runner-1','sh','-c','if test -f '+pid+'; then kill -TERM "$(cat '+pid+')"; fi'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  try: runner.wait(timeout=50)
  except subprocess.TimeoutExpired:
   subprocess.run(['docker','exec','cooper-runner-1','sh','-c','if test -f '+pid+'; then kill -KILL "$(cat '+pid+')"; fi'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   runner.terminate()
  subprocess.run(['docker','exec','cooper-runner-1','rm','-f',pid],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  subprocess.run(['docker','exec','cooper-runner-1','rm','-f',ruta],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__ == '__main__':
 try:
  with Path('/tmp/cooper-ensayo-cli.lock').open('a') as lock:
   fcntl.flock(lock.fileno(),fcntl.LOCK_EX | fcntl.LOCK_NB)
   resultado=ejecutar(sys.argv[1])
   print(json.dumps(resultado))
 except Exception:
  raise SystemExit('Ensayo detenido; no se muestran datos de ejecución. Revisar metadata, puertos y exclusividad.')
