import assert from "node:assert/strict";
import test from "node:test";
import { invocarWebhookRegistrado } from "./esperar-webhook.mjs";
const absent = {status:404,text:JSON.stringify({code:404,message:'The requested webhook "POST ensayo-vps" is not registered.'})};
const accepted = {status:200,text:'{}'};

test("espera registro y nunca repite una ejecución aceptada", async () => {
  let calls=0;let queries=0;
  const result=await invocarWebhookRegistrado(async()=>++calls===1?absent:accepted,()=>{queries++;return 0;},{wait:async()=>{}});
  assert.equal(result.response,accepted);assert.equal(calls,2);assert.equal(queries,1);
});
test("200 inmediato no consulta ni repite", async () => {
  let calls=0;
  await invocarWebhookRegistrado(async()=>{calls++;return accepted;},()=>assert.fail());
  assert.equal(calls,1);
});
test("404 ajeno o ambiguo y errores del proveedor no se repiten", async () => {
  for(const response of [{status:404,text:'404'}, {status:404,text:'{"code":404,"message":"otra causa"}'},{status:500,text:'error'}]) {
    let calls=0;
    const result=await invocarWebhookRegistrado(async()=>{calls++;return response;},()=>assert.fail());
    assert.equal(result.response,response);assert.equal(calls,1);
  }
});
test("rechaza repetir si existe ejecución del workflow", async () => {
  let calls=0;
  await assert.rejects(invocarWebhookRegistrado(async()=>{calls++;return absent;},()=>1));
  assert.equal(calls,1);
});
test("mantiene el fallo al agotar la espera de registro", async () => {
  let clock=0;let calls=0;
  const result=await invocarWebhookRegistrado(async()=>{calls++;return absent;},()=>0,{now:()=>clock,wait:async()=>{clock=10001;}});
  assert.equal(result.response,absent);assert.equal(calls,2);
});
