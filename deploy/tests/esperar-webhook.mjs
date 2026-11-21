import assert from "node:assert/strict";

// Solo la ausencia inequívoca del webhook permite repetir la llamada de ensayo.
// Cualquier respuesta aceptada, ambigua o con ejecución registrada termina aquí.
export async function invocarWebhookRegistrado(invoke, executionCount, options = {}) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const end = now() + (options.timeout ?? 10000);
  let intentos = 0;
  while (true) {
    const response = await invoke();
    intentos += 1;
    if (response.status !== 404) return { response, intentos };
    let body;
    try { body = JSON.parse(response.text); } catch { return { response, intentos }; }
    if (body.code !== 404 || !/^The requested webhook "POST ensayo-vps" is not registered\.?$/.test(body.message ?? "")) {
      return { response, intentos };
    }
    assert.equal(await executionCount(), 0, "Un 404 con ejecución registrada no permite repetir el webhook");
    if (now() >= end) return { response, intentos };
    await wait(300);
  }
}
