"""Convierte solo sondas autorizadas a entrada temporal bloqueada por Caddy.

No contacta n8n. Exige comprobar públicamente 404 antes de publicar y llama solo
loopback desde el contenedor. CLI execute 2.47.4 no inicializa DataTable.
"""
import argparse
import json
from pathlib import Path
import uuid

IDS={'CoopEnsayoIdYt01','CoopEnsayoApr01','CoopEnsayoLec01','CoopSondaVidIQ01','CoopSondaYtComp1','CoopRadarReal001'}

def preparar(workflow):
 if workflow.get('id') not in IDS: raise ValueError('ID fuera de sondas autorizadas')
 triggers=[n for n in workflow['nodes'] if n['type'].endswith('.manualTrigger')]
 if len(triggers)!=1: raise ValueError('Se requiere un único trigger manual')
 if any(n['type'].endswith(('.scheduleTrigger','.webhook','.formTrigger')) for n in workflow['nodes']):
  raise ValueError('La sonda ya contiene una entrada pública o programada')
 ruta='cooper/v1/ensayo-'+str(uuid.uuid4())
 trigger=triggers[0]
 trigger.update({'type':'n8n-nodes-base.webhook','typeVersion':2,'webhookId':str(uuid.uuid4()),
  'parameters':{'httpMethod':'POST','path':ruta,'responseMode':'onReceived','options':{}}})
 workflow['active']=False
 workflow['settings'].update({'saveDataSuccessExecution':'none','saveDataErrorExecution':'none',
  'saveManualExecutions':False,'saveExecutionProgress':False})
 workflow['settings'].pop('errorWorkflow',None)
 return workflow,ruta

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--entrada',required=True);p.add_argument('--salida',required=True)
 a=p.parse_args(); w,ruta=preparar(json.loads(Path(a.entrada).read_text()))
 with Path(a.salida).open('x') as f: json.dump(w,f,ensure_ascii=False,indent=2)
 print(json.dumps({'workflow':w['id'],'ruta_interna':'/webhook/'+ruta,'requiere_bloqueo_publico_verificado':True}))
