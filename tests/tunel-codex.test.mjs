import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, chmod, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { crearRele, escucharPrivado } from '../servicios/puente-codex/tunel.mjs';
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', r));
const close = s => new Promise(r => { s.close(r); s.closeAllConnections(); });
async function fixture(t, responder) {
  const dir = await mkdtemp(join(tmpdir(), 'cooper-rele-'));
  await chmod(dir, 0o700);
  const pcToken = randomBytes(32).toString('hex'), vpsToken = randomBytes(32).toString('hex');
  const origin = createServer(responder || ((req,res) => {
    assert.equal(req.headers.authorization, `Bearer ${pcToken}`);
    req.resume(); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({texto:'Listo.', llamadas:[]}));
  }));
  await listen(origin);
  const pc = crearRele({modo:'pc', token:pcToken, puertoDestino:origin.address().port});
  const socket = join(dir,'puente.sock');
  await escucharPrivado(pc,socket);
  const vps = crearRele({modo:'vps', token:vpsToken, socket, timeout:1000});
  await listen(vps);
  t.after(async () => { await close(vps); await close(pc); await close(origin); await rm(dir,{recursive:true}); });
  const url = `http://127.0.0.1:${vps.address().port}`;
  const call = (path='/v1/chat', options={}) => fetch(url+path, {method:'POST',headers:{authorization:`Bearer ${vpsToken}`,'content-type':'application/json'},body:JSON.stringify({prompt:'Hola'}),...options});
  return {call,url,socket,pc,origin,vpsToken};
}
test('une tokens distintos mediante socket privado y conserva respuesta', async t => {
  const f = await fixture(t);
  assert.equal((await stat(f.socket)).mode & 0o777, 0o600);
  const r = await f.call(); assert.equal(r.status,200); assert.deepEqual(await r.json(),{texto:'Listo.',llamadas:[]});
});
test('rechaza identidad incorrecta, Origin, rutas arbitrarias y cuerpos excesivos', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/v1/chat',{headers:{authorization:'Bearer falso','content-type':'application/json'}})).status,401);
  assert.equal((await f.call('/v1/chat',{headers:{authorization:`Bearer ${f.vpsToken}`,'content-type':'application/json',origin:'https://otro.test'}})).status,401);
  assert.equal((await f.call('/admin')).status,404);
  assert.equal((await f.call('/v1/chat',{body:'x'.repeat(262145)})).status,413);
});
test('PC apagada responde indisponible y recupera sin reiniciar VPS', async t => {
  const f = await fixture(t);
  await close(f.pc);
  assert.equal((await f.call()).status,503);
  await escucharPrivado(f.pc,f.socket);
  assert.equal((await f.call()).status,200);
});
test('no sigue redirecciones del destino', async t => {
  const f = await fixture(t, (req,res) => {req.resume();res.writeHead(302,{location:'https://externo.test'});res.end();});
  assert.equal((await f.call()).status,502);
});
test('rechaza directorio de socket accesible a otros', async () => {
  const dir=await mkdtemp(join(tmpdir(),'cooper-perm-'));await chmod(dir,0o755);
  const s=createServer();
  try {await assert.rejects(escucharPrivado(s,join(dir,'s')),/0700/);} finally {await rm(dir,{recursive:true});}
});
