"""Puente local primero, API Responses como respaldo; se ejecuta en el generador."""
TEXTO_JS = open(os.path.join(RAIZ, 'servicios/puente-codex/contrato.cjs'), encoding='utf-8').read().split('module.exports =')[0]
W['texto'] = 'FabTextoGPT0001'
f = Flow(W['texto'], 'FX · Texto GPT con respaldo')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Pedido de texto', r"""
const e = $('Inicio').first().json, aj = $('Leer ajustes').first().json;
if (!['critico','critico_nicho','verificador','radar','radar_noticia','verificador_noticia'].includes(e.tarea) || !e.body?.input) throw new Error('Pedido de texto inválido');
if (!Number.isFinite(Number(e.costo_estimado_usd)) || Number(e.costo_estimado_usd) < 0) throw new Error('Tarifa estimada inválida');
const prompt = e.body.input.flatMap(m => m.content || []).filter(c => c.type === 'input_text').map(c => c.text).join('\n');
if (!prompt || prompt.length > 60000) throw new Error('Texto fuera de límites');
const buscar_web = !!e.body.tools?.some(t => t.type === 'web_search');
const url = String($env.PUENTE_CODEX_URL || 'http://127.0.0.1:8789');
if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(url)) throw new Error('El puente debe usar loopback');
return [{json:{...e, local:{tarea:e.tarea,prompt,buscar_web}, url, api_permitida:aj.allowTextoApi === true}}];
""")
http(f, 'Intentar Codex', 'POST', "={{ $('Pedido de texto').first().json.url + '/v1/texto' }}",
     body="={{ $('Pedido de texto').first().json.local }}", auth=False,
     headers={'Authorization':"={{ 'Bearer ' + $env.PUENTE_CODEX_TOKEN }}"}, timeout=45000)
f.nodes[-1]['onError'] = 'continueRegularOutput'
code(f, 'Evaluar Codex', TEXTO_JS + r"""
const p = $('Pedido de texto').first().json, r = $json;
const investigacion = !p.local.buscar_web || r.busqueda_real === true;
const noticias = !p.tarea.includes('noticia') || Array.isArray(r.fuentes_consultadas) && r.fuentes_consultadas.length > 0;
return [{json:{ok:r.ruta === 'codex' && textoValido(p.tarea,r) && investigacion && noticias}}];
""")
iff(f, '¿Codex respondió?', '$json.ok === true')
code(f, 'Permitir respaldo', "if (!$('Pedido de texto').first().json.api_permitida) throw new Error('Texto detenido: Codex falló y el respaldo API está apagado'); " + devolver_items())
http(f, 'Respaldo OpenAI', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { ...$('Pedido de texto').first().json.body, store:false, ...($('Pedido de texto').first().json.local.buscar_web ? {include:['web_search_call.action.sources']} : {}) } }}", cred=CRED_OPENAI, timeout=180000)
f.nodes[-1]['onError'] = 'continueRegularOutput'
code(f, 'Resultado de texto', TEXTO_JS + r"""
const p = $('Pedido de texto').first().json;
const local = $('Evaluar Codex').first().json.ok;
const r = local ? $('Intentar Codex').first().json : $('Respaldo OpenAI').first().json;
if (!textoValido(p.tarea,r)) throw new Error('Texto detenido: ambas rutas fallaron');
const busqueda_real = local ? r.busqueda_real === true : (r.output || []).some(x => x.type === 'web_search_call' && x.status === 'completed');
if (p.local.buscar_web && !busqueda_real) throw new Error('Texto detenido: no hubo búsqueda web');
const tarifa = Number(p.costo_estimado_usd);
if (!Number.isFinite(tarifa) || tarifa < 0) throw new Error('Tarifa estimada inválida');
return [{json:{...r, ruta:local ? 'codex' : 'openai_api', busqueda_real,
  fuentes_consultadas:local ? r.fuentes_consultadas : fuentesRespuesta(r),
  texto_uso:{ruta:local ? 'codex' : 'openai_api', motivo_respaldo:local ? '' : 'fallo_timeout_o_respuesta_invalida',
    usd:local ? 0 : tarifa, ahorro_estimado_usd:local ? tarifa : 0, estimado:true}}}];
""")
f.chain('Inicio','Leer ajustes','Pedido de texto','Intentar Codex','Evaluar Codex','¿Codex respondió?')
f.link('¿Codex respondió?','Resultado de texto',0)
f.link('¿Codex respondió?','Permitir respaldo',1)
f.chain('Permitir respaldo','Respaldo OpenAI','Resultado de texto')
TEXTO = f.dump()

def texto_gpt(wf, nombre, tarea, costo):
    """Conserva nombre/salida del HTTP legado; cada ítem lleva su pedido propio."""
    f = reabrir(wf)
    node = next(n for n in f.nodes if n['name'] == nombre)
    body = escapar_saltos(node['parameters']['jsonBody'])[3:-2].strip()
    pedido = 'Texto · ' + nombre
    code1(f, pedido, 'return {json:{tarea:' + JS(tarea) + ', body:' + body + ', costo_estimado_usd:' + costo + '}};')
    antes(f, nombre, pedido, pedido)
    temp = Flow('temp','temp'); call(temp, nombre, W['texto'], each=True)
    for key in ['credentials','onError','retryOnFail','maxTries','waitBetweenTries']:
        node.pop(key,None)
    node.update({k:temp.nodes[0][k] for k in ['type','typeVersion','parameters']})

for wf, nombre, tarea, costo in [
    (ORQ,'Crítico de nichos','critico_nicho','costoCriticoUsd'),
    (ORQ,'Crítico del guion','critico','costoCriticoUsd'),
    (ORQ,'Verificar cifras','verificador','costoVerificacionUsd'),
    (RADAR,'Analista de tendencias','radar','costoRadarUsd'),
]:
    texto_gpt(wf,nombre,tarea,"$('Leer ajustes').first().json." + costo)

# Los costos existentes ahora registran el proveedor efectivo y el ahorro estimado.
for wf, nombre, origen in [
    (ORQ,'Fila de costo (verificación)','Verificar cifras'), (ORQ,'Fila de costo (crítico)','Crítico del guion'),
    (ORQ,'Cooper · costo Crítico de nichos','Crítico de nichos'), (RADAR,'Cooper · costo Analista de tendencias','Analista de tendencias'),
]:
    n = next(n for n in wf['nodes'] if n['name']==nombre)
    n['parameters']['jsCode'] = 'const originales = (() => { ' + n['parameters']['jsCode'] + ' })();\n' + "return originales.map((i,k) => { const u=$('" + origen + "').all()[k].json.texto_uso; return {json:{...i.json,...u,servicio:u.ruta === 'codex' ? 'Codex (plan ChatGPT)' : 'OpenAI API'}}; });"
cambiar(COSTO_COOPER,'Costo atribuido', 'dueno_email: dueno, estimado:',
        "ruta: c.ruta || '', ahorro_estimado_usd: Number(c.ahorro_estimado_usd) || 0, motivo_respaldo: c.motivo_respaldo || '', dueno_email: dueno, estimado:")
