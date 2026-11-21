// Aceptación local de la imagen final: Next real, actores ficticios y proveedor sin salida.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile), hash=v=>createHash('sha256').update(v).digest('hex');
const canon=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(process.argv[2]==='verificar'){
 const caso=process.argv[3],require=createRequire('/ensayo/cooper/package.json');
 const Database=require('better-sqlite3'),{encode}=await import(pathToFileURL(require.resolve('next-auth/jwt')).href);
 const input=await readFile('/snapshots/administrador.json');
 const original=JSON.parse(await readFile('/ensayo/docs/informes/evidencias/total-volumen-n8n/despues/medicion.json','utf8'));
 assert.equal(hash(input),original.resultados.find(r=>r.nombre==='administrador').calentamiento.sha256);
 const full=JSON.parse(input);
 const email=caso==='sin-recursos'?'nadie@example.test':`dueno${caso==='usuario-9'?9:0}@example.test`,admin=caso==='administrador';
 const database=new Database('/data/cooper.sqlite');
 assert.equal(database.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get().n,14);
 const insert=database.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)');
 const allow=database.prepare('INSERT INTO allowed_emails(email,created_at) VALUES(?,?)');
 for(let i=0;i<10;i++){const e=`dueno${i}@example.test`;insert.run('dueno-'+i,e,'Persona ficticia '+i,admin&&i===0?'admin':'usuario');allow.run(e,1);}
 insert.run('sin-recursos','nadie@example.test','Sin recursos','usuario');allow.run('nadie@example.test',1);database.close();
 const token=await encode({secret:process.env.AUTH_SECRET,salt:'authjs.session-token',token:{sub:caso==='sin-recursos'?'sin-recursos':'dueno-'+(caso==='usuario-9'?9:0),email,name:'Ensayo'},maxAge:3600});
 const headers={Cookie:'authjs.session-token='+token,Referer:'http://127.0.0.1:3000'};
 const snapshot=(owner,isAdmin)=>isAdmin?full:{canales:full.canales.filter(c=>c.dueno_email===owner),videos:full.videos.filter(v=>v.dueno_email===owner)};
 const expected=snapshot(email,admin),ids=expected.videos.map(v=>v.id).sort();
 assert.equal(ids.length,{'administrador':9896,'usuario-0':999,'usuario-9':900,'sin-recursos':0}[caso]);
 let pedidos=0,errores=0;
 const provider=createServer(async(req,res)=>{try{
  assert.equal(req.url,'/webhook/cooper/v1');assert.equal(req.method,'POST');assert.equal(req.headers.authorization,'Bearer '+process.env.COOPER_N8N_TOKEN);
  let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);assert.equal(data.evento,'estado');
  const bytes=Buffer.from(JSON.stringify(snapshot(data.dueno_email,data.admin)));pedidos++;
  res.writeHead(200,{'Content-Type':'application/json','Content-Length':bytes.length});res.end(bytes);
 }catch{errores++;res.writeHead(500).end();}});
 await new Promise(r=>provider.listen(6781,'127.0.0.1',r));
 function check(local){
  assert.deepEqual(local.videos.map(v=>v.id).sort(),ids);assert.equal(new Set(local.videos.map(v=>v.id)).size,ids.length);assert.equal(local.channels.length,expected.canales.length);
  const owner=id=>id==='sin-recursos'?'nadie@example.test':`dueno${Number(id.slice(6))}@example.test`;
  const vs=new Map(local.videos.map(v=>[v.id,v])),cs=new Map(local.channels.map(c=>[c.id,c]));
  const videos=expected.videos.map(r=>{const v=vs.get(r.id),o={id:v.id,dueno_email:owner(v.ownerId),canal_id:v.channelId,titulo:v.title,stage:v.stage,script:v.script,actualizado_en:v.remoteUpdatedAt,modo_noticia:v.newsMode,observabilidad:v.observabilidad};return Object.fromEntries(Object.keys(r).map(k=>[k,o[k]]));});
  const canales=expected.canales.map(r=>{const c=cs.get(r.id),o={id:c.id,dueno_email:owner(c.ownerId),nombre:c.name,nicho:c.niche,lecciones:c.lecciones,modo_noticia:c.newsMode};return Object.fromEntries(Object.keys(r).map(k=>[k,o[k]]));});
  assert.equal(hash(canon(videos)),hash(canon(expected.videos)));assert.equal(hash(canon(canales)),hash(canon(expected.canales)));
  return {videos:hash(canon(videos)),canales:hash(canon(canales))};
 }
 const sincronizaciones=[],lecturas=[];
 try{
  for(let i=0;i<5;i++){
   const before=pedidos,start=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
   let seen=false,buffer='';
   try{
    const response=await fetch('http://127.0.0.1:3000/api/eventos',{headers,signal:controller.signal});assert.equal(response.status,200);
    const reader=response.body.getReader();const decoder=new TextDecoder();
    while(!seen){const {value,done}=await reader.read();assert.ok(!done,'SSE sin estado completo');buffer+=decoder.decode(value,{stream:true});let end;
     while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);assert.ok(!event.includes('event: fallo'),'SSE con fallo');if(event.startsWith('event: estado\n')){const local=JSON.parse(event.slice('event: estado\ndata: '.length));check(local);seen=true;break;}}
    }
   }finally{clearTimeout(timer);controller.abort();}
   assert.ok(seen);assert.equal(pedidos-before,admin?11:1,'No ocultar reintentos ni dueños');
   sincronizaciones.push({muestra:i,ms:performance.now()-start,pedidos:pedidos-before,videos:ids.length});
  }
  for(let i=0;i<3;i++){
   const start=performance.now(),r=await fetch('http://127.0.0.1:3000/api/estado',{headers,signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);
   const bytes=Buffer.from(await r.arrayBuffer()),local=JSON.parse(bytes.toString());const huellas=check(local);
   lecturas.push({muestra:i,ms:performance.now()-start,bytes:bytes.length,sha256:hash(bytes),videos:ids.length,huellas});
  }
  assert.equal(new Set(lecturas.map(v=>v.sha256)).size,1);assert.equal(errores,0);
  const result={estado:'PASS',caso,videos:ids.length,pedidos,erroresProveedor:errores,reintentos:0,sincronizaciones,lecturas,topologia:'Next standalone real y proveedor/verificador en cgroups separados; solo loopback; sesión y usuarios sintéticos; ninguna ruta añadida'};
  await writeFile('/salida/'+caso+'.json',JSON.stringify(result,null,2)+'\n');
 }finally{await new Promise(r=>provider.close(r));}
}else{
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
 const image=process.argv[2],run=resolve(process.argv[3]??'');
 assert.match(image??'',/^localhost\/cooper:[a-f0-9]{40}$/);assert.ok(run.startsWith('/home/david/.cache/cooper-ti-operacion-'));
 const ci='localhost/cooper-ci:bfd5e79283bd',source=resolve(root,'deploy/tests/h19-imagen.mjs');
 const appId=(await exec('podman',['image','inspect',image,'--format','{{.Id}}'])).stdout.trim();
 const base=['--pull=never','--cpuset-cpus=16-23','--cpus=1','--pids-limit=256','--cap-drop=ALL','--security-opt=no-new-privileges','--userns=keep-id','--user',process.getuid()+':'+process.getgid()];
 const results=[];
 for(const caso of ['administrador','usuario-0','usuario-9','sin-recursos']){
  const data=resolve(run,'datos-'+caso);await mkdir(data,{recursive:true,mode:0o700});
  const name='cooper-h19-'+process.pid+'-'+caso;
  const env={PATH:process.env.PATH,HOME:process.env.HOME,...(process.env.XDG_RUNTIME_DIR?{XDG_RUNTIME_DIR:process.env.XDG_RUNTIME_DIR}:{}),AUTH_SECRET:randomBytes(32).toString('hex'),COOPER_N8N_TOKEN:randomBytes(32).toString('hex')};
  const args=['run','-d','--name',name,...base,'--network=none','--memory=1g','--memory-swap=1g','--read-only','--tmpfs','/tmp:rw,size=128m,mode=1777','--tmpfs','/app/.next/cache:rw,size=64m,mode=1777','-v',data+':/data:rw','-e','AUTH_SECRET','-e','COOPER_N8N_TOKEN','-e','AUTH_URL=http://127.0.0.1:3000','-e','AUTH_TRUST_HOST=true','-e','COOPER_DATABASE_PATH=/data/cooper.sqlite','-e','COOPER_ADMIN_EMAIL=dueno0@example.test','-e','COOPER_N8N_URL=http://127.0.0.1:6781/webhook/cooper/v1','-e','COOPER_FABRICA=n8n'];
  for(const n of ['CHAT','MARCAS','MENSAJERIA','AVATAR','VOZ_CLONADA','VOZ_CATALOGO','TRANSCRIPCION'])args.push('-e','COOPER_'+n+'=simulada');args.push(image);
  let done=false;
  try{
   await exec('podman',args,{env});
   let ready=false;for(let i=0;i<90&&!ready;i++){try{await exec('podman',['exec',name,'node','-e',"fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],{env});ready=true;}catch{await sleep(500);}}assert.ok(ready);
   const memoryCode="const fs=require('node:fs');console.log(JSON.stringify(Object.fromEntries(['memory.max','memory.swap.max','memory.current','memory.peak','memory.events','memory.swap.current'].map(n=>[n,fs.readFileSync('/sys/fs/cgroup/'+n,'utf8').trim()]))))";
   const memory=async()=>JSON.parse((await exec('podman',['exec',name,'node','-e',memoryCode],{env})).stdout);
   const before=await memory();assert.equal(before['memory.max'],'1073741824');assert.equal(before['memory.swap.max'],'0');
   const tester=['run','--rm',...base,'--network=container:'+name,'--memory=2g','--memory-swap=2g','--tmpfs','/sys:ro,size=1m','-e','AUTH_SECRET','-e','COOPER_N8N_TOKEN','-v',root+':/ensayo:ro','-v',resolve(root,'cooper/node_modules')+':/ensayo/cooper/node_modules:ro','-v',run+'/salida:/snapshots:ro','-v',run+'/resultados:/salida:rw','-v',data+':/data:rw','--workdir','/ensayo/cooper','--entrypoint','node',ci,'/ensayo/deploy/tests/h19-imagen.mjs','verificar',caso];
   const r=await exec('podman',tester,{env,timeout:600000,maxBuffer:1024*1024});assert.equal(r.stderr,'');
   const after=await memory();assert.equal(after['memory.swap.current'],'0');assert.ok(!/^(?:oom|oom_kill) [1-9]/m.test(after['memory.events']));
   const state=(await exec('podman',['inspect',name,'--format','{{.State.OOMKilled}} {{.State.Status}} {{.Image}}'],{env})).stdout.trim();assert.equal(state,'false running '+appId);
   await exec('podman',['exec',name,'node','-e',"fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1))"],{env});
   results.push({caso,estado:'PASS',memoria_antes:before,memoria_despues:after,contenedor:state,recibo:caso+'.json'});done=true;
  }finally{
   const logs=await exec('podman',['logs',name],{env}).catch(()=>({stdout:'',stderr:''}));await writeFile(resolve(run,'resultados',caso+'-aplicacion.log'),logs.stdout+logs.stderr);
   await exec('podman',['rm','-f','--time','15',name],{env}).catch(()=>{});
   await writeFile(resolve(run,'resultado-imagen.json'),JSON.stringify({estado:done&&results.length===4?'PASS':'INCOMPLETO',imagen:image,image_id:appId,arnes_sha256:hash(await readFile(source)),resultados:results},null,2)+'\n');
  }
 }
 console.log(JSON.stringify({estado:'PASS',imagen:image,casos:results.length}));
}
