import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('esquema',ROOT/'tools/cooper/comparar_esquema_productivo.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class EsquemaProductivo(unittest.TestCase):
 def setUp(self):
  self.contrato=json.loads((ROOT/'contratos/cooper-tablas-produccion.json').read_text())
  self.actual={'tablas':[{'id':n,'nombre':n,'columnas':copy.deepcopy(c)} for n,c in self.contrato['tablas'].items()],'referencias':[]}
 def test_esquema_completo_y_aliases_no_exigen_campos_de_ensayo(self):
  for t in self.actual['tablas']:
   if t['nombre']=='fab_youtube':t['nombre']='youtube'
   if t['nombre']=='fab_publicaciones':t['nombre']='publicaciones'
  self.assertTrue(mod.comparar(self.actual,self.contrato)['ok'])
  self.assertNotIn('access_token',self.contrato['tablas']['fab_youtube'])
  self.assertNotIn('zona_horaria',self.contrato['tablas']['fab_canales'])
 def test_eventos_heredados_bloquean_despliegue_y_filtro(self):
  t=next(t for t in self.actual['tablas'] if t['nombre']=='fab_eventos')
  for campo in ['canal_id','evento']:t['columnas'].pop(campo)
  self.actual['referencias']=[{'workflow':'Vigilante','nodo':'Ejecución fallida','tabla_id':'fab_eventos','filtros':['evento'],'campos_mapeados':[]}]
  r=mod.comparar(self.actual,self.contrato)
  self.assertFalse(r['ok']);self.assertEqual({x['columna'] for x in r['columnas_faltantes']},{'canal_id','evento'});self.assertEqual(r['referencias_incompatibles'][0]['columna'],'evento')
 def test_tipo_incorrecto_no_se_corrige_silenciosamente(self):
  self.actual['tablas'][0]['columnas'][next(iter(self.actual['tablas'][0]['columnas']))]='number'
  self.assertFalse(mod.comparar(self.actual,self.contrato)['ok'])
 def test_referencia_a_tabla_ausente_falla_aun_sin_filtros(self):
  self.actual['referencias']=[{'workflow':'Lectura','nodo':'Todos','tabla_id':'ausente','filtros':[],'campos_mapeados':[]}]
  r=mod.comparar(self.actual,self.contrato)
  self.assertFalse(r['ok']);self.assertFalse(r['referencias_incompatibles'][0]['tabla_presente'])
 def test_selector_confirmar_revisa_ambas_columnas(self):
  self.actual['referencias']=[{'workflow':'Confirmar','nodo':'Recientes','tabla_id':'fab_publicaciones','filtros':["={{ $('Consulta de Cooper').isExecuted ? 'video_id' : 'createdAt' }}"],'campos_mapeados':[]}]
  self.assertTrue(mod.comparar(self.actual,self.contrato)['ok'])
  self.actual['referencias'][0]['filtros']=['={{ desconocido }}']
  self.assertFalse(mod.comparar(self.actual,self.contrato)['ok'])

if __name__=='__main__':unittest.main()
