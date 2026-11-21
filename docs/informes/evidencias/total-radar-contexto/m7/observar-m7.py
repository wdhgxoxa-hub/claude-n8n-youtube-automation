import datetime,json,time,sqlite3
from contextlib import closing
from pathlib import Path
START=datetime.datetime(2026,11,21,20,0,5,tzinfo=datetime.timezone.utc).timestamp()
END=START+100
wid='FabAprendizaje01'
uri='file:/var/lib/cooper/n8n/database.sqlite?mode=ro'
def metadata():
 with closing(sqlite3.connect(uri,uri=True,timeout=5)) as db:
  db.row_factory=sqlite3.Row
  return {'publicada':[dict(r)for r in db.execute('SELECT id,active,activeVersionId FROM workflow_entity WHERE id=?',(wid,))],
   'trabajos':[dict(r)for r in db.execute('SELECT id,ownerId,ownerMemberId,nextRunAt,lastFiredAt,lastDispatchedAt,enabled FROM scheduled_job WHERE ownerId=?',(wid,))],
   'tareas':[dict(r)for r in db.execute('SELECT t.id,t.jobId,t.scheduledFor,t.status,t.startedAt,t.finishedAt,t.dispatchedAt FROM scheduled_task t JOIN scheduled_job j ON j.id=t.jobId WHERE j.ownerId=? ORDER BY t.id DESC LIMIT 4',(wid,))],
   'estadisticas':[dict(r)for r in db.execute('SELECT name,count,latestEvent,rootCount FROM workflow_statistics WHERE workflowId=?',(wid,))]}
initial=metadata();seen={};errors={};removed=[];present=set()
while time.time()<START:time.sleep(min(30,START-time.time()))
while time.time()<END:
 try:
  with closing(sqlite3.connect(uri,uri=True,timeout=5)) as db:
   db.row_factory=sqlite3.Row
   rows=[dict(r)for r in db.execute('SELECT id,workflowId,workflowVersionId,mode,status,startedAt,stoppedAt,finished FROM execution_entity WHERE workflowId=? AND startedAt>=? ORDER BY id',(wid,'2026-11-21 20:00:00'))]
  now=datetime.datetime.now(datetime.timezone.utc).isoformat();ids={r['id']for r in rows}
  for eid in present-ids:
   if eid not in removed:removed.append(eid)
  present=ids
  for row in rows:
   key=(row['id'],row['status'],row['finished'])
   if key not in seen:seen[key]={'observado_utc':now,**row}
 except sqlite3.Error as exc:
  category=type(exc).__name__;errors[category]=errors.get(category,0)+1
 time.sleep(.25)
print(json.dumps({'solo_lectura':True,'workflow':wid,'inicio_previsto_utc':'2026-11-21T20:00:05+00:00','fin_observado_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'antes':initial,'observadas':list(seen.values()),'filas_retiradas_durante_observacion':removed,'errores_lectura_categorias':errors,'despues':metadata()},ensure_ascii=False))
