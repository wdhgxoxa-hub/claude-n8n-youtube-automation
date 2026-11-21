// Contrato del lote local: repositorios efímeros, sin red, n8n ni credenciales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const tool = path.resolve(__dirname, '../tools/cooper/preparar_lote_auditoria.py');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const python = `import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('lote', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.preparar(pathlib.Path(sys.argv[3]), root=pathlib.Path(sys.argv[2]), base=sys.argv[4], expected_count=2)
`;

function workflow(id, salt = 'base') {
  return {
    id, name: `F · ${id}`, active: true, activeVersionId: 'version-publicada',
    activeVersion: { nodes: [{ name: 'No trasladar versión publicada' }] },
    nodes: [{ id: `nodo-${salt}`, name: 'Inicio', type: 'n8n-nodes-base.if',
      parameters: { conditions: { conditions: [{ id: `condicion-${salt}`,
        leftValue: '={{ $json.permitido }}', rightValue: true, operator: { operation: 'true' } }] },
      body: { id: 'id-de-negocio', workflowId: 'Auxiliar' } } }],
    connections: {}, settings: { errorWorkflow: 'Errores' },
  };
}

function fixture(t) {
  const temp = mkdtempSync(path.join(tmpdir(), 'cooper-lote-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo');
  mkdirSync(path.join(repo, 'workflows/v2'), { recursive: true });
  mkdirSync(path.join(repo, 'docs'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const save = (name, data) => writeFileSync(path.join(repo, `workflows/v2/${name}.json`), JSON.stringify(data));
  git('init', '--initial-branch=ensayo');
  git('config', 'user.name', 'Prueba local');
  git('config', 'user.email', 'prueba@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(path.join(repo, 'docs/cooper-n8n-auditoria-lote.md'), '# Guía de prueba local\n');
  save('Uno', workflow('Uno'));
  save('Retirado', workflow('Retirado'));
  git('add', '.'); git('commit', '-m', 'Base ficticia');
  const base = git('rev-parse', 'HEAD');
  save('Uno', workflow('Uno', 'regenerado'));
  rmSync(path.join(repo, 'workflows/v2/Retirado.json'));
  save('Nuevo', workflow('Nuevo'));
  git('add', '.'); git('commit', '-m', 'Cambio ficticio');
  const head = git('rev-parse', 'HEAD');
  const output = path.join(temp, 'lote');
  const run = (destination = output, reference = base) => spawnSync('python3', ['-B', '-c', python, tool, repo, destination, reference], { encoding: 'utf8' });
  const read = name => JSON.parse(readFileSync(path.join(output, name), 'utf8'));
  return { repo, output, git, save, base, head, run, read };
}

test('lote: ambas direcciones inactivas, fuentes HEAD intactas y hashes verificables', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const manifest = f.read('manifest.json');
  assert.equal(manifest.origen, f.head);
  assert.equal(manifest.base_referencia, f.base);
  assert.equal(manifest.respaldo_real, false);
  assert.equal(manifest.activacion_automatica, false);
  assert.equal(manifest.total_entrada, 2);
  assert.equal(manifest.total_reversa_versionada, 2);
  for (const entry of manifest.archivos) {
    const data = readFileSync(path.join(f.output, entry.ruta));
    assert.equal(hash(data), entry.sha256, entry.ruta);
    if (entry.commit_fuente) {
      const wf = JSON.parse(data);
      assert.equal(wf.active, false);
      assert.equal(wf.activeVersionId, null);
      assert.equal(Object.hasOwn(wf, 'activeVersion'), false);
      const relative = entry.ruta.replace(/^(entrada|reversa-versionada)\//, '');
      const original = f.git('show', `${entry.commit_fuente}:${relative}`);
      assert.equal(entry.sha256_fuente, hash(original));
    }
  }
  assert.equal(JSON.parse(readFileSync(path.join(f.repo, 'workflows/v2/Uno.json'), 'utf8')).active, true);
  assert.equal(f.git('status', '--porcelain'), '');
  const sums = readFileSync(path.join(f.output, 'SHA256SUMS'), 'utf8').trim().split('\n');
  assert.equal(sums.length, manifest.archivos.length + 1);
  for (const line of sums) {
    const [digest, file] = line.split('  ');
    assert.equal(hash(readFileSync(path.join(f.output, file))), digest, file);
  }
});

test('lote: diff ignora UUID internos y registra altas, bajas y mapa sin inventar destino', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const changes = f.read('cambios.json');
  assert.equal(changes.find(x => x.id_entrada === 'Uno').estado, 'sin_cambio_semantico');
  assert.equal(readFileSync(path.join(f.output, 'altas.txt'), 'utf8'), 'workflows/v2/Nuevo.json\n');
  assert.equal(readFileSync(path.join(f.output, 'bajas.txt'), 'utf8'), 'workflows/v2/Retirado.json\n');
  const diff = readFileSync(path.join(f.output, 'diff-semantico.patch'), 'utf8');
  assert.doesNotMatch(diff, /nodo-base|nodo-regenerado|condicion-base|condicion-regenerado/);
  assert.doesNotMatch(diff, /HEAD\/workflows\/v2\/Uno\.json/);
  assert.match(diff, /\/dev\/null/);
  assert.match(diff, /id-de-negocio/);
  const ids = f.read('mapa-ids.json');
  assert.deepEqual(ids.map(x => x.id_versionado), ['Nuevo', 'Retirado', 'Uno']);
  assert.ok(ids.every(x => x.id_destino === null && x.pila_destino === null && !x.revisado));
  assert.equal(ids.find(x => x.id_versionado === 'Retirado').ruta_entrada, null);
});

test('lote: cambios reales de condiciones, IDs de negocio y referencias no se ocultan', t => {
  const f = fixture(t);
  const changed = workflow('Uno', 'otra-regeneracion');
  changed.nodes[0].parameters.conditions.conditions[0].rightValue = false;
  changed.nodes[0].parameters.body.id = 'otro-id-de-negocio';
  changed.settings.errorWorkflow = 'OtrosErrores';
  f.save('Uno', changed); f.git('add', '.'); f.git('commit', '-m', 'Cambiar semántica');
  assert.equal(f.run().status, 0);
  assert.equal(f.read('cambios.json').find(x => x.id_entrada === 'Uno').estado, 'modificado');
  const diff = readFileSync(path.join(f.output, 'diff-semantico.patch'), 'utf8');
  assert.match(diff, /otro-id-de-negocio/);
  assert.match(diff, /OtrosErrores/);
  assert.match(diff, /"rightValue": false/);
});

test('lote: rechaza cambios de workflows pendientes, incluidos archivos sin seguimiento', t => {
  const f = fixture(t);
  f.save('Uno', workflow('Uno', 'pendiente'));
  assert.notEqual(f.run().status, 0);
  assert.equal(existsSync(f.output), false);
  f.git('restore', 'workflows/v2/Uno.json');
  f.save('SinSeguimiento', workflow('SinSeguimiento'));
  assert.notEqual(f.run().status, 0);
  assert.equal(existsSync(f.output), false);
});

test('lote: reproducible, no sobrescribe evidencia y no incluye otros archivos del repositorio', t => {
  const f = fixture(t);
  // Un artefacto ajeno pendiente no entra en el lote ni impide empaquetar HEAD.
  writeFileSync(path.join(f.repo, 'ajeno.txt'), 'contenido ajeno ficticio');
  assert.equal(f.run().status, 0);
  const other = `${f.output}-repetido`;
  assert.equal(f.run(other).status, 0);
  assert.deepEqual(readFileSync(path.join(f.output, 'SHA256SUMS')), readFileSync(path.join(other, 'SHA256SUMS')));
  assert.notEqual(f.run().status, 0);
  assert.ok(f.read('manifest.json').archivos.every(x => !x.ruta.includes('ajeno')));
});

test('lote: rechaza IDs duplicados y conteo distinto del contrato', t => {
  const f = fixture(t);
  f.save('Nuevo', workflow('Uno')); f.git('add', '.'); f.git('commit', '-m', 'Duplicado ficticio');
  assert.notEqual(f.run().status, 0);
  assert.equal(existsSync(f.output), false);
  f.save('Nuevo', workflow('Nuevo')); f.save('Tercero', workflow('Tercero'));
  f.git('add', '.'); f.git('commit', '-m', 'Conteo ficticio');
  assert.notEqual(f.run().status, 0);
  assert.equal(existsSync(f.output), false);
});

test('lote: solo acepta una base ancestral de HEAD', t => {
  const f = fixture(t);
  f.git('checkout', '-b', 'otra-base', f.base);
  writeFileSync(path.join(f.repo, 'independiente.txt'), 'rama de prueba');
  f.git('add', '.'); f.git('commit', '-m', 'Otra base ficticia');
  const divergent = f.git('rev-parse', 'HEAD');
  f.git('checkout', 'ensayo');
  assert.notEqual(f.run(f.output, divergent).status, 0);
  assert.equal(existsSync(f.output), false);
});
