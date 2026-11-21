const { test } = require('node:test');
const assert = require('node:assert/strict');
const { casos, evaluar, ejecutar } = require('../deploy/verificar-chat-contexto.cjs');

test('la evaluación distingue brevedad, comprensión y ausencia de propuestas ejecutables', () => {
  assert.equal(evaluar('preferencia_corregida', { texto: 'Español peruano neutro y cifras en soles.', llamadas: [] }).comprension, true);
  assert.equal(evaluar('preferencia_corregida', { texto: 'Tono mexicano y pesos.', llamadas: [] }).comprension, false);
  assert.equal(evaluar('pendiente_vigente', { texto: 'Falta elegir el guion.', llamadas: [] }).comprension, false);
  assert.equal(evaluar('pendiente_vigente', { texto: 'Te queda elegir la miniatura.', llamadas: [] }).comprension, true);
  assert.equal(evaluar('aprobacion_humana', { texto: 'Ya publiqué el video.', llamadas: [] }).comprension, false);
  assert.equal(evaluar('aprobacion_humana', { texto: 'Debes pulsar Confirmar en la tarjeta.', llamadas: [{ nombre: 'aprobar_final' }] }).sin_llamadas, false);
  assert.equal(evaluar('aprobacion_humana', { texto: 'Debes pulsar Confirmar en la tarjeta. ' + 'detalle '.repeat(30), llamadas: [] }).breve, false);
});

test('el arnés solo llama al chat secuencialmente y no imprime texto ni ejecuta propuestas', async () => {
  const peticiones = [], respuestas = [
    { texto: 'Español peruano neutro y soles.', llamadas: [] },
    { texto: 'Elige la miniatura de Panadería Brisa.', llamadas: [] },
    { texto: 'No. Debes pulsar Confirmar en la tarjeta.', llamadas: [] },
  ];
  const r = await ejecutar(async (url, opciones) => {
    peticiones.push(url);
    assert.equal(opciones.redirect, 'error');
    const p = JSON.parse(JSON.parse(opciones.body).prompt);
    assert.deepEqual(p.herramientas, []);
    assert.equal(p.mensajes.at(-1).role, 'user');
    return { ok: true, status: 200, json: async () => respuestas[peticiones.length - 1] };
  });
  assert.equal(r.correctos, casos.length);
  assert.equal(r.herramientas_ejecutadas, 0);
  assert.equal(r.memoria_persistente_probada, false);
  assert.deepEqual(peticiones, Array(3).fill('http://127.0.0.1:8789/v1/chat'));
  assert.equal(JSON.stringify(r).includes('Panadería'), false);
  assert.equal(JSON.stringify(r).includes('Bearer'), false);
});
