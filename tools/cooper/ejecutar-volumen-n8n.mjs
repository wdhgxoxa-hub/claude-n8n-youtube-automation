// Reutiliza helpers de Podman/guardián del ensayo; no inicia startN8n ni servicios.
import {podman,assertNoEnvFiles,N8N_IMAGE} from '../../cooper/scripts/ensayo-infra.mjs';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
assertNoEnvFiles();
if (!N8N_IMAGE.startsWith('ghcr.io/n8n-io/n8n:2.47.6@sha256:')) throw new Error('Se requiere la imagen fijada 2.47.6');
if (podman('info','--format','{{.Host.Security.Rootless}}') !== 'true') throw new Error('Se requiere Podman rootless');
const raiz=resolve(import.meta.dirname,'../..');
mkdirSync(join(raiz,'.cache'),{recursive:true});
const run=mkdtempSync(join(raiz,'.cache/volumen-n8n-'));
const entrada=join(run,'entrada'),salida=join(run,'salida');
mkdirSync(entrada);mkdirSync(salida);
for(const name of ['medir-volumen-n8n.cjs','volumen-fixture.cjs']) copyFileSync(join(import.meta.dirname,name),join(entrada,name));
copyFileSync(join(raiz,'workflows/v2/FabCooperAPI0001.json'),join(entrada,'puente.json'));
copyFileSync(join(raiz,'contratos/cooper-tablas-produccion.json'),join(entrada,'esquema.json'));
const args=['run','--rm','--pull=never','--name',`cooper-volumen-${process.pid}`,'--network=none','--cpuset-cpus=8-9','--cpus=1','--memory=2g','--pids-limit=128','--cap-drop=ALL','--security-opt=no-new-privileges','--userns=keep-id','--user',`${process.getuid()}:${process.getgid()}`,'--volume',`${entrada}:/ensayo:ro`,'--volume',`${salida}:/salida:rw`,'--env','N8N_DIAGNOSTICS_ENABLED=false','--env','N8N_VERSION_NOTIFICATIONS_ENABLED=false','--env','UV_THREADPOOL_SIZE=1','--entrypoint','node',N8N_IMAGE,'--expose-gc','/ensayo/medir-volumen-n8n.cjs'];
const origen={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:raiz}).trim(),imagen:N8N_IMAGE,imagenId:podman('image','inspect','--format','{{.Id}}',N8N_IMAGE),rootless:true,args,archivos:Object.fromEntries(['medir-volumen-n8n.cjs','volumen-fixture.cjs','puente.json','esquema.json'].map(n=>[n,createHash('sha256').update(readFileSync(join(entrada,n))).digest('hex')]))};
writeFileSync(join(salida,'origen.json'),JSON.stringify(origen,null,2)+'\n');
console.log(`Ensayo aislado: ${run}`);
const result=spawnSync('podman',args,{encoding:'utf8',timeout:12*60*1000,maxBuffer:1024*1024});
writeFileSync(join(salida,'ejecucion.log'),(result.stdout || '')+(result.stderr || ''));
if (result.error || result.signal) {
  try { podman('rm','--force',`cooper-volumen-${process.pid}`); } catch { /* --rm pudo retirarlo */ }
}
console.log(result.stdout || '');
if(result.status !== 0) console.error(result.stderr || result.error?.message || 'Ensayo interrumpido');
process.exitCode=result.status ?? 1;
