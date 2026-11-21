// Ensayo aislado: aplicación y proveedor/verificador en cgroups distintos; datos ficticios.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {createServer,request} from 'node:http';
import {createReadStream,mkdirSync,mkdtempSync,readFileSync,writeFileSync,statSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {Readable} from 'node:stream';
import {performance} from 'node:perf_hooks';
const [modo,nombre]=process.argv.slice(2);
assert.ok(['aplicacion','verificador'].includes(modo));
assert.ok(['usuario-0','usuario-9','administrador','sin-recursos'].includes(nombre));
if(modo==='verificador') assert.ok(globalThis.gc,'El verificador requiere --expose-gc');
else assert.equal(globalThis.gc,undefined,'La aplicación no debe exponer GC artificial');
const hash=v=>createHash('sha256').update(v).digest('hex');
const canon=v=>JSON.stringify(v,(_k,x)=>x && typeof x==='object' && !Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const mib=n=>n/2**20;
const cgroup=()=>Object.fromEntries(['memory.current','memory.peak','memory.max','memory.events','memory.swap.current','memory.swap.peak','memory.swap.max','cpu.max','cpuset.cpus.effective'].filter(k=>existsSync('/sys/fs/cgroup/'+k)).map(k=>[k,readFileSync('/sys/fs/cgroup/'+k,'utf8').trim()]));
const {esperados,dueno}=await import('./volumen-fixture.cjs');
const email=nombre==='sin-recursos'?'nadie@example.test':dueno(nombre==='usuario-9'?9:0);
const auth={admin:nombre==='administrador',dueno_email:email};
const ids=esperados(auth);
const token='ensayo-h19-ficticio-sin-acceso-externo'; // No es ni procede de una credencial real.
async function escuchar(s,port){await new Promise(r=>s.listen(port,'127.0.0.1',r));assert.equal(s.keepAliveTimeout,5000);}
let memoriaSqlite=()=>undefined;
const estadoProceso=()=>{const m=process.memoryUsage();return {heapMiB:mib(m.heapUsed),heapTotalMiB:mib(m.heapTotal),externalMiB:mib(m.external),arrayBuffersMiB:mib(m.arrayBuffers),rssMiB:mib(m.rss),sqlite:memoriaSqlite(),cgroup:cgroup()};};
if(modo==='aplicacion') {
 mkdirSync('.cache',{recursive:true});process.env.COOPER_DATABASE_PATH=resolve(mkdtempSync('.cache/http-aplicacion-'),'cooper.sqlite');
 process.env.AUTH_SECRET=randomBytes(32).toString('hex');process.env.AUTH_URL='http://127.0.0.1:6780';process.env.COOPER_DEMO='0';
 for(const name of ['FABRICA','CHAT','MARCAS','MENSAJERIA','AVATAR','VOZ_CLONADA','VOZ_CATALOGO','TRANSCRIPCION']) process.env['COOPER_'+name]='simulada';
 process.env.COOPER_N8N_URL='http://127.0.0.1:6781/webhook/cooper/v1';process.env.COOPER_N8N_TOKEN=token;
 const {db}=await import('../../cooper/src/db/index.ts');
 const {users,whatsappOutbox}=await import('../../cooper/src/db/schema.ts');
 const {FabricaN8n}=await import('../../cooper/src/servicios/fabrica.ts');
 const {estado}=await import('../../cooper/src/servicios/datos.ts');
 const {json}=await import('../../cooper/src/lib/http.ts');
 for(let i=0;i<10;i++)db().insert(users).values({id:'dueno-'+i,email:dueno(i),name:'Persona ficticia '+i,role:auth.admin && i===0?'admin':'usuario'}).run();
 db().insert(users).values({id:'sin-recursos',email:'nadie@example.test',name:'Sin recursos'}).run();
 const user=db().select().from(users).all().find(u=>u.email===email),fabrica=new FabricaN8n();
 const sincronizaciones=[],lecturas=[],transportes=[];
 if(process.env.COOPER_ENSAYO_SQLITE_DIAG==='1'){
  db().$client.loadExtension(resolve('.cache/h19-build/memoria-sqlite.so'));
  const lectura=db().$client.prepare('SELECT cooper_memoria_sqlite() AS valor');
  const preparar=db().$client.prepare.bind(db().$client),conteos=new Map();let preparadas=0;
  db().$client.prepare=(sql)=>{const id=hash(sql);conteos.set(id,(conteos.get(id)??0)+1);preparadas++;return preparar(sql);};
  memoriaSqlite=()=>({...JSON.parse(lectura.get().valor),preparadas,huellasSql:[...conteos].map(([sha256,cantidad])=>({sha256,cantidad}))});
 }
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,opciones)=>{
  assert.equal(String(input),process.env.COOPER_N8N_URL,'Red externa rechazada');
  const t=performance.now(),response=await originalFetch(input,opciones),cabecerasMs=performance.now()-t;
  const original=response.json.bind(response);
  response.json=async()=>{const t0=performance.now(),data=await original();transportes.push({http:response.status,cabecerasMs,cuerpoParseMs:performance.now()-t0,totalMs:performance.now()-t,bytesDeclarados:Number(response.headers.get('content-length')),signalPresente:Boolean(opciones?.signal)});return data;};
  return response;
 };
 let errores=0;
 const server=createServer(async(req,res)=>{
  try {
   if(req.url==='/salud'){res.writeHead(200).end('{}');return;}
   if(req.url==='/ensayo/sincronizar' && req.method==='POST'){
    const antes=estadoProceso();
    console.log(JSON.stringify({etapa:'sincronizar',muestra:sincronizaciones.length,momento:'antes',...antes}));
    const t=performance.now();await fabrica.sincronizar(user);
    const ms=performance.now()-t,despues=estadoProceso();
    sincronizaciones.push({ms,antes,despues,heapDeltaMiB:despues.heapMiB-antes.heapMiB});
    console.log(JSON.stringify({etapa:'sincronizar',muestra:sincronizaciones.length-1,momento:'despues',ms,...despues}));res.writeHead(200).end('{}');return;
   }
   if(req.url==='/api/estado' && req.method==='GET'){
    const antes=estadoProceso();console.log(JSON.stringify({etapa:'leer_estado',muestra:lecturas.length,momento:'antes',...antes}));const t=performance.now();const datos=estado(user),t1=performance.now();const response=json(datos),t2=performance.now();
    lecturas.push({lecturaMs:t1-t,serializacionMs:t2-t1,antes,despues:estadoProceso()});
    console.log(JSON.stringify({etapa:'leer_estado',muestra:lecturas.length-1,momento:'serializado',...estadoProceso()}));
    res.writeHead(response.status,Object.fromEntries(response.headers));Readable.fromWeb(response.body).pipe(res);return;
   }
   if(req.url==='/ensayo/metricas'){
    assert.equal(db().select().from(whatsappOutbox).all().length,0);
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({node:process.version,loader:process.execArgv.includes('tsx')?'tsx':'compilado_esbuild',caso:nombre,timeoutClienteMs:10000,keepAliveMs:server.keepAliveTimeout,sincronizaciones,lecturas,transportes,errores,memoria:estadoProceso(),maxRssProcesoMiB:process.resourceUsage().maxRSS/1024,avisos:0}));return;
   }
   if(req.url==='/ensayo/cerrar' && req.method==='POST'){
    res.writeHead(200).end('{}');server.close(()=>{db().$client.close();});return;
   }
   res.writeHead(404).end();
  } catch(error){errores++;res.writeHead(500).end(JSON.stringify({categoria:error?.name==='ErrorHttp'?'ErrorHttp':'error_ensayo'}));}
 });
 await escuchar(server,6780);
 console.log(JSON.stringify({caso:nombre,modo,estado:'listo',keepAliveMs:server.keepAliveTimeout}));
} else {
 const origen=JSON.parse(readFileSync('/snapshots/medicion.json','utf8'));
 const archivo=resolve('/snapshots',nombre+'.json'),esperado=origen.resultados.find(r=>r.nombre===nombre).calentamiento;
 assert.equal(hash(readFileSync(archivo)),esperado.sha256);assert.equal(statSync(archivo).size,esperado.bytesJSON);
 const {estadoRemotoSchema}=await import('../../cooper/src/contratos/puente.ts');
 const remoto=estadoRemotoSchema.parse(JSON.parse(readFileSync(archivo,'utf8')));
 let pedidos=0,erroresProveedor=0;
 const proveedor=createServer(async(req,res)=>{
  try {
   assert.equal(req.url,'/webhook/cooper/v1');assert.equal(req.method,'POST');assert.equal(req.headers.authorization,'Bearer '+token);
   const chunks=[];for await(const c of req)chunks.push(c);
   const p=JSON.parse(Buffer.concat(chunks).toString());assert.equal(p.evento,'estado');assert.equal(p.dueno_email,email);assert.equal(p.admin,auth.admin);pedidos++;
   res.writeHead(200,{'Content-Type':'application/json','Content-Length':statSync(archivo).size});createReadStream(archivo).pipe(res);
  }catch{erroresProveedor++;res.writeHead(500).end();}
 });
 await escuchar(proveedor,6781);
 // El verificador usa una conexión nueva por muestra; nunca comparte el event loop ni
 // el pool keepalive de FabricaN8n. No modifica el transporte del cliente productivo.
 const pedir=(path,method='GET')=>new Promise((resolve,reject)=>{
  const req=request('http://127.0.0.1:6780'+path,{method,agent:false,signal:AbortSignal.timeout(10000)},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>{const bytes=Buffer.concat(chunks);if(res.statusCode!==200)reject(new Error('HTTP '+res.statusCode));else resolve(bytes);});
  });req.on('error',reject);req.end();
 });
 function comprobar(local){
  assert.deepEqual(local.videos.map(v=>v.id).sort(),ids);assert.equal(new Set(local.videos.map(v=>v.id)).size,ids.length);assert.equal(local.channels.length,remoto.canales.length);
  const owner=id=>id==='sin-recursos'?'nadie@example.test':dueno(Number(id.slice(6)));
  const cv=new Map(local.videos.map(v=>[v.id,v])),cc=new Map(local.channels.map(c=>[c.id,c]));
  const proyectadas=remoto.videos.map(r=>{const v=cv.get(r.id),obj={id:v.id,dueno_email:owner(v.ownerId),canal_id:v.channelId,titulo:v.title,stage:v.stage,script:v.script,actualizado_en:v.remoteUpdatedAt,modo_noticia:v.newsMode,observabilidad:v.observabilidad};return Object.fromEntries(Object.keys(r).map(k=>[k,obj[k]]));});
  const canales=remoto.canales.map(r=>{const c=cc.get(r.id),obj={id:c.id,dueno_email:owner(c.ownerId),nombre:c.name,nicho:c.niche,lecciones:c.lecciones,modo_noticia:c.newsMode};return Object.fromEntries(Object.keys(r).map(k=>[k,obj[k]]));});
  assert.equal(hash(canon(proyectadas)),hash(canon(remoto.videos)));assert.equal(hash(canon(canales)),hash(canon(remoto.canales)));
  return {videos:hash(canon(proyectadas)),canales:hash(canon(canales)),estado:hash(canon(local))};
 }
 try {
  let listo=false;
  for(let i=0;i<50 && !listo;i++){try{await pedir('/salud');listo=true;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.ok(listo,'Aplicación no arrancó');
  const tiemposSync=[];
  // Inicial, calentamiento y tres estables; sin verificaciones pesadas entre llamadas.
  for(let i=0;i<5;i++){const n=pedidos,t=performance.now();await pedir('/ensayo/sincronizar','POST');tiemposSync.push(performance.now()-t);assert.equal(pedidos-n,1,'No ocultar reintentos');}
  const lecturasHttp=[];
  for(let i=0;i<3;i++){
   globalThis.gc();const t=performance.now(),bytes=await pedir('/api/estado'),t1=performance.now(),local=JSON.parse(bytes.toString()),t2=performance.now();
   const huellas=comprobar(local);lecturasHttp.push({httpMs:t1-t,parseMs:t2-t1,totalMs:t2-t,bytes:bytes.length,sha256:hash(bytes),huellas,videos:local.videos.length});
  }
  assert.equal(new Set(lecturasHttp.map(r=>r.sha256)).size,1);assert.equal(erroresProveedor,0);
  const app=JSON.parse((await pedir('/ensayo/metricas')).toString());
  assert.equal(app.errores,0);assert.equal(app.sincronizaciones.length,5);assert.equal(app.lecturas.length,3);assert.equal(app.transportes.length,5);
  for(const t of app.transportes){assert.equal(t.http,200);assert.equal(t.bytesDeclarados,esperado.bytesJSON);assert.ok(t.signalPresente);assert.ok(t.totalMs<10000);}
  const resultado={version:2,fecha:new Date().toISOString(),caso:nombre,entrada:{fixtureHash:origen.fixtureHash,sha256:esperado.sha256,bytes:esperado.bytesJSON,videos:ids.length},topologia:'Dos cgroups sin red externa y namespace loopback compartido: aplicación 1 GiB sin swap, proveedor/verificador 2 GiB; actor ficticio autenticado',keepAliveProveedorMs:proveedor.keepAliveTimeout,pedidos,reintentos:pedidos-5,erroresProveedor,tiemposSync,lecturasHttp,aplicacion:app,verificador:{memoria:estadoProceso(),maxRssProcesoMiB:process.resourceUsage().maxRSS/1024},verificaciones:['IDs y dueños completos','canales completos','guiones completos','observabilidad e historial completos','bytes HTTP estables','una petición por sincronización','sin avisos']};
  writeFileSync('/salida/'+nombre+'-http.json',JSON.stringify(resultado,null,2)+'\n');
  await pedir('/ensayo/cerrar','POST');
  console.log(JSON.stringify({caso:nombre,videos:ids.length,entradaMiB:mib(esperado.bytesJSON),syncInicialMs:app.sincronizaciones[0].ms,syncMaxMs:Math.max(...app.sincronizaciones.slice(2).map(m=>m.ms)),getMaxMs:Math.max(...lecturasHttp.map(m=>m.totalMs)),salidaMiB:mib(lecturasHttp[0].bytes),memoria:app.memoria.cgroup,estado:'PASS'}));
 }finally{await new Promise(r=>proveedor.close(r));}
}
