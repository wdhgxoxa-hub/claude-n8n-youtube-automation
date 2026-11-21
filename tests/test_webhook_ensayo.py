import copy
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('webhook_ensayo',Path(__file__).resolve().parents[1]/'tools/cooper/preparar_webhook_ensayo.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Ensayo(unittest.TestCase):
 def base(self): return {'id':'CoopEnsayoApr01','nodes':[{'name':'Inicio','type':'n8n-nodes-base.manualTrigger'}],'settings':{'saveDataErrorExecution':'all','errorWorkflow':'ajeno'}}
 def test_solo_prefijo_interno_y_entrada_fija(self):
  w,p=m.preparar(self.base());self.assertTrue(p.startswith('cooper/v1/ensayo-'));self.assertFalse(w['active'])
  self.assertEqual(w['nodes'][0]['parameters']['responseMode'],'onReceived')
  self.assertEqual(w['settings']['saveDataErrorExecution'],'none');self.assertNotIn('errorWorkflow',w['settings'])
 def test_rechaza_produccion_y_entradas_adicionales(self):
  w=self.base();w['id']='FabPublicacion01'
  with self.assertRaises(ValueError):m.preparar(w)
  w=self.base();w['nodes'].append({'type':'n8n-nodes-base.scheduleTrigger'})
  with self.assertRaises(ValueError):m.preparar(w)
if __name__=='__main__':unittest.main()
