// Ejecutar en una imagen n8n local con --network=none. No lee credenciales.
// Recibe únicamente el JSON público generado por preparar_sonda_vidiq.py.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const raiz = '/usr/local/lib/node_modules/n8n';
const base = path.dirname(require.resolve('n8n-nodes-base/package.json', { paths: [raiz] }));
const { HttpRequestV3 } = require(path.join(base, 'dist/nodes/HttpRequest/V3/HttpRequestV3.node.js'));
const { Expression } = require(require.resolve('n8n-workflow', { paths: [raiz] }));
const f = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const code = name => f.nodes.find(n => n.name === name).parameters.jsCode;
const expression = new Expression({});
const anterior = "={{ JSON.stringify({jsonrpc:'2.0',id:$json.id,method:'tools/call',params:{name:$json.nombre,arguments:$json.args}}) }}";
assert.equal(expression.resolveSimpleParameterValue('={{ JSON.stringify({a:1}) }}', {}), '{"a":1}');
assert.throws(() => expression.resolveSimpleParameterValue(anterior, { $json: { id: 10, nombre: 'vidiq_balance', args: {} } }), /invalid syntax/);
const herramientas = [
  { name: 'vidiq_balance', inputSchema: {} },
  { name: 'vidiq_user_channels', inputSchema: { required: ['userGoal'] } },
];
const items = new Function('$', '$json', '$execution', code('Pedidos gratuitos'))(
  () => ({}), { statusCode: 200, data: JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: herramientas } }) }, { id: 'FICTICIO' },
);
const node = f.nodes.find(n => n.name === 'Leer cuenta sin créditos');
const previos = { Inicializar: { headers: { 'mcp-session-id': 'sesion-ficticia' } }, 'Comprobar inicio': { protocolo: '2025-03-26' } };
const resolve = (value, i) => typeof value === 'string' && value.startsWith('={{')
  ? expression.resolveSimpleParameterValue(value, { $json: items[i].json, $: n => ({ first: () => ({ json: previos[n] }) }) })
  : Array.isArray(value) ? value.map(v => resolve(v, i))
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, i)])) : value;
const solicitudes = [];
const context = {
  getInputData: () => items, getNode: () => node,
  getNodeParameter: (key, i, def) => resolve(key.split('.').reduce((v, k) => v?.[k], node.parameters) ?? ({ contentType: 'json' }[key] ?? def), i),
  getCredentials: async () => ({ name: 'Authorization', value: 'FICTICIO', allowedHttpRequestDomains: 'all' }),
  continueOnFail: () => true, getExecutionCancelSignal: () => new AbortController().signal,
  getMode: () => 'webhook', isToolExecution: () => false, sendMessageToUI: () => {}, getContext: () => ({}),
  helpers: {
    request: async opts => {
      solicitudes.push(opts.body);
      return { headers: { 'content-type': 'text/event-stream' }, statusCode: 200, statusMessage: 'OK',
        body: 'event: message\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id: opts.body.id, result: { structuredContent: { _credits: { used: 0 }, credits: { remaining: 10 } } } }) + '\n\n' };
    },
  },
};
(async () => {
  const [out] = await new HttpRequestV3({ name: 'httpRequest', displayName: 'HTTP Request' }).execute.call(context);
  assert.equal(solicitudes.length, 2);
  assert.deepEqual(solicitudes.map(r => r.params.name), ['vidiq_balance', 'vidiq_user_channels']);
  assert.deepEqual(solicitudes.map(r => r.params.arguments), [{}, { userGoal: 'Comprobar acceso sin usar créditos ni cambiar la cuenta' }]);
  assert.ok(out.every(r => r.json.statusCode === 200));
  const nodes = { 'Pedidos gratuitos': items, 'Leer cuenta sin créditos': out };
  const result = new Function('$', '$json', '$execution', code('Diagnóstico mínimo'))(
    n => ({ isExecuted: !!nodes[n], all: () => nodes[n] || [] }), {}, { id: 'FICTICIO' },
  );
  const d = JSON.parse(result[0].json.resultado);
  assert.deepEqual(d.consultas.map(c => [c.herramienta, c.http, c.ok]), [['vidiq_balance', 200, true], ['vidiq_user_channels', 200, true]]);
  console.log(JSON.stringify({ n8n: require(path.join(raiz, 'package.json')).version, expresion_anterior: 'invalid syntax',
    expresion_corregida: 'PASS', nodo_http_real: 'PASS', transporte: 'ficticio', red: false, credencial: 'ficticia', consultas: 2 }));
})().catch(() => { console.error('Falló la regresión aislada de la sonda.'); process.exit(1); });
