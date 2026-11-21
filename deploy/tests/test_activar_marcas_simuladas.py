"""Guardas del extra separado, sin entorno ni servicios reales."""
from contextlib import closing
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
DEPLOY=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(DEPLOY))
spec=importlib.util.spec_from_file_location('activar_marcas',DEPLOY/'activar-marcas-simuladas.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class FakeOperator:
 def __init__(self,root):
  self.data=root/'datos';self.state=root/'estado';self.state.mkdir();self.engine='podman';self.env={};self.calls=[]
  self.data.mkdir();(self.data/'n8n').mkdir();(self.data/'cooper').mkdir();self.database=self.data/'n8n/database.sqlite'
  with closing(sqlite3.connect(self.database)) as db,db:
   db.executescript('CREATE TABLE workflow_entity(id TEXT PRIMARY KEY,active INTEGER,versionId TEXT,activeVersionId TEXT,versionCounter INTEGER,nodes TEXT,connections TEXT,settings TEXT); CREATE TABLE execution_entity(id TEXT,status TEXT); CREATE TABLE data_table_user_test(id TEXT); INSERT INTO data_table_user_test VALUES("sintetico");')
   for i in (*m.IDS,'Ajeno'):
    db.execute('INSERT INTO workflow_entity VALUES(?,0,?,NULL,1,?,?,?)',(i,'version-'+i,'[]','{}','{}'))
  with closing(sqlite3.connect(self.data/'cooper/cooper.sqlite')) as db,db:
   for table in ('cuentas_marca','piezas_marca','marca_ingestas'):db.execute('CREATE TABLE '+table+'(id TEXT)')
 def compose(self,*args):
  self.calls.append(args)
  if args[0]=='exec':return '{"ok":true}'
  if args[0]=='ps':return 'a'*64
  if args[0]=='run':
   wid=next(x.split('=',1)[1] for x in args if x.startswith('--id='));enabled='publish:workflow' in args
   with closing(sqlite3.connect(self.database)) as db,db:db.execute('UPDATE workflow_entity SET active=?,activeVersionId=CASE WHEN ? THEN versionId ELSE NULL END,versionCounter=versionCounter+1 WHERE id=?',(int(enabled),enabled,wid))
  return ''
 def snapshot(self,**kwargs):
  self.calls.append(('snapshot',kwargs));self.saved=self.state/'snapshot';shutil.copytree(self.data,self.saved);return 'b'*64
 def restore(self,snapshot,destination):
  result=destination/'datos';shutil.copytree(self.saved,result);return result
 def ownership(self):pass

class ActivationTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.op=FakeOperator(self.root)
  self.source=self.root/'source';self.source.mkdir()
  for wid in m.IDS:(self.source/(wid+'.json')).write_text(json.dumps({'nodes':[],'connections':{},'settings':{}}))
  self.phase={'servicios':{'cooper':'a'*64},'archivos':{'release':'b'*64}}
  self.guard=patch.object(m,'phase_guard',return_value=self.phase);self.guard.start();self.addCleanup(self.guard.stop)
 def prepare(self):return m.prepare(self.op,self.source)
 def test_prepara_solo_dos_ids_y_runtime_booleano(self):
  r=self.prepare();self.assertEqual(r['objetivos'],list(m.IDS));self.assertEqual(r['conteos'],dict.fromkeys(('cuentas_marca','piezas_marca','marca_ingestas'),0));self.assertNotIn('secret',json.dumps(r).lower())
 def test_publica_y_despublica_con_contenido_version_ajenos_preservados(self):
  before=self.prepare();r=m.change(self.op,before,self.op.state/'activar.json');self.assertEqual(r['estado'],'PASS')
  self.op.saved.rename(self.op.state/'snapshot-antes')
  r2=m.change(self.op,r,self.op.state/'revertir.json',True)
  self.assertEqual(r2['estado'],'PASS');self.assertEqual(r2['despues']['flujos']['Ajeno'],before['antes']['flujos']['Ajeno'])
  for wid in m.IDS:
   for key in ('active','version','publicada','contenido'):self.assertEqual(r2['despues']['flujos'][wid][key],before['antes']['flujos'][wid][key])
  self.assertFalse((self.op.state/'mantenimiento').exists())
 def test_rechaza_runtime_incorrecto(self):
  with patch.object(self.op,'compose',return_value='{"ok":false}'),self.assertRaises(RuntimeError):self.prepare()
 def test_rechaza_cualquier_cola_no_vacia(self):
  for table in ('cuentas_marca','piezas_marca','marca_ingestas'):
   with closing(sqlite3.connect(self.op.data/'cooper/cooper.sqlite')) as db,db:db.execute('INSERT INTO '+table+' VALUES("ficticio")')
   with self.assertRaises(RuntimeError):self.prepare()
   with closing(sqlite3.connect(self.op.data/'cooper/cooper.sqlite')) as db,db:db.execute('DELETE FROM '+table)
 def test_rechaza_ejecucion_en_curso(self):
  with closing(sqlite3.connect(self.op.database)) as db,db:db.execute('INSERT INTO execution_entity VALUES("e","running")')
  with self.assertRaises(RuntimeError):self.prepare()
 def test_rechaza_worker_publicado(self):
  with closing(sqlite3.connect(self.op.database)) as db,db:db.execute('UPDATE workflow_entity SET active=1 WHERE id=?',(m.IDS[0],))
  with self.assertRaises(RuntimeError):self.prepare()
 def test_rechaza_definicion_distinta(self):
  (self.source/(m.IDS[0]+'.json')).write_text(json.dumps({'nodes':[{'name':'distinto'}],'connections':{},'settings':{}}))
  with self.assertRaises(RuntimeError):self.prepare()
 def test_cas_rechaza_cambio_ajeno_antes_de_respaldo(self):
  r=self.prepare()
  with closing(sqlite3.connect(self.op.database)) as db,db:db.execute('UPDATE workflow_entity SET versionId="otra" WHERE id="Ajeno"')
  with self.assertRaises(RuntimeError):m.change(self.op,r,self.op.state/'a.json')
  self.assertFalse(any(c[0]=='snapshot' for c in self.op.calls))
 def test_rechaza_cambio_fase(self):
  r=self.prepare()
  with patch.object(m,'phase_guard',return_value={}),self.assertRaises(RuntimeError):m.change(self.op,r,self.op.state/'a.json')
 def test_rechaza_mantenimiento_y_salida_existente(self):
  r=self.prepare();(self.op.state/'mantenimiento').touch()
  with self.assertRaises(RuntimeError):m.change(self.op,r,self.op.state/'a.json')
  (self.op.state/'mantenimiento').unlink();(self.op.state/'a.json').write_text('{}')
  with self.assertRaises(RuntimeError):m.change(self.op,r,self.op.state/'a.json')
 def test_rechaza_recibo_alterado_y_ruta_ajena(self):
  r=self.prepare();p=self.op.state/'pre.json';m.operar.write_json(p,r)
  with self.assertRaises(RuntimeError):m.read_receipt(p,'0'*64,self.op.state,'PREPARADO')
  with self.assertRaises(RuntimeError):m.checked_path(self.root/'fuera.json',self.op.state,False)
  self.assertEqual(m.read_receipt(p,m.operar.digest(p),self.op.state,'PREPARADO'),r)
 def test_rechaza_enlace(self):
  p=self.op.state/'link';p.symlink_to(self.root/'source')
  with self.assertRaises(RuntimeError):m.checked_path(p,self.op.state,False)
 def test_reversa_automatica_preserva_datos_fallidos(self):
  r=self.prepare();original=self.op.compose
  def fail(*args):
   if args[0]=='run' and '--id='+m.IDS[1] in args:raise RuntimeError('fallo ficticio')
   return original(*args)
  with patch.object(self.op,'compose',side_effect=fail),self.assertRaises(RuntimeError):m.change(self.op,r,self.op.state/'fallo.json')
  self.assertEqual(json.loads((self.op.state/'fallo.json').read_text())['estado'],'FALLO_REVERTIDO')
  self.assertEqual(m.metadata(self.op.database),r['antes']);self.assertTrue(list(self.op.state.glob('n8n-marcas-fallido-*')))
  self.assertFalse((self.op.state/'mantenimiento').exists())
 def test_cas_repite_tras_snapshot_sin_publicar_si_cambia(self):
  r=self.prepare();snapshot=self.op.snapshot
  def race(**kwargs):
   result=snapshot(**kwargs)
   with closing(sqlite3.connect(self.op.database)) as db,db:db.execute('UPDATE workflow_entity SET versionId="race" WHERE id="Ajeno"')
   return result
  with patch.object(self.op,'snapshot',side_effect=race),self.assertRaises(RuntimeError):m.change(self.op,r,self.op.state/'race.json')
  self.assertFalse(any(c[0]=='run' for c in self.op.calls));self.assertEqual(m.metadata(self.op.database),r['antes'])
 def test_transicion_bloquea_ajeno_contenido_y_esperas(self):
  before=self.prepare()['antes']
  for kind in ('ajeno','contenido','espera'):
   after=copy.deepcopy(before)
   for wid in m.IDS:after['flujos'][wid]['active']=True;after['flujos'][wid]['publicada']=after['flujos'][wid]['version']
   if kind=='ajeno':after['flujos']['Ajeno']['contador']+=1
   if kind=='contenido':after['flujos'][m.IDS[0]]['contenido']='alterado'
   if kind=='espera':after['esperas']=['nueva']
   with self.assertRaises(RuntimeError):m.validate_transition(before,after,True)

if __name__=='__main__':unittest.main()
