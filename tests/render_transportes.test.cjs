const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const adapter = import(pathToFileURL(path.join(root, 'cooper/scripts/ensayo-render-transportes.mjs')));
const flow = (name) => JSON.parse(fs.readFileSync(path.join(root, 'workflows/v2', name + '.json'), 'utf8'));

test('render local: el registro del webhook reintenta solo 404 inequívoco y se limita a 30 segundos', async () => {
  const { postWebhookRegistrado } = await adapter;
  const missing = { status: 404, text: async () => '{"message":"The requested webhook POST total is not registered."}' };
  let time = 0, calls = 0;
  const options = {
    ahora: () => time,
    esperar: async (ms) => { time += ms; },
    fetch: async () => { calls++; return calls === 3 ? { status: 200, text: async () => 'ok' } : missing; },
  };
  assert.deepEqual(await postWebhookRegistrado('http://127.0.0.1/webhook/total', { evento: 'nuevo_video' }, options), { status: 200, text: 'ok' });
  assert.equal(calls, 3);
  calls = 0; time = 0;
  options.fetch = async () => { calls++; return missing; };
  assert.equal((await postWebhookRegistrado('http://127.0.0.1/webhook/total', {}, options)).status, 404);
  assert.equal(time, 30000); assert.equal(calls, 120);
  for (const response of [{ status: 500, text: async () => 'fallo' }, { status: 404, text: async () => 'otro recurso ausente' }]) {
    calls = 0; time = 0;
    options.fetch = async () => { calls++; return response; };
    assert.equal((await postWebhookRegistrado('http://127.0.0.1/webhook/total', {}, options)).status, response.status);
    assert.equal(calls, 1);
  }
  calls = 0;
  options.fetch = async () => { calls++; throw Error('timeout: resultado incierto'); };
  await assert.rejects(postWebhookRegistrado('http://127.0.0.1/webhook/total', {}, options), /resultado incierto/);
  assert.equal(calls, 1);
});

test('render local: conserva lógica, aprobación, originales y binarios emparejados', async () => {
  const { adaptarMediosLocales } = await adapter;
  for (const name of ['FabProduccion001', 'FabSonido0000001', 'FabPublicacion01', 'FabAprobacion001']) {
    const original = flow(name);
    const previous = JSON.stringify(original);
    const { workflow: result } = adaptarMediosLocales(original);
    assert.equal(JSON.stringify(original), previous);
    for (const node of original.nodes.filter(n => !['n8n-nodes-base.httpRequest', 'n8n-nodes-base.telegram'].includes(n.type))) {
      assert.deepEqual(result.nodes.find(n => n.id === node.id), node);
    }
    assert.equal(result.nodes.some(n => n.credentials), false);
  }
  const { workflow } = adaptarMediosLocales(flow('FabSonido0000001'));
  const node = workflow.nodes.find(n => n.name === 'Medio local · Subir voz a Drive');
  assert.ok(node);
  const bytes = Buffer.from('WAV original obtenido desde almacenamiento n8n');
  const all = [{ json: { plano_id: 'p01' }, binary: { archivo: { data: 'ID-DE-ALMACENAMIENTO', mimeType: 'audio/wav', fileName: 'p01.wav' } } }];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('$input', node.parameters.jsCode);
  const out = await execute.call({ helpers: { getBinaryDataBuffer: async (index, field) => {
    assert.equal(index, 0); assert.equal(field, 'archivo'); return bytes;
  } } }, { all: () => all });
  assert.equal(out[0].json.binary.data, bytes.toString('base64'));
  assert.deepEqual(out[0].pairedItem, { item: 0 });
  assert.equal(out[0].json.entrada.plano_id, 'p01');
  const links = Object.values(workflow.connections).flatMap(outputs => Object.values(outputs).flat(2));
  assert.equal(links.filter(link => link.node === 'Subir voz a Drive').length, 1);
  assert.equal(workflow.connections[node.name].main[0][0].node, 'Subir voz a Drive');
});

test('render local: voz, archivo, imagen y render solo apuntan al relay loopback cerrado', async () => {
  const { adaptarMediosLocales } = await adapter;
  const production = adaptarMediosLocales(flow('FabProduccion001')).workflow;
  const sound = adaptarMediosLocales(flow('FabSonido0000001')).workflow;
  for (const node of [...production.nodes, ...sound.nodes].filter(n => n.type === 'n8n-nodes-base.httpRequest')) {
    assert.equal(node.parameters.method, 'POST');
    assert.equal(node.parameters.url, 'http://127.0.0.1:8890/media');
    assert.equal(node.parameters.authentication, undefined);
  }
  const consulta = production.nodes.find(n => n.name === 'Consultar render');
  assert.match(consulta.parameters.jsonBody, /\$\('Renderizar'\)\.first\(\)\.json/);
  for (const name of ['FabRedes00000001', 'FabYouTube000001', 'FabConfirmar0001']) {
    const result = adaptarMediosLocales(flow(name));
    for (const replacement of result.sustituciones.filter(r => r.proveedor === 'bloqueado-render-local')) {
      const node = result.workflow.nodes.find(n => n.id === replacement.nodo_id);
      assert.throws(() => new Function(node.parameters.jsCode)(), /prohíbe publicar o iniciar OAuth/);
    }
  }
});
