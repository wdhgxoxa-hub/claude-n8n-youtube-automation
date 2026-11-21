const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const modulePath = '../cooper/scripts/ensayo-render-medios.mjs';
const scene = (text, duration = 3) => ({ type: 'composition', duration, elements: [{ type: 'text', text, time: .2, duration: 2 }] });

test('render local conserva tiempos acumulados y texto del montaje real', async () => {
  const { subtitulosDeComposicion } = await import(modulePath);
  assert.deepEqual(subtitulosDeComposicion({ elements: [scene('La luz'), scene('del cielo', 4)] }), {
    duration: 7, cues: [{ start: .2, end: 2.2, text: 'La luz' }, { start: 3.2, end: 5.2, text: 'del cielo' }],
  });
});
test('render local rechaza subtítulos fuera de escena y superposiciones', async () => {
  const { subtitulosDeComposicion } = await import(modulePath);
  assert.throws(() => subtitulosDeComposicion({ elements: [scene('fuera', 1)] }));
  const overlap = scene('uno');
  overlap.elements.push({ type: 'text', text: 'dos', time: 1, duration: 1 });
  assert.throws(() => subtitulosDeComposicion({ elements: [overlap] }));
  assert.throws(() => subtitulosDeComposicion({ elements: [{ type: 'audio', duration: 5 }] }));
});
test('render local nunca obtiene archivos de una URL externa ni permite IDs inventados', async () => {
  const { crearMediosLocales } = await import(modulePath);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cooper-medios-'));
  try {
    const media = crearMediosLocales(temporary);
    for (const url of ['https://example.com/imagen.png', 'file:///etc/passwd', 'https://drive.google.com/uc?export=download&id=desconocido', 'https://render-local.invalid/falso.mp4', 'https://x:y@render-local.invalid/falso.mp4']) {
      await assert.rejects(media.atender({ op: 'comprobar', entrada: { url } }));
    }
    await assert.rejects(media.atender({ op: 'consultar', entrada: { id: 'falso' } }));
    await assert.rejects(media.atender({ op: 'publicar' }));
    assert.equal(media.resumen().archivos.length, 0);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
