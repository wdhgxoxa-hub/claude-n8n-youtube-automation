// Ejecutar dentro de cada contenedor con su entorno existente. Nunca imprime claves.
const modo = process.argv[2] || 'salud';
if (!['salud', 'chat', 'apagado'].includes(modo)) process.exit(2);
async function main() {
  const base = 'http://127.0.0.1:8789';
  const started = Date.now();
  const headers = {authorization: `Bearer ${process.env.PUENTE_CODEX_TOKEN}`, 'content-type': 'application/json'};
  const anon = await fetch(`${base}/salud`, {signal: AbortSignal.timeout(10000)});
  if (anon.status !== 401) throw new Error();
  const r = await fetch(base + (modo === 'chat' ? '/v1/chat' : '/salud'), {
    method: modo === 'chat' ? 'POST' : 'GET', headers, signal: AbortSignal.timeout(50000),
    ...(modo === 'chat' ? {body: JSON.stringify({prompt: 'Prueba de conexión, sin datos privados. Responde exactamente con JSON: {"texto":"Cooper está conectado.","llamadas":[]}. No uses herramientas.'})} : {}),
  });
  const data = await r.json();
  const ok = modo === 'apagado' ? r.status === 503 : r.ok && (modo === 'chat'
    ? data.texto === 'Cooper está conectado.' && data.llamadas?.length === 0 : data.ok === true);
  console.log(JSON.stringify({modo,anonimo:anon.status,autenticado:r.status,ok,duracion_ms:Date.now()-started}));
  if (!ok) process.exitCode = 1;
}
main().catch(() => {console.log(JSON.stringify({modo,ok:false,error:'verificacion_fallida'}));process.exitCode=1;});
