const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fixture,dueno,esperados,contexto,parametros,tablasPorNodo}=require('../tools/cooper/volumen-fixture.cjs');
const w=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../workflows/v2/FabCooperAPI0001.json')));
test('fixture de 10000 videos, diez dueños, cien canales y relaciones deterministas',()=>{
 const f=fixture(); assert.equal(f.fab_videos.length,10000);assert.equal(f.fab_canales.length,100);
 assert.deepEqual(f,fixture());
 for(const table of ['fab_planos','fab_publicaciones','fab_eventos','fab_aprobaciones']) assert.equal(f[table].length,10000);
 assert.equal(esperados({admin:true}).length,9896);
 assert.equal(esperados({dueno_email:dueno(0)}).length,999);
 assert.equal(esperados({dueno_email:dueno(9)}).length,900);
 assert.equal(esperados({dueno_email:'nadie@example.test'}).length,0);
});
test('lee los filtros canónicos sin reemplazar returnAll ni el control de dueño',()=>{
 for(const admin of [false,true]) {
  const auth={admin,dueno_email:dueno(0),solicitud:{evento:'estado',datos:{}}};
  for(const name of Object.keys(tablasPorNodo)) {
   const n=w.nodes.find(n=>n.name===name),p=parametros(n.parameters,contexto({},auth));
   assert.equal(p.returnAll,true);
   assert.equal(n.alwaysOutputData,true);
   if(name.endsWith('autorizados')) assert.deepEqual(p.filters.conditions,[{keyName:'dueno_email',condition:admin?'isNotEmpty':'eq',keyValue:dueno(0)}]);
   if(name==='Aprobaciones') assert.equal(p.filters.conditions[1].keyValue,'__ninguno__');
  }
 }
});
test('la proyección canónica descarta filas ajenas y conserva escenas e historial propios',()=>{
 const f=fixture(), filas={};
 for(const [n,t] of Object.entries(tablasPorNodo)) filas[n]=f[t].slice(0,30).map(json=>({json:{...json,createdAt:'2026-01-01T00:00:00.000Z'}}));
 const auth={admin:false,dueno_email:dueno(0),solicitud:{evento:'estado',datos:{}}};
 const resolver=new Function('$',w.nodes.find(n=>n.name==='Resolver').parameters.jsCode);
 const respuesta=resolver(contexto(filas,auth))[0].json.respuesta;
 assert.deepEqual(respuesta.videos.map(v=>v.id),['video-00010','video-00020']);
 assert.ok(respuesta.canales.every(c=>c.dueno_email===dueno(0)));
 for(const v of respuesta.videos) {
  assert.equal(v.observabilidad.escenas[0].id,`plano-${Number(v.id.slice(6))}`);
  assert.deepEqual(v.observabilidad.publicaciones[0].historial.map(m=>m.vistas),[1,3]);
 }
});

test('la proyección no vuelve a recorrer todos los planos por cada video autorizado',()=>{
 const ids=Array.from({length:100},(_,i)=>i===0?'__proto__':i===1?'constructor':`v-${i}`);
 const auth={admin:false,dueno_email:dueno(0),solicitud:{evento:'estado',datos:{}}};
 const filas={
  'Canales autorizados':[{json:{canal_id:'c',dueno_email:dueno(0)}}],
  'Videos autorizados':ids.map(video_id=>({json:{video_id,canal_id:'c',dueno_email:dueno(0)}})),
 };
 let lecturas=0;
 filas['Piezas de Cooper']=Array.from({length:1200},(_,i)=>({json:{
  get video_id(){lecturas++;return i<200?ids[i%100]:'ajeno';},
  plano_id:`p-${i}`,tipo:'imagen',archivo_url:`https://media.example.test/${i}.png`,
 }}));
 const respuesta=new Function('$',w.nodes.find(n=>n.name==='Resolver').parameters.jsCode)(contexto(filas,auth))[0].json.respuesta;
 assert.deepEqual(respuesta.videos.map(v=>v.id),ids);
 respuesta.videos.forEach((v,i)=>assert.deepEqual(v.observabilidad.escenas.map(p=>p.id),[`p-${i}`,`p-${i+100}`]));
 assert.ok(lecturas<=2400,`Se recorrieron ${lecturas} claves para 1200 planos`);
 assert.doesNotMatch(JSON.stringify(respuesta),/ajeno/);
});
