import json,sqlite3,time
from contextlib import closing
expected={'FabRadar00000001':1,'FabAprendizaje01':1,'CooperMarcasPub1':2,'CooperMarcasMet1':2}
try:
 with closing(sqlite3.connect('file:/var/lib/cooper/n8n/database.sqlite?mode=ro',uri=True)) as db:
  db.execute('PRAGMA query_only=ON')
  db.execute('BEGIN')
  rows=[dict(zip(('workflow','nodo','version','version_publicada','estado','tipo','sin_error','workflow_activo','borrador_igual_publicado'),x)) for x in db.execute("""SELECT t.workflowId,t.nodeId,t.versionId,w.activeVersionId,t.status,t.triggerKind,coalesce(t.errorMessage,'')='',w.active,w.versionId=w.activeVersionId
   FROM workflow_publication_trigger_status t JOIN workflow_entity w ON w.id=t.workflowId
   WHERE w.id IN ('CooperMarcasPub1','CooperMarcasMet1') OR
    (w.id IN ('FabRadar00000001','FabAprendizaje01') AND EXISTS
     (SELECT 1 FROM json_each(w.nodes) n WHERE json_extract(n.value,'$.id')=t.nodeId AND json_extract(n.value,'$.type')='n8n-nodes-base.scheduleTrigger' AND coalesce(json_extract(n.value,'$.disabled'),0)=0))
   ORDER BY t.workflowId,t.nodeId""")]
 assert {wid:sum(x['workflow']==wid for x in rows) for wid in expected}==expected
 assert all(x['estado']=='activated' and x['sin_error']==1 and x['workflow_activo']==1 and x['borrador_igual_publicado']==1 and x['version']==x['version_publicada'] for x in rows)
 print(json.dumps({'estado':'PASS','fecha_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'consulta_solo_lectura':True,'entorno_ni_credenciales_consultados':False,'triggers':rows},ensure_ascii=False))
except BaseException as e:
 print(json.dumps({'estado':'SONDA_DETENIDA','clase':type(e).__name__}));raise SystemExit(1)
