import copy
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

DEPLOY=Path(__file__).parents[1]
sys.path.insert(0,str(DEPLOY))
spec=importlib.util.spec_from_file_location('radar_resolver_test',DEPLOY/'preparar-radar-resolver.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)


def node(name,kind,parameters):
    return {'id':name,'name':name,'type':'n8n-nodes-base.'+kind,'parameters':parameters}


class RadarResolverTest(unittest.TestCase):
    def setUp(self):
        settings={'saveDataSuccessExecution':'none','saveDataErrorExecution':'none','saveManualExecutions':False,'saveExecutionProgress':False}
        self.current=[];self.source=[]
        for cid,name in mod.CANONICOS.items():
            nodes=[node(mod.CODIGOS[cid],'code',{'jsCode':'return anterior;'})] if cid in mod.CODIGOS else [node('Inicio','executeWorkflowTrigger',{'inputSource':'passthrough'}),node('Ajustes','executeWorkflow',{'workflowId':{'value':'ajusteReal'}})]
            if cid=='FabRadar00000001':nodes.append({**node('Cron','scheduleTrigger',{'rule':{}}),'disabled':True})
            flow={'id':'apiReal' if cid=='FabCooperAPI0001' else cid,'name':name,'active':True,'nodes':nodes,'connections':{},'settings':settings.copy(),'staticData':None,'pinData':None,
                  'versionId':'version-inicial','activeVersionId':'version-inicial'}
            self.current.append(flow)
            source=copy.deepcopy(flow);source['id']=cid
            if cid in mod.CODIGOS:source['nodes'][0]['parameters']['jsCode']='return nuevo;'
            self.source.append(source)
        self.current.append({'id':'ajusteReal','name':'Ajustes ficticios','active':True})
        self.metadata={'tablas':[],'credenciales':[]}

    def prepare(self):return mod.preparar(self.current,self.source,self.metadata)

    def database(self, path):
        with closing(sqlite3.connect(path)) as db,db:
            db.execute('CREATE TABLE workflow_entity(id TEXT,name TEXT,nodes TEXT,connections TEXT,settings TEXT,staticData TEXT,pinData TEXT,active INTEGER,versionId TEXT,activeVersionId TEXT)')
            for w in self.current[:3]:
                db.execute('INSERT INTO workflow_entity VALUES(?,?,?,?,?,?,?,?,?,?)',[w['id'],w['name']]+[json.dumps(w[k]) if w[k] is not None else None for k in mod.api.FIELDS[1:]]+[int(w['active']),w['versionId'],w['activeVersionId']])

    def test_tres_objetivos_y_dos_cambios_minimos_con_hijo_primero(self):
        old=copy.deepcopy(self.current)
        entry,diff=self.prepare()
        self.assertEqual(old,self.current)
        self.assertEqual(diff['plan_publicacion'],['FabCompYouTube01','FabRadar00000001','apiReal'])
        self.assertEqual(mod.validar_contrato(entry,diff),set(diff['plan_publicacion']))
        radar=next(w for w in entry if w['id']=='FabRadar00000001')
        self.assertTrue(radar['nodes'][1]['disabled'])
        self.assertTrue(all(w['active'] is False for w in entry))

    def test_rechaza_objetivo_ajeno_duplicado_orden_y_plan_incompleto(self):
        entry,diff=self.prepare()
        for kind in ('ajeno','duplicado','orden','incompleto'):
            a=copy.deepcopy(entry);d=copy.deepcopy(diff)
            if kind=='ajeno':a[0]['id']='externo'
            if kind=='duplicado':a.append(copy.deepcopy(a[0]))
            if kind=='orden':d['plan_publicacion'].reverse()
            if kind=='incompleto':d['objetivos'].pop('FabRadar00000001')
            with self.subTest(kind=kind),self.assertRaises(RuntimeError):mod.validar_contrato(a,d)

    def test_rechaza_cambios_fuera_de_codigo_y_despausa(self):
        entry,diff=self.prepare()
        for cid in mod.CODIGOS:
            a=copy.deepcopy(entry);w=next(w for w in a if w['id']==diff['objetivos'][cid]);w['settings']['saveManualExecutions']=True
            with self.subTest(cid=cid),self.assertRaises(RuntimeError):mod.validar_contrato(a,diff)
        a=copy.deepcopy(entry);next(w for w in a if w['id']=='FabRadar00000001')['nodes'][1]['disabled']=False
        with self.assertRaises(RuntimeError):mod.validar_contrato(a,diff)

    def test_rechaza_hijo_con_entrada_externa_y_http_arbitrario_aun_con_huella_actualizada(self):
        entry,diff=self.prepare()
        for kind in ('entrada','host','retry','logs','dinamico'):
            a=copy.deepcopy(entry);d=copy.deepcopy(diff);child=a[0]
            if kind=='entrada':child['nodes'].append(node('Externa','webhook',{}))
            if kind=='host':child['nodes'].append(node('Otro','httpRequest',{'method':'POST','url':'https://example.com'}))
            if kind=='retry':child['nodes'].append({**node('MCP','httpRequest',{'method':'POST','url':'https://mcp.vidiq.com/mcp'}),'retryOnFail':True})
            if kind=='logs':child['settings']['saveDataSuccessExecution']='all'
            if kind=='dinamico':child['nodes'][1]['parameters']['workflowId']['value']='={{ $json.destino }}'
            d['hijo_despues_sha256']=mod.api.digest(mod.api.state(child))
            with self.subTest(kind=kind),self.assertRaises(RuntimeError):mod.validar_contrato(a,d)

    def test_no_crea_objetivos_ni_abre_dependencias_inactivas(self):
        self.current[0]['active']=False
        with self.assertRaises(RuntimeError):self.prepare()
        self.current[0]['active']=True;self.current[-1]['active']=False
        with self.assertRaises(RuntimeError):self.prepare()
        self.current[-1]['active']=True;self.current.pop(1)
        with self.assertRaises(RuntimeError):self.prepare()

    def test_estado_previo_y_posterior_exactos_para_los_tres(self):
        entry,diff=self.prepare()
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'db.sqlite'
            self.database(path)
            mod.validar_actual(path,diff)
            with closing(sqlite3.connect(path)) as db,db:
                for w in entry:
                    db.execute('UPDATE workflow_entity SET nodes=?,connections=?,settings=?,staticData=?,pinData=? WHERE id=?',[json.dumps(w[k]) if w[k] is not None else None for k in mod.api.FIELDS[1:]]+[w['id']])
            mod.validar_actual(path,diff,despues=True)
            with self.assertRaises((RuntimeError,ValueError)):mod.validar_actual(path,diff)

    def test_cas_rechaza_edicion_y_republicacion_sin_cambiar_activo(self):
        _,diff=self.prepare()
        for field,value in [('versionId','otra'),('activeVersionId','otra'),('active',0),
                            ('settings','{}'),('connections','{"cambio":[]}'),('nodes','[]')]:
            with self.subTest(field=field),tempfile.TemporaryDirectory() as folder:
                path=Path(folder)/'db.sqlite';self.database(path)
                with closing(sqlite3.connect(path)) as db,db:
                    db.execute('UPDATE workflow_entity SET '+field+'=? WHERE id=?',(value,'apiReal'))
                with self.assertRaises(ValueError):mod.validar_actual(path,diff)

    def test_exige_cas_completo_y_export_con_versiones(self):
        entry,diff=self.prepare()
        for field in ('estado_antes_sha256','contenido_despues_sha256'):
            changed=copy.deepcopy(diff);changed['flujos_cas'][0].pop(field)
            with self.subTest(field=field),self.assertRaises(RuntimeError):mod.validar_contrato(entry,changed)
        self.current[0].pop('versionId')
        with self.assertRaises(ValueError):self.prepare()

    def test_http_vidiq_sin_retry_explicito_conserva_fiabilidad(self):
        child=next(w for w in self.source if w['id']==mod.HIJO)
        child['nodes'].append(node('MCP','httpRequest',{'method':'POST','url':'https://mcp.vidiq.com/mcp',
            'options':{'batching':{'batch':{'batchSize':1,'batchInterval':1100}}}}))
        entry,diff=self.prepare()
        self.assertEqual(mod.validar_contrato(entry,diff),set(diff['plan_publicacion']))
        self.assertNotIn('retryOnFail',next(n for n in entry[0]['nodes'] if n['name']=='MCP'))

    def test_fuente_integrada_real_con_vidiq_y_fiabilidad(self):
        self.source=[json.loads((DEPLOY.parent/'workflows/v2'/f'{cid}.json').read_text()) for cid in mod.CANONICOS]
        self.current=copy.deepcopy(self.source)
        for flow in self.current:
            flow.update(active=True,versionId='fixture',activeVersionId='fixture')
        child=next(w for w in self.source if w['id']==mod.HIJO)
        references={n['parameters']['workflowId']['value'] for n in child['nodes'] if n['type']=='n8n-nodes-base.executeWorkflow'}
        for wid in references-set(mod.CANONICOS):self.current.append({'id':wid,'name':'Dependencia ficticia '+wid,'active':True})
        self.metadata['credenciales']=[{'id':ref['id'],'name':ref['name'],'type':kind}
            for n in child['nodes'] for kind,ref in n.get('credentials',{}).items()]
        entry,diff=self.prepare()
        self.assertEqual(mod.validar_contrato(entry,diff),set(diff['plan_publicacion']))
        prepared=next(w for w in entry if w['id']==mod.HIJO)
        self.assertEqual(prepared['settings']['executionTimeout'],330)
        self.assertEqual(sum(n['type']=='n8n-nodes-base.httpRequest' and n['parameters']['url']=='https://mcp.vidiq.com/mcp' for n in prepared['nodes']),6)

    def test_rechaza_fuentes_o_actuales_ambiguos(self):
        self.current.append(copy.deepcopy(self.current[0]))
        with self.assertRaises(ValueError):self.prepare()

    def test_aplicador_cas_antes_del_respaldo_y_otra_vez_antes_de_importar(self):
        spec=importlib.util.spec_from_file_location('aplicar_cas_radar',DEPLOY/'aplicar-n8n-total.py')
        app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
        entry,diff=self.prepare();esquema=app.modulo_ensayo().esquema
        for moment in ('antes','durante_snapshot'):
            with self.subTest(moment=moment),tempfile.TemporaryDirectory() as folder:
                root=Path(folder);data=root/'datos';state=root/'estado';backup=root/'respaldo'
                (data/'n8n').mkdir(parents=True);state.mkdir();path=data/'n8n/database.sqlite';self.database(path)
                a,m,p=[root/name for name in ('entrada.json','manifiesto.json','plan.json')]
                for target,value in ((a,entry),(m,{}),(p,diff['plan_publicacion'])):target.write_text(json.dumps(value))
                proof={'aplicacion':'PASS','reversion':'PASS','publicacion':'PASS','flujos_importados':3,
                       'publicados':diff['plan_publicacion'],'entrada_sha256':mod.operar.digest(a),
                       'manifiesto_sha256':mod.operar.digest(m),'publicar_sha256':mod.operar.digest(p),
                       'contrato_productivo_sha256':mod.operar.digest(esquema.CONTRACT),
                       'comparador_esquema_sha256':mod.operar.digest(esquema.CHECKER),
                       'puerta_esquema_sha256':mod.operar.digest(Path(esquema.__file__))}
                events=[]
                def concurrent_change():
                    with closing(sqlite3.connect(path)) as db,db:
                        db.execute("UPDATE workflow_entity SET versionId='edicion-concurrente' WHERE id='apiReal'")
                def snapshot(**_):
                    events.append(('snapshot',));concurrent_change();shutil.copytree(data,backup);return 'a'*64
                op=SimpleNamespace(data=data,state=state,snapshot=snapshot,compose=lambda *args:events.append(args),
                                   restore=lambda *_:backup,ownership=lambda:None)
                if moment=='antes':concurrent_change()
                validator=SimpleNamespace(esquema=esquema,inventory=lambda *_:{})
                output=state/'resultado.json'
                with patch.object(app,'modulo_ensayo',return_value=validator),patch.object(app.os,'chown'):
                    with self.assertRaisesRegex(ValueError,'versiones cambiaron'):
                        app.aplicar(op,a,diff,proof,m,output,p)
                self.assertFalse(any('import:workflow' in event for event in events))
                self.assertEqual(('snapshot',) in events,moment=='durante_snapshot')
                self.assertFalse((state/'mantenimiento').exists())
                if moment=='durante_snapshot':self.assertEqual(json.loads(output.read_text())['estado'],'FALLO_REVERTIDO')

    def test_aplicador_exige_publicaciones_y_huellas_certificadas(self):
        spec=importlib.util.spec_from_file_location('aplicar_radar',DEPLOY/'aplicar-n8n-total.py')
        app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
        entry,diff=self.prepare()
        with tempfile.TemporaryDirectory() as folder:
            a,m,p=[Path(folder)/n for n in ('entrada.json','manifest.json','plan.json')]
            for path,value in ((a,entry),(m,{}),(p,diff['plan_publicacion'])):path.write_text(json.dumps(value))
            proof={'aplicacion':'PASS','reversion':'PASS','publicacion':'PASS','flujos_importados':3,'publicados':diff['plan_publicacion'],'entrada_sha256':mod.operar.digest(a),'manifiesto_sha256':mod.operar.digest(m),'publicar_sha256':mod.operar.digest(p)}
            self.assertEqual(app.validar_entradas(a,diff,proof,m,p),(set(diff['plan_publicacion']),diff['plan_publicacion']))
            proof['publicacion']='PENDIENTE'
            with self.assertRaises(RuntimeError):app.validar_entradas(a,diff,proof,m,p)


if __name__=='__main__':unittest.main()
