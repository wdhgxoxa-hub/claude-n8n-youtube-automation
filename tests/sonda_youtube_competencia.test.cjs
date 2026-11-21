const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const dir = mkdtempSync(join(tmpdir(), 'cooper-youtube-'));
let f;
try {
  execFileSync('python3', ['-W', 'error', 'tools/cooper/preparar_sonda_youtube_competencia.py',
    '--salida', dir, '--tabla-trabajos', 'TABLA_ENSAYO', '--canal-id', 'canal-propio', '--nombre', 'Marca de ensayo',
    '--competidor', '@cuenta-ficticia1', '--competidor', '@cuenta-ficticia2', '--competidor', '@cuenta-ficticia3'], { stdio: 'pipe' });
  f = JSON.parse(readFileSync(join(dir, 'CoopSondaYtComp1.json'), 'utf8'));
} finally { rmSync(dir, { recursive: true, force: true }); }
const codigo = nombre => f.nodes.find(n => n.name === nombre).parameters.jsCode;

test('YouTube solo permite lecturas acotadas y el getter aislado existente', () => {
  assert.equal(f.active, false);
  assert.equal(f.settings.saveDataSuccessExecution, 'none');
  assert.equal(f.settings.saveDataErrorExecution, 'none');
  assert.equal(f.settings.saveManualExecutions, false);
  const externos = f.nodes.filter(n => n.type.endsWith('.httpRequest'));
  assert.equal(externos.length, 4);
  for (const n of externos) {
    assert.equal(n.parameters.method, 'GET');
    assert.match(n.parameters.url, /^https:\/\/www\.googleapis\.com\/youtube\/v3\/(channels|playlistItems|videos|search)$/);
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
    assert.equal(n.retryOnFail, undefined);
  }
  const getter = f.nodes.filter(n => n.type.endsWith('.executeWorkflow'));
  assert.equal(getter.length, 1);
  assert.equal(getter[0].parameters.workflowId.value, 'CoopEnsayoTok01');
  assert.match(f.nodes.find(n => n.name === 'Cuatro publicaciones').parameters.jsonQuery, /maxResults:4/);
  assert.match(codigo('Videos observados'), /slice\(0,12\)/);
  for (const n of f.nodes) if (n.type.endsWith('.code')) new Function('$', '$input', '$execution', n.parameters.jsCode);
});

test('los IDs de publicaciones quedan deduplicados y limitados a doce', () => {
  const values = Array.from({ length: 18 }, (_, i) => ({ contentDetails: { videoId: `ensayo${String(i).padStart(5, '0')}` } }));
  values.push({ contentDetails: { videoId: 'https://no-es-un-id.invalid/' } }, values[0]);
  const r = new Function('$input', codigo('Videos observados'))({ all: () => [{ json: { statusCode: 200, body: { items: values } } }] });
  assert.equal(r[0].json.ids.split(',').length, 12);
  assert.equal(r[0].json.hay, true);
});

test('el diagnóstico rechaza publicaciones ajenas y no expone permisos ni fabrica métricas/formato', () => {
  const propio = 'UC1234567890123456789012', ajeno = 'UC9876543210987654321098';
  const respuesta = items => [{ statusCode: 200, body: { items } }];
  const nodos = {
    'Permiso existente': [{ ok: true, access_token: 'token-ficticio-no-salir' }],
    'Identidad pública': respuesta([{ id: propio, snippet: { title: 'Cuenta de ensayo' } }]),
    'Videos observados': [{ ids: 'video123456,otro1234567' }],
    'Métricas públicas': respuesta([
      { id: 'video123456', snippet: { channelId: propio, title: 'Video de ensayo', publishedAt: '2026-11-20T12:00:00Z' }, statistics: { likeCount: '0' }, contentDetails: { duration: 'PT40S' } },
      { id: 'otro1234567', snippet: { channelId: ajeno }, statistics: { viewCount: '999' } },
    ]),
  };
  const r = new Function('$', '$execution', codigo('Diagnóstico público'))(
    n => ({ isExecuted: !!nodos[n], all: () => (nodos[n] || []).map(json => ({ json })) }), { id: 'ensayo' });
  assert.equal(JSON.stringify(r).includes('token-ficticio-no-salir'), false);
  const d = JSON.parse(r[0].json.resultado);
  assert.equal(d.competidores[0].publicaciones.length, 1);
  assert.equal(d.competidores[0].publicaciones[0].vistas, null);
  assert.equal(d.competidores[0].publicaciones[0].likes, 0);
  assert.equal(d.competidores[0].publicaciones[0].formato, 'sin_clasificar');
  assert.equal(d.competidores[0].pais, null);
  assert.equal(d.publicacion_invocada, false);
});
