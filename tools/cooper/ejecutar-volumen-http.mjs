// Ensayo público aislado; no inicia servicios reales ni lee configuraciones privadas.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,join,basename,dirname} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {podman,assertNoEnvFiles,N8N_IMAGE} from '../../cooper/scripts/ensayo-infra.mjs';
const raiz=resolve(import.meta.dirname,'../..');
const hash=v=>createHash('sha256').update(v).digest('hex');
const dependencias=realpathSync(process.argv[2] ?? 'cooper/node_modules');
const flags=process.argv.slice(3),compilado=flags.includes('--compilado'),diagnostico=flags.includes('--diagnostico');
assert.ok(process.argv.length>=3 && flags.every(f=>['--compilado','--diagnostico'].includes(f)) && new Set(flags).size===flags.length,'Uso: node tools/cooper/ejecutar-volumen-http.mjs /ruta/node_modules [--compilado] [--diagnostico]');
assert.equal(basename(dependencias),'node_modules');
assert.equal(hash(readFileSync(join(dirname(dependencias),'package-lock.json'))),hash(readFileSync(join(raiz,'cooper/package-lock.json'))),'Caché de dependencias de otro lockfile');
assertNoEnvFiles();
assert.equal(podman('info','--format','{{.Host.Security.Rootless}}'),'true');
assert.ok(N8N_IMAGE.startsWith('ghcr.io/n8n-io/n8n:2.47.6@sha256:'));
const ci='localhost/cooper-ci:bfd5e79283bd';
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:raiz,encoding:'utf8'}).trim();
const nombres=execFileSync('git',['ls-files'],{cwd:raiz,encoding:'utf8'}).trim().split('\n');
assert.ok(!nombres.some(n=>n.split('/').some(p=>/^\.env(?:\.|$)/.test(p) && p!=='.env.example') || /^(credentials|credenciales)\//.test(n)),'Nombre privado rechazado antes de leer el árbol');
mkdirSync(join(raiz,'.cache'),{recursive:true});
const run=mkdtempSync(join(raiz,'.cache/volumen-http-'));
const entrada=join(run,'entrada'),salida=join(run,'salida'),checkout=join(run,'checkout');
for(const p of [entrada,salida,checkout]) mkdirSync(p);
const archive=join(run,'fuentes.tar');
execFileSync('git',['archive','--format=tar','--output='+archive,revision],{cwd:raiz});
execFileSync('tar',['-xf',archive,'-C',checkout]);
const fuentes=['tools/cooper/medir-volumen-n8n.cjs','tools/cooper/volumen-fixture.cjs','tools/cooper/medir-volumen-http.mjs','tools/cooper/ejecutar-volumen-http.mjs','tools/cooper/memoria-sqlite-ensayo.c','cooper/src/servicios/puente.ts'];
for(const file of fuentes) copyFileSync(join(raiz,file),join(checkout,file));
for(const file of ['medir-volumen-n8n.cjs','volumen-fixture.cjs']) copyFileSync(join(raiz,'tools/cooper',file),join(entrada,file));
copyFileSync(join(raiz,'workflows/v2/FabCooperAPI0001.json'),join(entrada,'puente.json'));
copyFileSync(join(raiz,'contratos/cooper-tablas-produccion.json'),join(entrada,'esquema.json'));
const base=['run','--rm','--pull=never','--cpuset-cpus=2-3','--cpus=1','--memory=2g','--pids-limit=128','--cap-drop=ALL','--security-opt=no-new-privileges','--userns=keep-id','--user',process.getuid()+':'+process.getgid(),'--env','UV_THREADPOOL_SIZE=1','--env','NEXT_TELEMETRY_DISABLED=1'];
const ejecuciones=[];
function correr(nombre,args){
 const name='cooper-http-'+process.pid+'-'+nombre;
 const full=[...base,'--name',name,...args];
 const r=spawnSync('podman',full,{encoding:'utf8',timeout:12*60*1000,maxBuffer:1024*1024});
 writeFileSync(join(salida,nombre+'.log'),(r.stdout ?? '')+(r.stderr ?? ''));
 ejecuciones.push({nombre,args:full,rc:r.status,signal:r.signal});
 if(r.error || r.signal) {try{podman('rm','--force',name);}catch{}}
 console.log(r.stdout ?? '');
 if(r.status!==0){console.error(r.stderr ?? 'Proceso fallido');throw new Error('Falló '+nombre);}
}
console.log('Ensayo aislado: '+run);
const origen={revision,archivos:Object.fromEntries(fuentes.map(f=>[f,hash(readFileSync(join(raiz,f)))])),lockfile:hash(readFileSync(join(raiz,'cooper/package-lock.json'))),imagenes:[N8N_IMAGE,ci].map(imagen=>({imagen,id:podman('image','inspect','--format','{{.Id}}',imagen)})),contexto:'Sin red externa, secretos, HOME, sockets ni bases existentes; dependencias públicas reutilizadas de lockfile idéntico'};
try {
 if(diagnostico){
  mkdirSync(join(checkout,'cooper/.cache/h19-build'),{recursive:true});
  correr('compilar-diagnostico',['--network=none','--volume',checkout+':/ensayo:rw','--volume',dependencias+':/ensayo/cooper/node_modules:ro','--workdir','/ensayo/cooper','--entrypoint','cc',ci,'-shared','-fPIC','-O2','-Wall','-Wextra','-Werror','-I','node_modules/better-sqlite3/deps/sqlite3','../tools/cooper/memoria-sqlite-ensayo.c','-o','.cache/h19-build/memoria-sqlite.so']);
  origen.diagnostico={extensionSha256:hash(readFileSync(join(checkout,'cooper/.cache/h19-build/memoria-sqlite.so')))};
 }
 if(compilado){
  const programa="import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {build}=createRequire(require.resolve('tsx/package.json'))('esbuild');await build({entryPoints:['../tools/cooper/medir-volumen-http.mjs'],outfile:'.cache/h19-build/medir-volumen-http.mjs',bundle:true,packages:'external',platform:'node',format:'esm',target:'node24',tsconfig:'tsconfig.json'});";
  correr('compilar',['--network=none','--volume',checkout+':/ensayo:rw','--volume',dependencias+':/ensayo/cooper/node_modules:ro','--workdir','/ensayo/cooper','--entrypoint','node',ci,'--input-type=module','--eval',programa]);
  origen.compilacion={herramienta:'esbuild',version:JSON.parse(readFileSync(join(dependencias,'tsx/node_modules/esbuild/package.json'),'utf8')).version,bundleSha256:hash(readFileSync(join(checkout,'cooper/.cache/h19-build/medir-volumen-http.mjs'))),programa};
 }
 correr('snapshots',['--network=none','--volume',entrada+':/ensayo:ro','--volume',salida+':/salida:rw','--entrypoint','node',N8N_IMAGE,'--expose-gc','/ensayo/medir-volumen-n8n.cjs','--exportar-snapshots']);
 const actuales=JSON.parse(readFileSync(join(salida,'medicion.json'),'utf8'));
 const previos=JSON.parse(readFileSync(join(raiz,'docs/informes/evidencias/total-volumen-n8n/despues/medicion.json'),'utf8'));
 assert.equal(actuales.fixtureHash,previos.fixtureHash);
 for(const a of actuales.resultados) assert.equal(a.calentamiento.sha256,previos.resultados.find(p=>p.nombre===a.nombre).calentamiento.sha256,'Snapshot diferente al ensayo original');
 for(const caso of ['usuario-0','usuario-9','administrador','sin-recursos']) {
  const app='cooper-http-'+process.pid+'-app-'+caso;
  const appArgs=[...base.filter(v=>v!=='--rm'),'--detach','--name',app,'--network=none',...(diagnostico?['--env','COOPER_ENSAYO_SQLITE_DIAG=1']:[]),'--memory=1g','--memory-swap=1g','--volume',checkout+':/ensayo:rw','--volume',dependencias+':/ensayo/cooper/node_modules:ro','--workdir','/ensayo/cooper','--entrypoint','node',ci,...(compilado?['.cache/h19-build/medir-volumen-http.mjs']:['--import','tsx','../tools/cooper/medir-volumen-http.mjs']),'aplicacion',caso];
  const inicio=spawnSync('podman',appArgs,{encoding:'utf8',timeout:30000});
  ejecuciones.push({nombre:caso+'-aplicacion',args:appArgs,rc:inicio.status});
  assert.equal(inicio.status,0,inicio.stderr);
  try {
   correr(caso,['--network=container:'+app,'--volume',checkout+':/ensayo:ro','--volume',dependencias+':/ensayo/cooper/node_modules:ro','--volume',salida+':/snapshots:ro','--volume',salida+':/salida:rw','--workdir','/ensayo/cooper','--entrypoint','node',ci,'--expose-gc','--import','tsx','../tools/cooper/medir-volumen-http.mjs','verificador',caso]);
   const fin=spawnSync('podman',['wait',app],{encoding:'utf8',timeout:30000});
   assert.equal(fin.status,0);assert.equal(fin.stdout.trim(),'0');
  } finally {
   const estado=spawnSync('podman',['inspect','--format','{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}',app],{encoding:'utf8'});
   writeFileSync(join(salida,caso+'-contenedor.txt'),estado.stdout ?? '');
   const logs=spawnSync('podman',['logs',app],{encoding:'utf8'});
   writeFileSync(join(salida,caso+'-aplicacion.log'),(logs.stdout ?? '')+(logs.stderr ?? ''));
   try {podman('rm','--force',app);} catch {}
  }
 }
} finally {
 writeFileSync(join(salida,'origen-http.json'),JSON.stringify({...origen,ejecuciones},null,2)+'\n');
}
