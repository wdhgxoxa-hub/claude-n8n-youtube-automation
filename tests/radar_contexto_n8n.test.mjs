// Recorre el Radar exportado con Execute Workflow y Data Tables reales.
// Proveedores reemplazados por subflujos sintéticos; red interna sin Internet.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {startN8n,podman,CONTAINER,until,assertNoEnvFiles} from '../cooper/scripts/ensayo-infra.mjs';

const original=JSON.parse(readFileSync(new URL('../workflows/v2/FabRadar00000001.json',import.meta.url),'utf8'));
const anterior=`const respuestas=$input.all();
return $('Competencia comprobada').all().map((p,k)=>respuestas[k]?.json?.canal_id===p.json.canal_id && respuestas[k].json.ok===true ? respuestas[k] : p);`;
const link=node=>({node,type:'main',index:0});
const node=(name,type,parameters,typeVersion=2)=>({name,type:'n8n-nodes-base.'+type,parameters,typeVersion,id:randomUUID(),position:[0,0]});

test('Radar íntegro: normaliza ítems de subflujos con metadata sin perder datos ni canal', {timeout:180000},async t=>{
 assertNoEnvFiles();
 const n8n=await startN8n(0);
 try {
  podman('update','--cpuset-cpus','0-7',CONTAINER);
  const {api}=n8n;
  const body=w=>({name:w.name,nodes:w.nodes,connections:w.connections,settings:{executionOrder:'v1'}});
  const save=w=>api.request('POST','/workflows',body(w));
  const publish=id=>api.request('POST',`/workflows/${id}/publish`,{});
  const sub=async(name,js)=>{
   const w=await save({name,nodes:[node('Inicio','executeWorkflowTrigger',{inputSource:'passthrough'},1.1),node('Salida','code',{jsCode:js})],connections:{Inicio:{main:[[link('Salida')]]}}});
   await publish(w.id);return w.id;
  };
  const ajustes=await sub('Ajustes ficticios','return [{json:{allowRadar:false}}];');
  const texto=await sub('Texto ficticio',`return $input.all().map(i=>({json:{output:[{content:[{type:'output_text',text:JSON.stringify({resumen:'Ensayo ficticio',ideas:[],competidores:[],homonimos:[],comprobaciones:[]})}]}],texto_uso:{ruta:'codex'}}}));`);
  const nativa=await sub('Nativa ficticia',`return $input.all().map(i=>{if(i.json.canal_id==='fallback')return {json:{ok:false,canal_id:'ajeno'}};const tendencias=JSON.parse(i.json.tendencias);tendencias.ensayo_nativo=i.json.canal_id;return {json:{...i.json,tendencias:JSON.stringify(tendencias)}};});`);
  const tabla=await api.request('POST','/data-tables',{name:'canales_sinteticos',columns:[{name:'canal_id',type:'string'},{name:'nombre',type:'string'},{name:'nicho',type:'string'},{name:'redes',type:'string'},{name:'estado',type:'string'},{name:'eliminado',type:'boolean'},{name:'tendencias',type:'string'}]});
  await api.request('POST',`/data-tables/${tabla.id}/rows`,{data:['primero','segundo','fallback'].map(canal_id=>({canal_id,nombre:'Canal '+canal_id,nicho:'ficción',redes:'youtube',estado:'activo',eliminado:false,tendencias:''})),returnType:'all'});
  const w=structuredClone(original);
  w.name='Radar íntegro sintético sin red';
  const inicio=w.nodes.find(n=>n.name==='Inicio');
  Object.assign(inicio,{type:'n8n-nodes-base.code',typeVersion:2,parameters:{jsCode:'return [{json:{accion:"antes_idea",canal_id:$json.body.canal_id||""}}];'}});
  w.nodes.push(node('Entrada','webhook',{httpMethod:'POST',path:'radar-contexto-ficticio',responseMode:'lastNode',responseData:'allEntries'},2));
  w.connections.Entrada={main:[[link('Inicio')]]};
  // Excluir noticias y Telegram; conservar íntegra la ruta antes_idea y sus subflujos.
  w.connections['Leer ajustes']={main:[[link('¿Radar encendido?')]]};
  w.connections['¿Avisar radar público?']={main:[[link('Resultado del radar público')],[link('Resultado del radar público')]]};
  const cola=['Entrada'],alcance=new Set();
  while(cola.length){const n=cola.pop();if(alcance.has(n))continue;alcance.add(n);for(const grupos of Object.values(w.connections[n]??{}))for(const grupo of grupos)for(const e of grupo)cola.push(e.node);}
  w.nodes=w.nodes.filter(n=>alcance.has(n.name));
  w.connections=Object.fromEntries(Object.entries(w.connections).filter(([n])=>alcance.has(n)));
  for(const n of w.nodes){
   delete n.credentials;
   if(n.parameters.dataTableId)n.parameters.dataTableId.value=tabla.id;
   const refs={'Leer ajustes':ajustes,'Investigar competencia pública':texto,'Consultar YouTube por canal':nativa};
   if(refs[n.name])n.parameters.workflowId.value=refs[n.name];
  }
  assert.ok(!w.nodes.some(n=>/telegram|httpRequest|scheduleTrigger/.test(n.type)));
  const corregido=w.nodes.find(n=>n.name==='Competencia con YouTube').parameters.jsCode;
  w.nodes.find(n=>n.name==='Competencia con YouTube').parameters.jsCode=anterior;
  const created=await save(w);await publish(created.id);
  const invocar=async canal_id=>{
   const contar=async()=>(await api.all('/executions')).filter(e=>e.workflowId===created.id).length;
   const previas=await contar();let r;
   await until(async()=>{
    const respuesta=await fetch(n8n.url+'/webhook/radar-contexto-ficticio',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({canal_id}),signal:AbortSignal.timeout(30000)});
    r={status:respuesta.status,body:await respuesta.json()};
    if(r.status!==404)return true;
    // Publicar registra el webhook de forma asíncrona. Solo repetir ausencia
    // inequívoca sin ejecución nueva; nunca un 200 ni un fallo de ejecución.
    assert.equal(r.body.code,404);
    assert.match(r.body.message,/^(?:The requested webhook "POST radar-contexto-ficticio" is not registered\.?|This webhook is not registered for POST requests\. Did you mean to make a POST request\?)$/);
    assert.equal(await contar(),previas);
    return false;
   },'registro local',10000);
   return r;
  };
  await t.test('la implementación anterior falla por metadata al devolver el ítem completo',async()=>{
   const r=await invocar('primero');
   assert.equal(r.status,500);
   const ejecuciones=(await api.all('/executions')).filter(e=>e.workflowId===created.id);
   assert.equal(ejecuciones.length,1);
   const fallo=await api.request('GET',`/executions/${ejecuciones[0].id}?includeData=true`);
   assert.equal(fallo.data.resultData.lastNodeExecuted,'Competencia con YouTube');
   assert.equal(fallo.data.resultData.error.name,'ReservedKeyFoundError');
   assert.ok((await api.rows(tabla.id)).every(f=>f.tendencias===''));
  });
  w.nodes.find(n=>n.name==='Competencia con YouTube').parameters.jsCode=corregido;
  await api.request('PUT',`/workflows/${created.id}`,body(w));await publish(created.id);
  await t.test('un canal devuelve y persiste la respuesta nativa sin metadata superior',async()=>{
   const r=await invocar('primero');assert.equal(r.status,200);
   const filas=Array.isArray(r.body)?r.body:[r.body];assert.equal(filas.length,1);
   assert.equal(JSON.parse(filas[0].tendencias).ensayo_nativo,'primero');
   assert.equal(filas[0].metadata,undefined);
   assert.equal(JSON.parse((await api.rows(tabla.id)).find(f=>f.canal_id==='primero').tendencias).ensayo_nativo,'primero');
  });
  await t.test('varios canales conservan su pareja y el respaldo web ante respuesta ajena',async()=>{
   const r=await invocar('');assert.equal(r.status,200);assert.equal(r.body.length,3);
   const filas=await api.rows(tabla.id);
   for(const id of ['primero','segundo','fallback']){
    const retorno=r.body.find(f=>f.canal_id===id);assert.ok(retorno);
    const persistida=JSON.parse(filas.find(f=>f.canal_id===id).tendencias);
    assert.deepEqual(persistida,JSON.parse(retorno.tendencias));
    assert.equal(persistida.ensayo_nativo,id==='fallback'?undefined:id);
    assert.equal(retorno.ok,true);assert.equal(retorno.metadata,undefined);
   }
  });
 }finally{podman('stop',CONTAINER);}
});
