import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { crearServidor, ejecutarCodex } from '../servicios/puente-codex/server.mjs';

const fixture = await mkdtemp(join(tmpdir(), 'codex-ficticio-'));
const bin = join(fixture, 'codex');
await writeFile(bin, `#!/usr/bin/env node
const assert=require('node:assert/strict');
const args=process.argv.slice(2);
for(const arg of ['exec','--json','--ephemeral','--ignore-user-config','--sandbox','read-only','forced_login_method="chatgpt"','features.shell_tool=false','features.apps=false','features.hooks=false']) assert(args.includes(arg));
assert.equal(args.at(-1),'-');
for(const k of ['OPENAI_API_KEY','CODEX_API_KEY','PUENTE_CODEX_TOKEN']) assert.equal(process.env[k],undefined);
let input=''; process.stdin.on('data',c=>input+=c); process.stdin.on('end',()=>{
 if(input.includes('COLGAR')) {setInterval(()=>{},1000);return;}
 if(input.includes('FALLAR')) {process.stderr.write('no devolver esta salida');process.exit(1);}
 if(input.includes('EXCESO')) {process.stdout.write('a'.repeat(3*1024*1024));return;}
 if(input.includes('INVALIDO')) {console.log('no es json');return;}
 if(input.includes('BUSCAR')) console.log(JSON.stringify({type:'item.completed',item:{type:'web_search',action:{type:'search',sources:[{url:'https://fuente.example.test/hecho'}]}}}));
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({resumen:'ensayo',ideas:[]})}}));
 console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:12,output_tokens:8}}));
});
`);
await chmod(bin, 0o700);
test.after(() => rm(fixture, { recursive:true, force:true }));
const pedido = prompt => ({ tarea:'radar', prompt, buscar_web:false });
const runner = (p, opts = {}) => ejecutarCodex(p, { ...opts, bin, timeoutMs:1500,
  env:{ PATH:process.env.PATH, OPENAI_API_KEY:'ficticia', CODEX_API_KEY:'ficticia', PUENTE_CODEX_TOKEN:'ficticio' } });

test('Codex simulado: stdin literal, sandbox, autenticación ChatGPT y entorno sin claves', async () => {
  const r=await runner(pedido('Texto con $(nunca_ejecutar) y `comando`'));
  assert.equal(r.ruta,'codex'); assert.equal(r.usage.input_tokens,12);
  assert.equal(r.busqueda_real,false);
});
test('búsqueda requiere evento real, no basta afirmarlo en el texto', async () => {
  await assert.rejects(runner({...pedido('normal'),buscar_web:true}),/respuesta_invalida/);
  const r=await runner({...pedido('BUSCAR'),buscar_web:true});
  assert.equal(r.busqueda_real,true); assert.deepEqual(r.fuentes_consultadas,['https://fuente.example.test/hecho']);
});
for(const [input, error] of [['FALLAR','codex_fallo'],['INVALIDO','respuesta_invalida'],['EXCESO','salida_excesiva']])
  test('Codex simulado: '+error, async () => { await assert.rejects(runner(pedido(input)),new RegExp(error)); });
test('mata una ejecución lenta y devuelve timeout acotado', async () => {
  const start=Date.now();
  await assert.rejects(ejecutarCodex(pedido('COLGAR'),{bin,timeoutMs:150}),/tiempo_agotado/);
  assert(Date.now()-start<2000);
});
test('cancela el proceso cuando se desconecta el cliente', async () => {
  const controller=new AbortController();
  const job=runner(pedido('COLGAR'),{signal:controller.signal});
  setTimeout(()=>controller.abort(),100);
  await assert.rejects(job,/cancelado/);
});
async function servidor(t, run=runner) {
  const token=randomBytes(32).toString('hex'), logs=[];
  const server=crearServidor({token,runner:run,log:x=>logs.push(x)});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(async ()=>{server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));});
  const url='http://127.0.0.1:'+server.address().port;
  return {server,logs,send:(body,headers={})=>fetch(url+'/v1/texto',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token,...headers},body:JSON.stringify(body)})};
}
test('HTTP local: rechaza token, Origin, tareas y argumentos ajenos sin ejecutar', async t => {
  let calls=0; const s=await servidor(t, async()=>{calls++;});
  assert.equal((await s.send(pedido('hola'),{authorization:'incorrecto'})).status,401);
  assert.equal((await s.send(pedido('hola'),{origin:'https://ajeno.test'})).status,401);
  assert.equal((await s.send({...pedido('hola'),args:['--yolo']})).status,400);
  assert.equal((await s.send({...pedido('hola'),tarea:'shell'})).status,400);
  assert.equal((await s.send(pedido('a'.repeat(270000)))).status,413);
  assert.equal(calls,0);
});
test('HTTP: respuesta compatible y logs sin prompt, cabeceras ni stderr', async t => {
  const s=await servidor(t);
  const r=await s.send(pedido('CONTENIDO_PRIVADO'));
  assert.equal(r.status,200); assert.equal((await r.json()).ruta,'codex');
  const fail=await s.send(pedido('FALLAR'));
  assert.equal(fail.status,502); assert.deepEqual(await fail.json(),{error:'codex_fallo'});
  assert.doesNotMatch(JSON.stringify(s.logs),/CONTENIDO_PRIVADO|no devolver|authorization|prompt/);
});
test('HTTP: saturación devuelve 429, y libera la plaza al terminar', async t => {
  let finish, started;
  const ready=new Promise(resolve=>{started=resolve;});
  const s=await servidor(t,()=>new Promise(resolve=>{finish=resolve;started();}));
  const pending=s.send(pedido('primero')); await ready;
  assert.equal((await s.send(pedido('segundo'))).status,429);
  finish({ruta:'codex'}); assert.equal((await pending).status,200);
});
