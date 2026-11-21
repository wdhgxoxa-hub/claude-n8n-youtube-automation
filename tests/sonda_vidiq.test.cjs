const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

function preparar() {
  const dir = mkdtempSync(join(tmpdir(), 'cooper-sonda-'));
  try {
    execFileSync('python3', ['-W', 'error', 'tools/cooper/preparar_sonda_vidiq.py', '--salida', dir, '--tabla-trabajos', 'TABLA_ENSAYO'], { stdio: 'pipe' });
    return JSON.parse(readFileSync(join(dir, 'CoopSondaVidIQ01.json'), 'utf8'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const f = preparar();
const codigo = nombre => f.nodes.find(n => n.name === nombre).parameters.jsCode;
const rpc = result => ({ statusCode: 200, body: JSON.stringify({ jsonrpc: '2.0', id: 1, result }) });
const ejecutar = (nombre, actual, nodos = {}) => new Function('$', '$json', '$execution', codigo(nombre))(
  n => ({ isExecuted: !!nodos[n], all: () => (nodos[n] || []).map(json => ({ json })) }), actual, { id: 'ENSAYO' });

test('la sonda solo usa endpoint fijo, referencia de credencial y diagnóstico sin ejecuciones guardadas', () => {
  assert.equal(f.active, false);
  assert.equal(f.settings.saveDataErrorExecution, 'none');
  assert.equal(f.settings.saveDataSuccessExecution, 'none');
  assert.equal(f.settings.saveManualExecutions, false);
  assert.equal(f.settings.saveExecutionProgress, false);
  assert.equal(f.settings.errorWorkflow, undefined);
  for (const n of f.nodes) {
    if (n.type.endsWith('.code')) new Function('$', '$json', '$execution', n.parameters.jsCode);
    if (!n.type.endsWith('.httpRequest')) continue;
    assert.equal(n.parameters.url, 'https://mcp.vidiq.com/mcp');
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
    assert.equal(n.parameters.authentication, 'genericCredentialType');
    assert.deepEqual(Object.keys(n.credentials), ['httpHeaderAuth']);
    assert.deepEqual(Object.keys(n.credentials.httpHeaderAuth).sort(), ['id', 'name']);
    assert.equal(n.retryOnFail, undefined);
  }
  const guardado = f.nodes.find(n => n.type.endsWith('.dataTable'));
  assert.equal(guardado.parameters.dataTableId.value, 'TABLA_ENSAYO');
  assert.equal(guardado.parameters.operation, 'insert');
});

test('descubrir herramientas no autoriza investigaciones, cambios ni argumentos desconocidos', () => {
  const tools = [
    { name: 'vidiq_balance', inputSchema: {} },
    { name: 'vidiq_user_channels', inputSchema: { required: ['userGoal'] } },
    { name: 'vidiq_list_competitors', inputSchema: { required: ['channelId'] } },
    { name: 'vidiq_outliers', inputSchema: {} },
    { name: 'vidiq_update_competitors', inputSchema: {} },
  ];
  const pedidos = ejecutar('Pedidos gratuitos', rpc({ tools }));
  assert.deepEqual(pedidos.map(p => p.json.nombre), ['vidiq_balance', 'vidiq_user_channels']);
  assert.equal(ejecutar('Pedidos gratuitos', { statusCode: 401, body: '{}' })[0].json.sin_pedidos, true);
});

test('diagnóstico descarta cabeceras, tokens, textos y datos de cuenta sin convertir ausencias en cero', () => {
  const secreto = 'valor-ficticio-que-no-debe-salir';
  const nodos = {
    Inicializar: [rpc({ protocolVersion: '2025-03-26' })],
    'Listar herramientas': [rpc({ tools: [{ name: 'vidiq_balance', inputSchema: {} }] })],
    'Pedidos gratuitos': [{ nombre: 'vidiq_balance' }, { nombre: 'vidiq_user_channels' }],
    'Leer cuenta sin créditos': [rpc({ structuredContent: { credits: { remaining: 20, reset: null }, token: secreto, email: secreto, _credits: { used: 0 } } }), rpc({ structuredContent: { channels: ['UC1234567890123456789012'], token: secreto } })],
  };
  const resultado = ejecutar('Diagnóstico mínimo', {}, nodos)[0].json;
  assert.equal(JSON.stringify(resultado).includes(secreto), false);
  const d = JSON.parse(resultado.resultado);
  assert.equal(d.consultas[0].saldo['credits.remaining'], 20);
  assert.equal(d.consultas[0].saldo['credits.reset'], null);
  assert.equal(d.consultas[0].creditos_usados, 0);
  assert.equal(d.consultas[1].creditos_usados, null);
  assert.deepEqual(d.consultas[1].canales, ['UC1234567890123456789012']);
  assert.equal(d.investigacion_invocada, false);
});

test('el diagnóstico separa fallos del nodo sin mostrar el mensaje ni atribuirlos al proveedor', () => {
  const secreto = 'valor-ficticio-privado';
  const nodos = {
    'Pedidos gratuitos': [{ nombre: 'vidiq_balance' }],
    'Leer cuenta sin créditos': [{ error: 'JSON parameter needs to be valid JSON: ' + secreto }],
  };
  const resultado = ejecutar('Diagnóstico mínimo', {}, nodos)[0].json;
  assert.equal(JSON.stringify(resultado).includes(secreto), false);
  const d = JSON.parse(resultado.resultado);
  assert.equal(d.consultas[0].http, 0);
  assert.equal(d.consultas[0].fallo_nodo, 'json_invalido');
  assert.equal(d.consultas[0].ok, false);
});
