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

if __name__=='__main__':unittest.main()
