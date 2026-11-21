const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('e2e: el exportador SQLite solo copia datos autorizados y deniega campos privados', () => {
  const result = spawnSync('python3', ['-B', path.join(__dirname, 'copiar_datos_ensayo_test.py')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /warning/i);
});
