import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../deploy/verificar-chat.cjs', import.meta.url), 'utf8');
async function verificar({ modo = 'chat', env = {}, status = 200 } = {}) {
  const llamadas = [];
  const proceso = { argv: ['node', '-', modo], env: {
    PUENTE_CODEX_TOKEN: 'token-ficticio-de-prueba-sin-valor-real',
    PUENTE_CODEX_URL: 'http://127.0.0.1:8790',
    COOPER_CHAT: 'codex-local', COOPER_CHAT_API_RESPALDO: '0', ...env,
  } };
  const salida = await new Promise(resolve => {
    runInNewContext(script, {
      process: proceso, URL, AbortSignal, Date,
      console: { log: value => resolve(JSON.parse(value)) },
      fetch: async (url, options = {}) => {
        llamadas.push({ url: String(url), options });
        if (!options.headers?.authorization) return { status: 401 };
        return { status, ok: status === 200, json: async () => modo === 'chat'
          ? { texto: 'Cooper está conectado.', llamadas: [] } : { ok: true } };
      },
    });
  });
  // El script asigna exitCode después de imprimir el resultado.
  await Promise.resolve();
  return { salida, llamadas, exitCode: proceso.exitCode ?? 0 };
}

test('sondea el destino configurado y prohíbe redirecciones en ambas peticiones', async () => {
  const { salida, llamadas, exitCode } = await verificar();
  assert.equal(salida.ok, true);
  assert.equal(exitCode, 0);
  assert.deepEqual(llamadas.map(l => l.url), ['http://127.0.0.1:8790/salud', 'http://127.0.0.1:8790/v1/chat']);
  assert(llamadas.every(l => l.options.redirect === 'error'));
});

test('rechaza destinos inseguros antes de usar el token y no los imprime', async () => {
  for (const destino of ['https://externo.test', 'http://usuario:clave-ficticia@127.0.0.1', 'http://127.0.0.1/ruta', 'no-url']) {
    const { salida, llamadas, exitCode } = await verificar({ env: { PUENTE_CODEX_URL: destino } });
    assert.equal(salida.ok, false);
    assert.equal(exitCode, 1);
    assert.equal(llamadas.length, 0);
    assert(!JSON.stringify(salida).includes(destino));
    assert(!JSON.stringify(salida).includes('clave-ficticia'));
  }
});

test('no acredita chat completo si Cooper usa otro proveedor o permite gasto API', async () => {
  for (const env of [{ COOPER_CHAT: 'simulada' }, { COOPER_CHAT_API_RESPALDO: '1' }, { PUENTE_CODEX_TOKEN: '' }]) {
    const { salida, llamadas, exitCode } = await verificar({ env });
    assert.equal(salida.ok, false);
    assert.equal(exitCode, 1);
    assert.equal(llamadas.length, 0);
  }
});

test('la salud y la caída siguen disponibles en relés sin configuración de chat', async () => {
  for (const modo of ['salud', 'apagado']) {
    const { salida, exitCode } = await verificar({ modo, env: { COOPER_CHAT: undefined }, status: modo === 'apagado' ? 503 : 200 });
    assert.equal(salida.ok, true);
    assert.equal(exitCode, 0);
  }
});
