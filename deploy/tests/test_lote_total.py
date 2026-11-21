import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('lote',Path(__file__).parents[1]/'preparar-n8n-total.py')
lote=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lote)

def flujo(i,n,nodes=None):
 return {'id':i,'name':n,'nodes':nodes or [],'connections':{},'settings':{},'active':True}

class LoteTest(unittest.TestCase):
 def test_conserva_ids_credenciales_y_ajustes(self):
  old=flujo('FabAjustes000001','Ajustes',[{'id':'viejo','name':'Ajustes','type':'code','parameters':{'jsCode':"return [{json:{allowVoz:true,baseUrl:'https://anterior.ngrok-free.dev'}}];"}}])
  node={'id':'nuevo','name':'Ajustes','type':'code','parameters':{'jsCode':'defaults'}}
  caller=flujo('referencia','Aux',[{'id':'n','name':'Llamar','type':'call','parameters':{'ref':'referencia'},'credentials':{'httpHeaderAuth':{'id':'ref-versionada'}}}])
  actual=flujo('destino','Aux',[{'id':'a','name':'Llamar','type':'call','parameters':{},'credentials':{'httpHeaderAuth':{'id':'ref-real'}}}])
  out,diff=lote.preparar([old,actual],[flujo(old['id'],'Ajustes',[node]),caller],'https://flujos.cooperestudio.com')
  self.assertIn('allowVoz:true',out[0]['nodes'][0]['parameters']['jsCode'])
  self.assertIn('flujos.cooperestudio.com',out[0]['nodes'][0]['parameters']['jsCode'])
  self.assertEqual(out[0]['nodes'][0]['id'],'viejo')
  self.assertEqual(out[1]['id'],'destino')
  self.assertEqual(out[1]['nodes'][0]['parameters']['ref'],'destino')
  self.assertEqual(out[1]['nodes'][0]['credentials']['httpHeaderAuth']['id'],'ref-real')
  self.assertTrue(all(not x['active'] for x in out))
  self.assertEqual(diff['republicar_originales'],['FabAjustes000001','destino'])
 def test_rechaza_nombre_ambiguo_y_origen_distinto(self):
  with self.assertRaisesRegex(ValueError,'ambiguo'):
   lote.preparar([flujo('a','F'),flujo('b','F')],[flujo('c','F')],'https://flujos.cooperestudio.com')
  with self.assertRaisesRegex(ValueError,'Origen'):
   lote.preparar([],[],'https://ajeno.test')
 def test_guard_bloquea_credencial_ausente_y_conserva_fuente(self):
  n={'id':'n','name':'Voz','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'parameters':{},'credentials':{'httpHeaderAuth':{'id':'ausente','name':'Voz privada'}},'onError':'continueRegularOutput','retryOnFail':True}
  entradas=[flujo('principal','Principal',[n])]+[flujo(w,w,[{'id':'inicio','name':'Disparador','type':'n8n-nodes-base.webhook','parameters':{}}]) for w in lote.DEPENDENCIAS_SEGURAS]
  salida,diff=lote.preparar([flujo('principal','Principal')],entradas,'https://flujos.cooperestudio.com',{'tablas':[],'credenciales':[]},True)
  guard=salida[0]['nodes'][0]
  self.assertEqual(guard['type'],'n8n-nodes-base.code')
  self.assertTrue(guard['parameters']['jsCode'].startswith('throw new Error('))
  self.assertNotIn('credentials',guard)
  self.assertNotIn('onError',guard)
  self.assertNotIn('retryOnFail',guard)
  self.assertIn('credentials',n)
  self.assertTrue(all(w['nodes'][0]['disabled'] for w in salida[1:]))
  self.assertEqual(len(diff['bloqueos_explicitos']),1)
  self.assertEqual(set(diff['plan_publicacion']),{'principal'}|lote.DEPENDENCIAS_SEGURAS)
 def test_plan_ordena_dependencias_y_rechaza_ciclos(self):
  def call(w):return {'name':'Llamar','type':'n8n-nodes-base.executeWorkflow','parameters':{'workflowId':{'value':w}}}
  ws=[flujo('a','A',[call('b')]),flujo('b','B')]+[flujo(w,w) for w in lote.DEPENDENCIAS_SEGURAS]
  orden=lote.plan_publicacion(ws,['a','b'])
  self.assertLess(orden.index('b'),orden.index('a'))
  ws[1]['nodes']=[call('a')]
  with self.assertRaisesRegex(ValueError,'Ciclo'):lote.plan_publicacion(ws,['a','b'])

if __name__=='__main__':unittest.main()
