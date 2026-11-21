const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const dir = mkdtempSync(join(tmpdir(), 'cooper-radar-'));
let f;
try {
  execFileSync('python3', ['-W', 'error', 'tools/cooper/preparar_ensayo_radar.py', '--salida', dir,
    '--tabla-trabajos', 'TABLA_ENSAYO', '--canal-id', 'canal-ensayo'], { stdio: 'pipe' });
  f = JSON.parse(readFileSync(join(dir, 'CoopRadarReal001.json'), 'utf8'));
} finally { rmSync(dir, { recursive: true, force: true }); }
const codigo = n => f.nodes.find(x => x.name === n).parameters.jsCode;

test('el ensayo del radar solo ejecuta antes_idea en un canal y descarta ejecuciones crudas', () => {
  assert.equal(f.active, false);
  assert.equal(f.settings.saveDataSuccessExecution, 'none');
  assert.equal(f.settings.saveDataErrorExecution, 'none');
  assert.equal(f.settings.saveManualExecutions, false);
  assert.equal(f.settings.executionTimeout, 480);
  assert.deepEqual(new Function(codigo('Canal autorizado'))(), [{ json: { accion: 'antes_idea', canal_id: 'canal-ensayo' } }]);
  const hijos = f.nodes.filter(n => n.type.endsWith('.executeWorkflow'));
  assert.equal(hijos.length, 1);
  assert.equal(hijos[0].parameters.workflowId.value, 'FabRadar00000001');
  assert.equal(f.nodes.some(n => n.type.endsWith('.httpRequest') || n.type.endsWith('.scheduleTrigger')), false);
});

test('el diagnóstico solo resume el canal autorizado y nunca conserva el error crudo', () => {
  const ejecutar = datos => new Function('$input', '$execution', codigo('Diagnóstico mínimo'))(
    { all: () => datos.map(json => ({ json })) }, { id: 'prueba' });
  const error = ejecutar([{ error: 'secreto-ficticio-no-salir' }])[0].json;
  assert.equal(error.estado, 'bloqueado');
  assert.equal(JSON.stringify(error).includes('secreto-ficticio'), false);
  const r = ejecutar([{ canal_id: 'ajeno', tendencias: '{}' }, { canal_id: 'canal-ensayo', tendencias: JSON.stringify({ competencia: {
    estado: 'parcial', fecha: '2026-11-21T12:00:00Z', competidores: [{ outliers: [] }], homonimos: [] } }) }])[0].json;
  const d = JSON.parse(r.resultado);
  assert.equal(d.estados.length, 1);
  assert.equal(d.estados[0].competidores, 1);
  assert.equal(d.estados[0].estado, 'parcial');
  assert.equal(d.publicacion_invocada, false);
});
