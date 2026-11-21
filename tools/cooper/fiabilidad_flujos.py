"""Políticas finales sobre TODOS los flujos. Generación offline; no ejecuta APIs.

El arbitraje por ID requiere la única base SQLite comprobada: sus escrituras
se confirman en orden. No equivale a un candado distribuido ni a una garantía
para PostgreSQL, donde una secuencia puede asignarse antes de otro commit.
"""
from copy import deepcopy

FIABILIDAD_JS = open(os.path.join(RAIZ, 'tools/cooper/fiabilidad.js'), encoding='utf-8').read()


def nodo_fiable(wf, nombre):
    return next(n for n in wf['nodes'] if n['name'] == nombre)


def callback_con_backoff(wf, nombre):
    """Cuatro intentos de UN callback idempotente, preservando su nombre de salida.

    El motor retryOnFail usa una pausa fija (máximo 5000 ms), no backoff.
    Las ramas Wait aplican 2/8/32 s, jitter y Retry-After acotado. El mismo
    cuerpo/ID firmado se reutiliza; nunca vuelven al despacho al Orquestador.
    """
    f = reabrir(wf)
    original = nodo_fiable(wf, nombre)
    plantilla = deepcopy(original)
    salida = f.conn.pop(nombre, {'main': [[]]})
    preparar = nombre + ' · preparar transporte'
    for kinds in f.conn.values():
        for edges in kinds.get('main', []):
            for edge in edges:
                if edge['node'] == nombre:
                    edge['node'] = preparar
    f.nodes.remove(original)
    code(f, preparar, "const items=$input.all(); if(items.length!==1) throw new Error('El callback requiere un único evento'); return items;")
    code(f, nombre, "const r=$json.respuesta; if(!r || typeof r!=='object' || Array.isArray(r)) throw new Error('Respuesta de callback inválida'); return [{json:r}];")
    f.conn[nombre] = salida
    anterior = preparar
    for intento in range(1, 5):
        pedir = nombre + f' · intento {intento}'
        evaluar = nombre + f' · evaluar {intento}'
        n = deepcopy(plantilla)
        n.update({'id': nid(), 'name': pedir, 'onError': 'continueRegularOutput'})
        for k in ['retryOnFail', 'maxTries', 'waitBetweenTries']:
            n.pop(k, None)
        n['parameters'].setdefault('options', {})['response'] = {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'json'}}
        f.nodes.append(n)
        code(f, evaluar, FIABILIDAD_JS + f'\nreturn [{{json:evaluarRespuestaFiable($json,{intento})}}];')
        f.chain(anterior, pedir, evaluar)
        if intento == 4:
            f.link(evaluar, nombre)
            continue
        decidir = nombre + f' · reintentar {intento}'
        pausa = nombre + f' · backoff {intento}'
        restaurar = nombre + f' · restaurar {intento}'
        iff(f, decidir, '$json.reintentar === true')
        wait(f, pausa, '={{ $json.esperaSegundos }}')
        code(f, restaurar, 'return $(' + JS(preparar) + ').all();')
        f.link(evaluar, decidir)
        f.link(decidir, pausa, 0)
        f.link(decidir, nombre, 1)
        f.link(pausa, restaurar)
        anterior = restaurar


# El informe de errores nunca reproduce mensajes, cabeceras ni URLs firmadas del proveedor.
# Conservar el aviso endurecido y su enlace de origen fijo; añadir solo diagnóstico mínimo.
mensaje = nodo_fiable(ERRORES, 'Mensaje de error')['parameters']['jsCode']
mensaje = mensaje.replace("return [{ json: { texto } }];", """
const indice=motivos.findIndex(([r])=>r.test(original));
const categoria=['cuota','timeout','credenciales','saldo','red','proveedor','parametros'][indice] || 'no_clasificado';
return [{json:{texto,diagnostico:{version:1,flujo:String(wf.id || '').slice(0,80),
 nodo:String(nodo).slice(0,120),categoria,ejecucion:String(ex.id || '').slice(0,80),reintento_de:String(ex.retryOf || '').slice(0,80)}}}];
""")
nodo_fiable(ERRORES, 'Mensaje de error')['parameters']['jsCode'] = mensaje
nodo_fiable(ERRORES, 'Avisar error')['onError'] = 'continueRegularOutput'
f = reabrir(ERRORES)
code(f, 'Fiabilidad · diagnóstico mínimo', "return [{json:{video_id:'',canal_id:'',tipo:'incidencia_tecnica',evento:String($execution.id)+':diagnostico',detalle:JSON.stringify($json.diagnostico)}}];")
dt_insert(f, 'Fiabilidad · guardar diagnóstico', 'eventos')
nodo_fiable(ERRORES, 'Fiabilidad · guardar diagnóstico')['onError'] = 'continueRegularOutput'
code(f, 'Fiabilidad · recuperar aviso', "return $('Mensaje de error').all();")
antes(f, 'Avisar error', 'Fiabilidad · diagnóstico mínimo', 'Fiabilidad · recuperar aviso')
f.chain('Fiabilidad · diagnóstico mínimo', 'Fiabilidad · guardar diagnóstico', 'Fiabilidad · recuperar aviso')

# Un timeout del disparador no demuestra que Claude no haya recibido el encargo.
# Mantenerlo pendiente permite aceptar su retorno tardío sin crear otro trabajo.
nodo_fiable(CLAUDE, 'Fallo al despertar')['parameters']['jsCode'] = "return [{json:{estado:'enviado',resultado:JSON.stringify({estado:'incierto',error:'No se confirmó la recepción; conciliar el trabajo antes de repetir.'})}}];"
nodo_fiable(CLAUDE, 'Aviso: Claude no respondió')['parameters']['text'] = tg_texto("No se confirmó la recepción del encargo de Claude. Puede seguir ejecutándose; consulta el trabajo antes de volver a enviarlo.")

# Compare-and-set sobre la fila existente: solo el retorno que cambia ENVIADO
# puede avanzar. Un segundo webhook simultáneo obtiene cero filas y responde
# sin despachar nuevamente al Orquestador.
f = reabrir(RETORNO)
n = nodo_fiable(RETORNO, 'Guardar resultado')
n['parameters']['filters']['conditions'].append({'keyName':'estado','condition':'eq','keyValue':'enviado'})
n['alwaysOutputData'] = True
iff(f, 'Fiabilidad · ganó el retorno', "!!$json.job_id && ['listo','error'].includes($json.estado)")
f.add('Fiabilidad · responder duplicado', 'n8n-nodes-base.respondToWebhook', 1.1,
    {'respondWith':'json','responseBody':'={{ { status: "duplicado" } }}','options':{'responseCode':200}})
f.conn['Guardar resultado'] = {'main':[[{'node':'Fiabilidad · ganó el retorno','type':'main','index':0}]]}
f.link('Fiabilidad · ganó el retorno', 'Responder recibido', 0)
f.link('Fiabilidad · ganó el retorno', 'Fiabilidad · responder duplicado', 1)

# Retirar reintentos ciegos de TODO efecto externo, incluidos POST de IA, Drive,
# OAuth y RPC. Solo los callbacks con ID durable se reintentan explícitamente.
for wf in ALL:
    for n in wf['nodes']:
        if n['type'].endswith('.lmChatOpenAi'):
            n['parameters'].setdefault('options', {}).update({'timeout':45000,'maxRetries':0})
        if n['type'].endswith('.httpRequest'):
            p = n['parameters']
            options = p.setdefault('options', {})
            options.setdefault('timeout', 60000)
            if p.get('method', 'GET').upper() not in ['GET', 'HEAD', 'OPTIONS']:
                for k in ['retryOnFail', 'maxTries', 'waitBetweenTries']:
                    n.pop(k, None)
            # La pausa por nodo limita ráfagas por ejecución, no la cuota entre pilas.
            options.setdefault('batching', {'batch': {'batchSize': 1, 'batchInterval': 1100}})

for wf in [COOPER, PROGRESO_COOPER, VALIDAR_PRESENTACION]:
    callbacks = [n['name'] for n in wf['nodes'] if n['type'].endswith('.httpRequest') and n['parameters'].get('url') == '={{ $env.COOPER_WEBHOOK_URL }}']
    for nombre in callbacks:
        callback_con_backoff(wf, nombre)

# Consultar TODO el historial del video: el calendario de treinta días no es una
# barrera de idempotencia. Una reserva incierta nunca caduca ni se reenvía sola.
f = reabrir(REDES)
lista_cooper(f, 'Fiabilidad · publicaciones del video', 'publicaciones', [{'keyName':'video_id','condition':'eq','keyValue':"={{ $('Inicio').first().json.video_id }}"}])
lista_cooper(f, 'Fiabilidad · reservas de publicación', 'eventos', [
    {'keyName':'video_id','condition':'eq','keyValue':"={{ $('Inicio').first().json.video_id }}"},
    {'keyName':'tipo','condition':'eq','keyValue':'reserva_publicacion'}])
antes(f, 'Plan de publicación', 'Fiabilidad · publicaciones del video', 'Fiabilidad · reservas de publicación')
f.link('Fiabilidad · publicaciones del video', 'Fiabilidad · reservas de publicación')
n = nodo_fiable(REDES, 'Plan de publicación')
n['parameters']['jsCode'] = FIABILIDAD_JS + '\n' + n['parameters']['jsCode']
cambiar(REDES, 'Plan de publicación', 'const envios = []; const sinCupo = [];', "const envios = []; const sinCupo = []; const repetidos=[];\nconst historico=$('Fiabilidad · publicaciones del video').all().map(i=>i.json), reservas=$('Fiabilidad · reservas de publicación').all().map(i=>i.json);")
cambiar(REDES, 'Plan de publicación', '  const cuando = hueco(red, dia, hora,', "  if(publicacionYaReservada(e.video_id,tipo,red,historico,reservas)){repetidos.push(tipo+' '+red);return;}\n  const cuando = hueco(red, dia, hora,")
cambiar(REDES, 'Plan de publicación', "motivo: sinCupo.length ?", "motivo: repetidos.length ? 'envíos previos o inciertos; conciliar antes de volver a publicar: '+repetidos.join(', ') : sinCupo.length ?")
cambiar(REDES, 'Plan de publicación', 'return { json: { tipo: v.tipo, plataformas:', 'return { json: { clave_publicacion:clavePublicacionFiable(e.video_id,v.tipo,v.red), tipo: v.tipo, plataformas:')
code(f, 'Fiabilidad · reservar envíos', r"""
const e=$('Inicio').first().json;
return $input.all().map(i=>({json:{video_id:e.video_id,canal_id:e.canal_id,tipo:'reserva_publicacion',evento:i.json.clave_publicacion,detalle:JSON.stringify({estado:'incierto',ejecucion:String($execution.id),tipo:i.json.tipo,red:i.json.plataformas})}}));
""")
dt_insert(f, 'Fiabilidad · guardar reservas', 'eventos')
lista_cooper(f, 'Fiabilidad · verificar reservas', 'eventos', [
    {'keyName':'video_id','condition':'eq','keyValue':"={{ $('Inicio').first().json.video_id }}"},
    {'keyName':'tipo','condition':'eq','keyValue':'reserva_publicacion'}])
code(f, 'Fiabilidad · comprobar turno', FIABILIDAD_JS + r"""
const pedidos=$('Plan de publicación').all().map(i=>i.json),propias=$('Fiabilidad · guardar reservas').all().map(i=>i.json);
return elegirReservasPublicacion(pedidos,propias,$input.all().map(i=>i.json)).map(p=>({json:p}));
""")
antes(f, 'Subir a redes', 'Fiabilidad · reservar envíos', 'Fiabilidad · comprobar turno')
f.chain('Fiabilidad · reservar envíos', 'Fiabilidad · guardar reservas', 'Fiabilidad · verificar reservas', 'Fiabilidad · comprobar turno')
for nombre in ['Filas de publicación', 'Resumen de publicación']:
    cambiar(REDES, nombre, "$('Plan de publicación').all()", "$('Fiabilidad · comprobar turno').all()")
cambiar(REDES, 'Filas de publicación', "estado: id ? (p.programado ? 'programado' : 'enviado') : 'error'", "estado: id ? (p.programado ? 'programado' : 'enviado') : 'incierto'")
cambiar(REDES, 'Filas de publicación', "{ error: r.error?.message || r.message || r.error || 'sin request_id' }", "{ error: 'Resultado incierto: conciliar con el proveedor antes de reenviar' }")
nodo_fiable(REDES, 'Video publicado')['parameters']['jsCode'] = r"""
const filas=$('Filas de publicación').all().map(i=>i.json),ok=filas.filter(f=>f.request_id);
// Un request_id solo confirma aceptación: Confirmar publicaciones acredita la salida real.
const estado=ok.length!==filas.length?'error_publicacion':ok.every(f=>f.estado==='programado')?'programado':'en_proceso';
return [{json:{estado,etapa:estado==='programado'?'programado':'publicacion',publicado_en:ok[0]?.publicado_en || '',error:ok.length===filas.length?'':'Hay envíos inciertos; requieren conciliación antes de repetir.'}}];
"""

# La ruta heredada de YouTube comparte la MISMA clave que M8. No basta quitar
# retryOnFail: otra aprobación o ejecución puede volver a abrir una sesión.
f = reabrir(ORQ)
lista_cooper(f, 'Fiabilidad · publicaciones YouTube', 'publicaciones', [{'keyName':'video_id','condition':'eq','keyValue':"={{ $('Inicio').first().json.video_id }}"}])
filtros_yt = [{'keyName':'video_id','condition':'eq','keyValue':"={{ $('Inicio').first().json.video_id }}"},
    {'keyName':'tipo','condition':'eq','keyValue':'reserva_publicacion'}]
lista_cooper(f, 'Fiabilidad · reservas YouTube', 'eventos', filtros_yt)
code(f, 'Fiabilidad · preparar YouTube', FIABILIDAD_JS + r"""
const v=$('Video (publicar)').first().json;
const previas=$('Fiabilidad · publicaciones YouTube').all().map(i=>i.json),reservas=$input.all().map(i=>i.json);
if(v.youtube_id || publicacionYaReservada(v.video_id,'principal','youtube',previas,reservas)) throw new Error('YouTube tiene un envío previo o incierto; conciliar antes de volver a subir');
return [{json:{video_id:v.video_id,canal_id:v.canal_id,tipo:'reserva_publicacion',evento:clavePublicacionFiable(v.video_id,'principal','youtube'),detalle:JSON.stringify({estado:'incierto',ejecucion:String($execution.id),tipo:'principal',red:'youtube'})}}];
""")
dt_insert(f, 'Fiabilidad · guardar reserva YouTube', 'eventos')
lista_cooper(f, 'Fiabilidad · verificar reserva YouTube', 'eventos', filtros_yt)
code(f, 'Fiabilidad · comprobar YouTube', FIABILIDAD_JS + r"""
const v=$('Video (publicar)').first().json,pedido={clave_publicacion:clavePublicacionFiable(v.video_id,'principal','youtube')};
const propias=$('Fiabilidad · guardar reserva YouTube').all().map(i=>i.json);
if(!elegirReservasPublicacion([pedido],propias,$input.all().map(i=>i.json)).length) throw new Error('Otro intento reservó la subida a YouTube; no repetir');
return $('Token del canal').all();
""")
antes(f, 'Abrir subida YouTube', 'Fiabilidad · publicaciones YouTube', 'Fiabilidad · comprobar YouTube')
f.chain('Fiabilidad · publicaciones YouTube', 'Fiabilidad · reservas YouTube', 'Fiabilidad · preparar YouTube',
    'Fiabilidad · guardar reserva YouTube', 'Fiabilidad · verificar reserva YouTube', 'Fiabilidad · comprobar YouTube')

# El presupuesto de ejecución de n8n cabe antes del próximo reloj. Un timeout
# HTTP NO cancela el worker remoto: posibles solapamientos siguen dependiendo
# de sus CAS/checkpoints; tampoco se serializan aquí activaciones manuales.
TIEMPO.update({'CooperMarcasPub1': 240, 'CooperMarcasMet1': 240})
nodo_fiable(MARCA_PUBLICAR, 'Reloj')['parameters']['rule']['interval'] = [{'field':'minutes','minutesInterval':5}]
for wf in [MARCA_PUBLICAR, MARCA_METRICAS]:
    nodo_fiable(wf, 'Atender marcas en Cooper')['parameters']['options']['timeout'] = 210000

# Aplicar al final, después de crear Marcas: ninguna incorporación queda fuera.
for wf in ALL:
    wf['settings'].update({'executionTimeout':TIEMPO.get(wf['id'],300),
        'saveDataErrorExecution':'none','saveDataSuccessExecution':'none',
        'saveManualExecutions':False,'saveExecutionProgress':False})
    if wf['id'] == W['errores']:
        wf['settings'].pop('errorWorkflow', None)
    else:
        wf['settings']['errorWorkflow'] = W['errores']
    for n in wf['nodes']:
        n['parameters'] = recorrer(n['parameters'])
