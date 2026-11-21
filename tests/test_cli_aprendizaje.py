"""La CLI aislada rechaza producción y limpia su runner aunque falle el ensayo."""
from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch, Mock

spec=importlib.util.spec_from_file_location('cli_aislada',Path(__file__).resolve().parents[1]/'tools/cooper/ejecutar_cli_aislada.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class CliAislada(unittest.TestCase):
 def test_radar_solo_recibe_url_publica_adicional(self):
  base=mod.configuracion('CoopEnsayoApr01')['task-runners'][0]
  radar=mod.configuracion('CoopRadarReal001')['task-runners'][0]
  self.assertEqual(set(radar['allowed-env'])-set(base['allowed-env']),{'PUENTE_CODEX_URL'})
  self.assertFalse(any('TOKEN' in k for k in radar['allowed-env']))
  self.assertEqual(base['env-overrides']['N8N_BLOCK_ENV_ACCESS_IN_NODE'],'true')
  self.assertEqual(mod.CONFIG['task-runners'][0],base)

 def test_no_permite_workflows_de_produccion(self):
  with patch.object(mod.subprocess,'run') as run:
   with self.assertRaises(ValueError): mod.ejecutar('FabPublicacion01')
   run.assert_not_called()

 def test_runner_externo_y_limpieza_despues_de_timeout(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=Path(tmp)/'metadata.sqlite'
   with closing(sqlite3.connect(db)) as c:
    c.execute('CREATE TABLE execution_entity(id INTEGER,status TEXT,workflowId TEXT)')
   llamados=[]
   def run(cmd,**kw):
    llamados.append((cmd,kw))
    if 'execute' in cmd:
     self.assertEqual(kw['stdout'],subprocess.DEVNULL)
     self.assertEqual(kw['stderr'],subprocess.DEVNULL)
     self.assertIn('N8N_RUNNERS_BROKER_PORT=5689',cmd)
     self.assertNotIn('N8N_RUNNERS_MODE=internal',cmd)
     raise subprocess.TimeoutExpired(cmd,300)
    return Mock(returncode=0)
   runner=Mock()
   with patch.object(mod.subprocess,'run',side_effect=run),patch.object(mod.subprocess,'Popen',return_value=runner) as popen:
    with self.assertRaises(subprocess.TimeoutExpired): mod.ejecutar('CoopEnsayoApr01',db.as_uri()+'?mode=ro')
   self.assertEqual(popen.call_args.kwargs['stdout'],subprocess.DEVNULL)
   self.assertEqual(popen.call_args.kwargs['stderr'],subprocess.DEVNULL)
   self.assertIn('N8N_RUNNERS_TASK_BROKER_URI=http://n8n:5689',popen.call_args.args[0])
   self.assertTrue(any('kill -TERM' in str(cmd) for cmd,kw in llamados))
   self.assertEqual(llamados[-1][0][-2:],['-f','/tmp/cooper-ensayo-runner.json'])
   runner.wait.assert_called_once_with(timeout=50)
   self.assertFalse(any('TOKEN' in k for k in mod.CONFIG['task-runners'][0]['allowed-env']))


if __name__=='__main__': unittest.main()
