import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptarTransportes } from '../cooper/scripts/ensayo-total-transportes.mjs';
import { normalizarCompetencia, competenciaVigente, promptCompetencia } from '../cooper/src/contratos/competencia.mjs';
const workflow = id => JSON.parse(readFileSync(new URL(`../workflows/v2/${id}.json`, import.meta.url), 'utf8'));
const ejecutar = (code, datos, entrada = [{}]) => new Function('$', '$input', '$execution', '$runIndex', code)(
  nombre => ({ isExecuted: Object.hasOwn(datos, nombre), first: () => ({json:datos[nombre]}), itemMatching: () => ({json:datos[nombre]}), all: () => [{json:datos[nombre]}] }),
  {all:() => entrada.map(json => ({json}))}, {id:'ensayo-sintetico'}, 0,
);
test('transportes integrados: competencia ficticia satisface evidencia y homónimos del canal exacto', () => {
  const w = adaptarTransportes(workflow('FabTextoGPT0001')).workflow;
  const code = w.nodes.find(n => n.name === 'Intentar Codex').parameters.jsCode;
  const respuesta = ejecutar(code, {'Pedido de texto':{tarea:'radar',local:{prompt:promptCompetencia({nombre:'Canal local',nicho:'ciencia',redes:'youtube'})}}})[0].json;
  const raw = JSON.parse(respuesta.output[0].content[0].text);
  assert.equal(respuesta.ensayo, true);
  const competencia = normalizarCompetencia(raw, respuesta, 'Canal local');
  assert.equal(competenciaVigente(competencia), true);
  assert.equal(competencia.competidores.length, 3);
  assert.ok(raw.ideas.every(i => competencia.competidores.some(c => c.outliers.some(v => v.url === i.fuente_url))));
  assert.equal(competenciaVigente(normalizarCompetencia(raw, {...respuesta,fuentes_consultadas:[]}, 'Canal local')), false);
});
test('transportes integrados: aprendizaje síncrono pasa el validador real y conserva evidencia', () => {
  const original = workflow('FabAprendizaje01');
  const adaptado = adaptarTransportes(original);
  assert.equal(adaptado.sustituciones.find(s => s.nodo === 'Analizar con el plan de la PC').soportado, true);
  const evidencia = {video_id:'v-local',canal_id:'c-local',red:'youtube',ventana:'24h',fecha:new Date().toISOString(),metricas:{vistas:120,retencion:null}};
  const code = adaptado.workflow.nodes.find(n => n.name === 'Analizar con el plan de la PC').parameters.jsCode;
  const respuesta = ejecutar(code, {'Pedido al plan de aprendizaje':{prompt:'EVIDENCIA: '+JSON.stringify([evidencia])}})[0].json;
  const trabajo = {job_id:'j-local',resultado:JSON.stringify({_aprendizaje:{evidencias:[evidencia]}})};
  const validar = original.nodes.find(n => n.name === 'Validar aprendizaje del plan').parameters.jsCode;
  const out = ejecutar(validar, {'Preparar trabajo de aprendizaje':trabajo}, [respuesta])[0].json;
  assert.equal(out.estado,'listo');
  const r = JSON.parse(out.resultado);
  assert.equal(r.resultado.evidencia_version,1);
  assert.equal(r.resultado.lecciones[0].origenes[0].video_id,'v-local');
  assert.equal(r._plan.api_pagada,false);
});
