import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const helper = new URL('../cooper/scripts/ensayo-infra.mjs', import.meta.url).href;
const n8n = JSON.parse(readFileSync(new URL('../deploy/infra-imagenes.json', import.meta.url))).servicios.n8n;
const code = `import { N8N_IMAGE, N8N_VERSION } from ${JSON.stringify(helper)}; console.log(JSON.stringify({imagen:N8N_IMAGE,version:N8N_VERSION}));`;
const env = () => Object.fromEntries(['PATH', 'HOME', 'LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));

test('el ensayo adopta la candidata fijada por digest sin invocar Podman', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {env:env(),encoding:'utf8'}));
  assert.deepEqual(result, {imagen:n8n.imagen,version:n8n.version});
});

test('la comparación admite únicamente la referencia anterior registrada', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {env:{...env(),COOPER_ENSAYO_N8N_IMAGEN:n8n.anterior},encoding:'utf8'}));
  assert.equal(result.imagen, n8n.anterior);
  assert.equal(result.version, n8n.anterior.match(/:(\d+\.\d+\.\d+)@/)[1]);
});

test('rechaza etiquetas mutables, imágenes ajenas y argumentos antes de crear recursos', () => {
  for (const imagen of ['ghcr.io/n8n-io/n8n:latest', 'ghcr.io/n8n-io/n8n:2.47.6', 'localhost/ajena:1', '--network=host', '']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {env:{...env(),COOPER_ENSAYO_N8N_IMAGEN:imagen},encoding:'utf8'});
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /La imagen de ensayo debe ser la candidata o la anterior/);
  }
});
