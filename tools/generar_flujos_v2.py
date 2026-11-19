#!/usr/bin/env python3
"""Genera los flujos v2 de la fábrica para n8n 2.47.

Uso: python3 tools/generar_flujos_v2.py  -> escribe workflows/v2/*.json
Todo el gasto queda apagado en F · Ajustes hasta que se active a propósito.
"""
import json, os, uuid

OUT = os.path.join(os.path.dirname(__file__), '..', 'workflows', 'v2')

# --- Identificadores reales de la instancia -------------------------------------------
CRED_TG = {'telegramApi': {'id': 'MOSawTRQa5BzV3pt', 'name': 'Telegram account'}}
CRED_ROUTINE = {'httpHeaderAuth': {'id': 'EbZbO2zRt0RXWkfA', 'name': 'Claude Routine'}}
CRED_OPENAI = {'httpHeaderAuth': {'id': 'FabCredOpenAI001', 'name': 'OpenAI'}}
CRED_GEMINI = {'httpHeaderAuth': {'id': 'FabCredGemini001', 'name': 'Gemini (Veo)'}}  # también sirve para Gemini Omni
CRED_EPIDEMIC = {'httpHeaderAuth': {'id': 'FabCredEpidemic1', 'name': 'Epidemic Sound'}}
CRED_PEXELS = {'httpHeaderAuth': {'id': 'FabCredPexels001', 'name': 'Pexels'}}
CRED_PIXABAY = {'httpQueryAuth': {'id': 'FabCredPixabay01', 'name': 'Pixabay'}}
CRED_CREATOMATE = {'httpHeaderAuth': {'id': 'mtHyTqYtuZSQYGWN', 'name': 'Creatomate'}}
CRED_CLAVE = {'httpHeaderAuth': {'id': 'Ve0w86W7EdgFTIJi', 'name': 'Clave Fábrica'}}
T = {  # tablas de datos
    'canales': 'dA6t0L2GGon32eFp', 'videos': 'VIfMDnjzrrw1p2EA', 'planos': 'GdWqVXaxFOEiZKQ9',
    'eventos': 'FE0Mjte3k2UOEbbE', 'costos': 'vk7TvbIvNcTbmkVv', 'trabajos': 'BIHxr4bhuShuU9pS',
}
W = {  # flujos
    'ajustes': 'FabAjustes000001', 'claude': 'FabLlamarClaude1', 'retorno': 'FabRetornoClaud1',
    'orq': 'FabOrquestador01', 'aprob': 'FabAprobacion001', 'prod': 'FabProduccion001',
    'pub': 'FabPublicacion01', 'aprende': 'FabAprendizaje01', 'agente': 'FabAgenteTelegr1',
    'estado': 'FabEstado0000001', 'sonido': 'FabSonido0000001',
}
BASE = 'https://joining-jeeringly-primp.ngrok-free.dev'
ROUTINE = 'https://api.anthropic.com/v1/claude_code/routines/trig_01RyeTY2hJtwhs5PCFWXxZTA/fire'


def nid():
    return str(uuid.uuid4())


class Flow:
    def __init__(self, wid, name):
        self.wid, self.name, self.nodes, self.conn, self.x = wid, name, [], {}, 0

    def add(self, name, ntype, ver, params, pos=None, **extra):
        self.x += 220
        node = {'parameters': params, 'id': nid(), 'name': name, 'type': ntype,
                'typeVersion': ver, 'position': pos or [self.x, 0]}
        node.update(extra)
        self.nodes.append(node)
        return name

    def link(self, a, b, out=0, inp=0):
        outs = self.conn.setdefault(a, {'main': []})['main']
        while len(outs) <= out:
            outs.append([])
        outs[out].append({'node': b, 'type': 'main', 'index': inp})

    def chain(self, *names):
        for a, b in zip(names, names[1:]):
            self.link(a, b)

    def ai(self, a, b, kind):
        self.conn.setdefault(a, {}).setdefault(kind, [[]])[0].append({'node': b, 'type': kind, 'index': 0})

    def dump(self):
        return {'id': self.wid, 'name': self.name, 'nodes': self.nodes, 'connections': self.conn,
                'active': False, 'settings': {'executionOrder': 'v1', 'timezone': 'America/Lima',
                                              'callerPolicy': 'workflowsFromSameOwner'},
                'pinData': {}, 'meta': {'templateCredsSetupCompleted': True}, 'tags': []}


# --- Fábricas de nodos ------------------------------------------------------------------
def trigger(f, name='Inicio'):
    return f.add(name, 'n8n-nodes-base.executeWorkflowTrigger', 1.1, {'inputSource': 'passthrough'})


def code(f, name, js, **kw):
    return f.add(name, 'n8n-nodes-base.code', 2, {'jsCode': js}, **kw)


def call(f, name, wid, wait=True, each=False):
    # Las llamadas de vuelta al orquestador van por expresión: así el ciclo
    # orquestador → producción → publicación → aprobación → orquestador no bloquea la publicación en n8n.
    ref = "={{ '" + wid + "' }}" if wid == W['orq'] else wid
    p = {'workflowId': {'__rl': True, 'mode': 'id', 'value': ref},
         'workflowInputs': {'mappingMode': 'defineBelow', 'value': {}, 'matchingColumns': [], 'schema': [],
                            'attemptToConvertTypes': False, 'convertFieldsToString': True},
         'mode': 'each' if each else 'once', 'options': {'waitForSubWorkflow': wait}}
    return f.add(name, 'n8n-nodes-base.executeWorkflow', 1.2, p)


def iff(f, name, expr):
    p = {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 2},
                        'conditions': [{'id': nid(), 'leftValue': '={{ ' + expr + ' }}', 'rightValue': '',
                                        'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                        'combinator': 'and'}, 'options': {}}
    return f.add(name, 'n8n-nodes-base.if', 2.2, p)


def switch(f, name, n, expr='$json.salida'):
    return f.add(name, 'n8n-nodes-base.switch', 3.2,
                 {'mode': 'expression', 'numberOutputs': n, 'output': '={{ ' + expr + ' }}'})


def tg(f, name, chat, text):
    return f.add(name, 'n8n-nodes-base.telegram', 1.2,
                 {'resource': 'message', 'operation': 'sendMessage', 'chatId': chat, 'text': text,
                  'additionalFields': {'disable_web_page_preview': True, 'appendAttribution': False}},
                 credentials=CRED_TG)


def rl(table):
    return {'__rl': True, 'mode': 'id', 'value': T[table]}


AUTOMAP = {'mappingMode': 'autoMapInputData', 'value': {}, 'matchingColumns': [], 'schema': [],
           'attemptToConvertTypes': False, 'convertFieldsToString': False}


def dt_insert(f, name, table):
    return f.add(name, 'n8n-nodes-base.dataTable', 1.1,
                 {'resource': 'row', 'operation': 'insert', 'dataTableId': rl(table), 'columns': AUTOMAP, 'options': {}})


def dt_get(f, name, table, key, value):
    return f.add(name, 'n8n-nodes-base.dataTable', 1.1,
                 {'resource': 'row', 'operation': 'get', 'dataTableId': rl(table), 'matchType': 'allConditions',
                  'filters': {'conditions': [{'keyName': key, 'condition': 'eq', 'keyValue': value}]},
                  'returnAll': False, 'limit': 1}, alwaysOutputData=True)


def dt_update(f, name, table, key, value):
    return f.add(name, 'n8n-nodes-base.dataTable', 1.1,
                 {'resource': 'row', 'operation': 'update', 'dataTableId': rl(table), 'matchType': 'allConditions',
                  'filters': {'conditions': [{'keyName': key, 'condition': 'eq', 'keyValue': value}]},
                  'columns': AUTOMAP, 'options': {}})


def http(f, name, method, url, body=None, cred=None, auth=True, headers=None, timeout=60000):
    p = {'method': method, 'url': url, 'options': {'timeout': timeout}}
    if auth:
        p.update({'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth'})
    if headers:
        p.update({'sendHeaders': True, 'headerParameters': {'parameters': [{'name': k, 'value': v} for k, v in headers.items()]}})
    if body is not None:
        p.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': body})
    extra = {'credentials': cred} if cred else {}
    return f.add(name, 'n8n-nodes-base.httpRequest', 4.2, p, **extra)


def gapi(f, name, method, url, cred_type, json_body=None, binary_field=None, query=None, full=False, timeout=300000):
    """HTTP a Google con credencial OAuth predefinida: se publica sin credencial y se conecta luego."""
    p = {'method': method, 'url': url, 'authentication': 'predefinedCredentialType', 'nodeCredentialType': cred_type,
         'options': {'timeout': timeout}}
    if query:
        p.update({'sendQuery': True, 'queryParameters': {'parameters': [{'name': k, 'value': v} for k, v in query.items()]}})
    if json_body is not None:
        p.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': json_body})
    if binary_field:
        p.update({'sendBody': True, 'contentType': 'binaryData', 'inputDataFieldName': binary_field})
    if full:
        p['options']['response'] = {'response': {'fullResponse': True}}
    return f.add(name, 'n8n-nodes-base.httpRequest', 4.2, p)


def wait(f, name, seconds):
    return f.add(name, 'n8n-nodes-base.wait', 1.1, {'amount': seconds, 'unit': 'seconds'}, webhookId=nid())


A = "$('Ajustes').first().json"  # atajo a los ajustes centrales

# ======================================================================================
# F · Ajustes: único lugar donde se encienden servicios y se fijan límites
# ======================================================================================
f = Flow(W['ajustes'], 'F · Ajustes de la fábrica')
trigger(f)
code(f, 'Ajustes', r"""
// Único lugar para encender servicios. Todo lo que gasta dinero empieza apagado.
return [{ json: {
  chatId: '8667738444',
  routineUrl: '%s',
  retornoUrl: '%s/webhook/video-factory/resultado',
  allowClaude: true,          // usa tu plan de Claude, sin costo por uso
  allowImagenes: false,       // OpenAI imágenes (pago por uso)
  allowRevisionVisual: false, // OpenAI con visión para revisar planos (pago por uso)
  allowClips: false,          // clips animados con Gemini Omni (pago por segundo)
  allowVoz: false,            // voz con emoción: Gemini TTS (pago por uso, centavos)
  allowMusica: false,         // música de Epidemic Sound (incluida en tu suscripción)
  allowArchivo: true,         // video de archivo de Pexels/Pixabay (gratis)
  allowAvatar: false,         // HeyGen
  allowMontaje: false,        // Creatomate: une imagen, voz y música
  allowDrive: false,          // Google Drive para alojar y archivar
  allowYoutube: false,        // subida privada a YouTube
  allowAnalytics: false,      // YouTube Analytics para aprender
  modeloTexto: 'gpt-6-astra',
  modeloImagen: 'gpt-image-2.6-sunburst',
  modeloClip: 'gemini-omni-1.2-flash', // Veo quedó obsoleto el 22-10-2026; su reemplazo es Gemini Omni
  modeloVoz: 'gemini-3.8-flash-tts',
  vozGemini: 'Charon',        // voz grave de narrador; cambiable por canal en la biblia (voz.gemini_voice)
  costoImagenUsd: 0.06,       // estimado, se corrige con facturas reales
  costoClipSegUsd: 0.12,      // estimado prudente; corregir con la primera factura real
  presupuestoLargoUsd: 5,
  presupuestoShortUsd: 1.5,
  maxIntentosPlano: 2,
  driveCarpetaRaizId: '',
}}];
""" % (ROUTINE, BASE))
f.chain('Inicio', 'Ajustes')
AJUSTES = f.dump()

# ======================================================================================
# FX · Llamar a Claude: crea el trabajo, lo registra y despierta a la routine
# ======================================================================================
f = Flow(W['claude'], 'FX · Llamar a Claude')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Preparar trabajo', r"""
const pedido = $('Inicio').first().json;
const aj = $('Leer ajustes').first().json;
const modos = ['investigar_nichos','crear_biblia','guion','corregir_guion','storyboard','revisar_plano','aprender'];
if (!modos.includes(pedido.modo)) throw new Error('Modo desconocido: ' + pedido.modo);
const job_id = pedido.modo + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const payload = { contrato: 'fabrica-v2', modo: pedido.modo, job_id,
  video_id: pedido.video_id || '', canal_id: pedido.canal_id || '', datos: pedido.datos || {} };
return [{ json: { job_id, payload, permitido: aj.allowClaude === true, routineUrl: aj.routineUrl,
  fila: { job_id, video_id: payload.video_id, canal_id: payload.canal_id, modo: pedido.modo,
          estado: aj.allowClaude === true ? 'enviado' : 'bloqueado', resultado: '' } } }];
""")
f.add('Fila del trabajo', 'n8n-nodes-base.set', 3.4,
      {'mode': 'raw', 'jsonOutput': '={{ $json.fila }}', 'includeOtherFields': False, 'options': {}})
dt_insert(f, 'Registrar trabajo', 'trabajos')
iff(f, '¿Claude permitido?', "$('Preparar trabajo').first().json.permitido === true")
http(f, 'Despertar routine', 'POST', "={{ $('Preparar trabajo').first().json.routineUrl }}",
     body="={{ { text: JSON.stringify($('Preparar trabajo').first().json.payload) } }}",
     cred=CRED_ROUTINE, headers={'anthropic-version': '2026-10-21'}, timeout=15000)
# Fallos de red pasajeros (p. ej. DNS EAI_AGAIN): reintenta y, si sigue fallando, marca el trabajo y avisa.
f.nodes[-1].update({'retryOnFail': True, 'maxTries': 4, 'waitBetweenTries': 5000, 'onError': 'continueErrorOutput'})
code(f, 'Respuesta', "return [{ json: { job_id: $('Preparar trabajo').first().json.job_id, enviado: true } }];")
code(f, 'Fallo al despertar', "return [{ json: { estado: 'error', resultado: JSON.stringify({ error: String($json.error?.message || $json.error || 'sin detalle').slice(0, 500) }) } }];")
dt_update(f, 'Marcar trabajo fallido', 'trabajos', 'job_id', "={{ $('Preparar trabajo').first().json.job_id }}")
tg(f, 'Aviso: Claude no respondió', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ 'No pude despertar a Claude (' + $('Preparar trabajo').first().json.payload.modo + '). Reintenté 4 veces. Vuelve a enviar el pedido en un momento.' }}")
code(f, 'Bloqueado', "return [{ json: { job_id: $('Preparar trabajo').first().json.job_id, enviado: false } }];")
f.chain('Inicio', 'Leer ajustes', 'Preparar trabajo', 'Fila del trabajo', 'Registrar trabajo', '¿Claude permitido?')
f.link('¿Claude permitido?', 'Despertar routine', 0)
f.link('Despertar routine', 'Respuesta')
f.link('Despertar routine', 'Fallo al despertar', 1)
f.chain('Fallo al despertar', 'Marcar trabajo fallido', 'Aviso: Claude no respondió')
f.link('¿Claude permitido?', 'Bloqueado', 1)
CLAUDE = f.dump()

# ======================================================================================
# F · Retorno de Claude: recibe resultados autenticados y avanza el proceso
# ======================================================================================
f = Flow(W['retorno'], 'F · Retorno de Claude')
f.add('Resultado de Claude', 'n8n-nodes-base.webhook', 2,
      {'httpMethod': 'POST', 'path': 'video-factory/resultado', 'authentication': 'headerAuth',
       'responseMode': 'responseNode', 'options': {}}, credentials=CRED_CLAVE, webhookId=nid())
code(f, 'Validar', r"""
const b = $json.body || {};
const ok = typeof b.job_id === 'string' && /^[a-z_]+-[a-z0-9]+-[a-z0-9]+$/.test(b.job_id)
  && typeof b.modo === 'string' && ['ok','error'].includes(b.estado);
return [{ json: { valido: ok, job_id: b.job_id, modo: b.modo, estado: b.estado,
  resultado: b.resultado ?? null, avisos: Array.isArray(b.avisos) ? b.avisos.slice(0, 20) : [] } }];
""")
iff(f, '¿Válido?', '$json.valido === true')
dt_get(f, 'Buscar trabajo', 'trabajos', 'job_id', "={{ $('Validar').first().json.job_id }}")
iff(f, '¿Trabajo pendiente?', "$json.job_id === $('Validar').first().json.job_id && $json.estado === 'enviado'")
code(f, 'Fila actualizada', r"""
const v = $('Validar').first().json;
return [{ json: { estado: v.estado === 'ok' ? 'listo' : 'error', resultado: JSON.stringify({ resultado: v.resultado, avisos: v.avisos }) } }];
""")
dt_update(f, 'Guardar resultado', 'trabajos', 'job_id', "={{ $('Validar').first().json.job_id }}")
f.add('Responder recibido', 'n8n-nodes-base.respondToWebhook', 1.1,
      {'respondWith': 'json', 'responseBody': '={{ { status: "recibido" } }}', 'options': {'responseCode': 200}})
code(f, 'Evento', r"""
const v = $('Validar').first().json; const t = $('Buscar trabajo').first().json;
return [{ json: { evento: v.estado === 'ok' ? 'claude_ok' : 'claude_error', modo: v.modo, job_id: v.job_id,
  video_id: t.video_id || '', canal_id: t.canal_id || '', resultado: v.resultado, avisos: v.avisos } }];
""")
call(f, 'Avisar al orquestador', W['orq'], wait=False)
f.add('Responder rechazo', 'n8n-nodes-base.respondToWebhook', 1.1,
      {'respondWith': 'json', 'responseBody': '={{ { status: "rechazado" } }}', 'options': {'responseCode': 409}})
f.chain('Resultado de Claude', 'Validar', '¿Válido?')
f.link('¿Válido?', 'Buscar trabajo', 0)
f.link('¿Válido?', 'Responder rechazo', 1)
f.link('Buscar trabajo', '¿Trabajo pendiente?')
f.link('¿Trabajo pendiente?', 'Fila actualizada', 0)
f.link('¿Trabajo pendiente?', 'Responder rechazo', 1)
f.chain('Fila actualizada', 'Guardar resultado', 'Responder recibido', 'Evento', 'Avisar al orquestador')
RETORNO = f.dump()

# ======================================================================================
# F · Aprobación por Telegram: aprobar con un botón o pedir cambios por escrito
# ======================================================================================
f = Flow(W['aprob'], 'F · Aprobación por Telegram')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
f.add('Pedir aprobación', 'n8n-nodes-base.telegram', 1.2,
      {'resource': 'message', 'operation': 'sendAndWait', 'chatId': "={{ $json.chatId }}",
       'message': "={{ $('Inicio').first().json.mensaje }}", 'responseType': 'approval',
       'approvalOptions': {'values': {'approvalType': 'double', 'approveLabel': 'Aprobar',
                                      'disapproveLabel': 'Pedir cambios'}},
       'options': {'appendAttribution': False}}, credentials=CRED_TG, webhookId=nid())
iff(f, '¿Aprobado?', '$json.data?.approved === true')
f.add('Pedir cambios', 'n8n-nodes-base.telegram', 1.2,
      {'resource': 'message', 'operation': 'sendAndWait', 'chatId': "={{ $('Leer ajustes').first().json.chatId }}",
       'message': "={{ '¿Qué cambio quieres en ' + $('Inicio').first().json.etapa + '?' }}",
       'responseType': 'freeText',
       'options': {'messageButtonLabel': 'Escribir cambios', 'responseFormTitle': 'Cambios',
                   'responseFormButtonLabel': 'Enviar', 'appendAttribution': False}},
      credentials=CRED_TG, webhookId=nid())
code(f, 'Evento aprobado', "const i = $('Inicio').first().json; return [{ json: { ...i, evento: 'aprobado', mensaje: undefined } }];")
code(f, 'Evento cambios', "const i = $('Inicio').first().json; return [{ json: { ...i, evento: 'cambios', cambios: String($json.data?.text || '').slice(0, 4000), mensaje: undefined } }];")
call(f, 'Seguir (aprobado)', W['orq'], wait=False)
call(f, 'Seguir (cambios)', W['orq'], wait=False)
f.chain('Inicio', 'Leer ajustes', 'Pedir aprobación', '¿Aprobado?')
f.link('¿Aprobado?', 'Evento aprobado', 0)
f.link('Evento aprobado', 'Seguir (aprobado)')
f.link('¿Aprobado?', 'Pedir cambios', 1)
f.chain('Pedir cambios', 'Evento cambios', 'Seguir (cambios)')
APROB = f.dump()

# ======================================================================================
# F · Orquestador: máquina de estados de canales y videos
# ======================================================================================
f = Flow(W['orq'], 'F · Orquestador')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
RUTAS = ['nuevo_canal', 'claude_ok:investigar_nichos', 'aprobado:canal', 'cambios:canal',
         'claude_ok:crear_biblia', 'nuevo_video', 'claude_ok:guion', 'aprobado:guion', 'cambios:guion',
         'claude_ok:storyboard', 'aprobado:storyboard', 'cambios:storyboard', 'claude_ok:aprender',
         'aprobado:final', 'cambios:final', 'otro']
code(f, 'Ruta', r"""
const e = $('Inicio').first().json;
const clave = e.evento === 'claude_ok' ? 'claude_ok:' + (e.modo === 'corregir_guion' ? 'guion' : e.modo)
  : ['aprobado','cambios'].includes(e.evento) ? e.evento + ':' + e.etapa : e.evento;
const rutas = %s;
const i = rutas.indexOf(clave);
return [{ json: { ...e, clave, salida: i === -1 ? rutas.length - 1 : i } }];
""" % json.dumps(RUTAS))
switch(f, 'Según evento', len(RUTAS))
f.chain('Inicio', 'Leer ajustes', 'Ruta', 'Según evento')

def route(i, *names):
    f.link('Según evento', names[0], i)
    f.chain(*names)

# 0 nuevo_canal -> investigar nichos
code(f, 'Pedir nichos', "const e=$json; return [{ json: { modo:'investigar_nichos', canal_id:'', video_id:'', datos:{ criterios: e.criterios || '', rechazos: e.rechazos || [] } } }];")
call(f, 'Claude: nichos', W['claude'])
tg(f, 'Aviso: investigando', "={{ $('Leer ajustes').first().json.chatId }}", "Investigando nichos. Te mando una propuesta de canal en unos minutos.")
route(0, 'Pedir nichos', 'Claude: nichos', 'Aviso: investigando')

# 1 propuesta de canal -> aprobación
code(f, 'Mensaje de canal', r"""
const r = $json.resultado || {}; const c = r.canal || {};
const ev = (r.evidencia || []).slice(0, 5).map(x => '• ' + x.dato).join('\n');
const temas = (r.primeros_temas || []).slice(0, 5).map(t => '– ' + t).join('\n');
const mensaje = `Propuesta de canal: ${c.nombre_propuesto}\nNicho: ${c.nicho}\nPúblico: ${c.publico}\nPromesa: ${c.promesa}\n\nEvidencia:\n${ev}\n\nPrimeros temas:\n${temas}`;
return [{ json: { etapa: 'canal', mensaje: mensaje.slice(0, 3900), contexto: r, job_id: $json.job_id } }];
""")
call(f, 'Aprobar canal', W['aprob'], wait=False)
route(1, 'Mensaje de canal', 'Aprobar canal')

# 2 canal aprobado -> registrar y crear biblia
code(f, 'Nuevo canal', r"""
const c = ($json.contexto || {}).canal || {};
const canal_id = (c.nombre_propuesto || 'canal').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 40) + '-' + Date.now().toString(36).slice(-4);
return [{ json: { canal_id, nombre: c.nombre_propuesto || '', nicho: c.nicho || '', estado: 'creando_biblia', biblia_ruta: '',
  presupuesto_largo_usd: $('Leer ajustes').first().json.presupuestoLargoUsd, presupuesto_short_usd: $('Leer ajustes').first().json.presupuestoShortUsd,
  plataformas: 'youtube', formato_defecto: (c.formatos || ['largo'])[0] } }];
""")
dt_insert(f, 'Guardar canal', 'canales')
code(f, 'Pedir biblia', "const ctx = $('Según evento').first().json.contexto; return [{ json: { modo:'crear_biblia', canal_id: $('Nuevo canal').first().json.canal_id, video_id:'', datos:{ canal: ctx.canal, evidencia: ctx.evidencia, notas: '' } } }];")
call(f, 'Claude: biblia', W['claude'])
route(2, 'Nuevo canal', 'Guardar canal', 'Pedir biblia', 'Claude: biblia')

# 3 canal rechazado -> nueva investigación con el motivo
code(f, 'Reinvestigar', r"""
const e = $json; const c = (e.contexto || {}).canal || {};
return [{ json: { modo:'investigar_nichos', canal_id:'', video_id:'', datos:{ criterios: e.cambios || '', rechazos:[{ nombre: c.nombre_propuesto, nicho: c.nicho, motivo: e.cambios || '' }] } } }];
""")
call(f, 'Claude: nichos otra vez', W['claude'])
route(3, 'Reinvestigar', 'Claude: nichos otra vez')

# 4 biblia lista -> activar canal
code(f, 'Canal activo', "return [{ json: { estado:'activo', biblia_ruta: 'trabajo:' + $json.job_id } }];")
dt_update(f, 'Activar canal', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
tg(f, 'Aviso: canal listo', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ 'Canal listo: ' + $('Inicio').first().json.canal_id + '. Pídeme un video con: video ' + $('Inicio').first().json.canal_id + ' | tema' }}")
route(4, 'Canal activo', 'Activar canal', 'Aviso: canal listo')

# 5 nuevo_video -> buscar biblia y pedir guion
dt_get(f, 'Buscar canal', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
iff(f, '¿Canal activo?', "$json.estado === 'activo' && String($json.biblia_ruta).startsWith('trabajo:')")
dt_get(f, 'Buscar biblia', 'trabajos', 'job_id', "={{ $('Buscar canal').first().json.biblia_ruta.replace('trabajo:','') }}")
code(f, 'Nuevo video', r"""
const e = $('Inicio').first().json; const canal = $('Buscar canal').first().json;
const biblia = (JSON.parse($json.resultado || '{}').resultado) || {};
const formato = e.formato || canal.formato_defecto || 'largo';
const video_id = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
const presupuesto = formato === 'short' ? canal.presupuesto_short_usd : canal.presupuesto_largo_usd;
return [{ json: { fila: { video_id, canal_id: canal.canal_id, tema: String(e.tema || '').slice(0, 500), formato, etapa: 'guion', estado: 'en_proceso',
  version: 1, costo_usd: 0, presupuesto_usd: presupuesto, drive_carpeta: '', youtube_id: '', intentos: 0, error: '' },
  pedido: { modo: 'guion', canal_id: canal.canal_id, video_id, datos: { tema: e.tema, formato, biblia,
    duracion_objetivo_s: formato === 'short' ? 50 : 540, vidiq: e.vidiq === 'use' ? 'use' : 'skip' } } } }];
""")
f.add('Fila del video', 'n8n-nodes-base.set', 3.4, {'mode': 'raw', 'jsonOutput': '={{ $json.fila }}', 'includeOtherFields': False, 'options': {}})
dt_insert(f, 'Guardar video', 'videos')
code(f, 'Pedir guion', "return [{ json: $('Nuevo video').first().json.pedido }];")
call(f, 'Claude: guion', W['claude'])
tg(f, 'Aviso: escribiendo', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Escribiendo el guion de ' + $('Nuevo video').first().json.fila.video_id + '.' }}")
tg(f, 'Aviso: canal no listo', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No encuentro un canal activo con id ' + $('Inicio').first().json.canal_id + '.' }}")
f.link('Según evento', 'Buscar canal', 5)
f.link('Buscar canal', '¿Canal activo?')
f.link('¿Canal activo?', 'Buscar biblia', 0)
f.link('¿Canal activo?', 'Aviso: canal no listo', 1)
f.chain('Buscar biblia', 'Nuevo video', 'Fila del video', 'Guardar video', 'Pedir guion', 'Claude: guion', 'Aviso: escribiendo')

# 6 guion listo -> aprobación
code(f, 'Mensaje de guion', r"""
const r = $json.resultado || {}; const rb = r.rubrica || {};
const nota = Object.entries(rb).map(([k, v]) => k + ' ' + v).join(' · ');
const mensaje = `Guion: ${r.titulo}\nGancho: ${(r.ganchos || [])[r.gancho_elegido || 0] || ''}\nRúbrica: ${nota}\n\n${String(r.guion || '').slice(0, 3000)}`;
return [{ json: { etapa: 'guion', mensaje: mensaje.slice(0, 3900), contexto: r, video_id: $json.video_id, canal_id: $json.canal_id } }];
""")
call(f, 'Aprobar guion', W['aprob'], wait=False)
route(6, 'Mensaje de guion', 'Aprobar guion')

# 7 guion aprobado -> storyboard (necesita la biblia del canal)
dt_get(f, 'Canal del video', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia del video', 'trabajos', 'job_id', "={{ String($('Canal del video').first().json.biblia_ruta).replace('trabajo:','') }}")
dt_get(f, 'Video', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
code(f, 'Pedir storyboard', r"""
const e = $('Inicio').first().json; const biblia = (JSON.parse($('Biblia del video').first().json.resultado || '{}').resultado) || {};
return [{ json: { modo: 'storyboard', canal_id: e.canal_id, video_id: e.video_id,
  datos: { guion: e.contexto, biblia, formato: $('Video').first().json.formato || 'largo', notas: e.notas || '',
    presupuesto_usd: Number($('Video').first().json.presupuesto_usd) || 1.5,
    costos: { imagen_usd: $('Leer ajustes').first().json.costoImagenUsd, clip_seg_usd: $('Leer ajustes').first().json.costoClipSegUsd } } } }];
""")
call(f, 'Claude: storyboard', W['claude'])
code(f, 'Etapa storyboard', "return [{ json: { etapa: 'storyboard' } }];")
dt_update(f, 'Video en storyboard', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
route(7, 'Canal del video', 'Biblia del video', 'Video', 'Pedir storyboard', 'Claude: storyboard', 'Etapa storyboard', 'Video en storyboard')

# 8 cambios en guion -> corregir
dt_get(f, 'Canal (corrección)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (corrección)', 'trabajos', 'job_id', "={{ String($('Canal (corrección)').first().json.biblia_ruta).replace('trabajo:','') }}")
code(f, 'Pedir corrección', r"""
const e = $('Inicio').first().json; const biblia = (JSON.parse($('Biblia (corrección)').first().json.resultado || '{}').resultado) || {};
return [{ json: { modo: 'corregir_guion', canal_id: e.canal_id, video_id: e.video_id, datos: { guion: e.contexto, cambios: e.cambios || '', biblia } } }];
""")
call(f, 'Claude: corregir', W['claude'])
route(8, 'Canal (corrección)', 'Biblia (corrección)', 'Pedir corrección', 'Claude: corregir')

# 9 storyboard listo -> aprobación con costo estimado
code(f, 'Mensaje de storyboard', r"""
const r = $json.resultado || {}; const p = r.planos || [];
const cuenta = p.reduce((a, x) => (a[x.tipo] = (a[x.tipo] || 0) + 1, a), {});
const mensaje = `Storyboard listo: ${p.length} planos (${Object.entries(cuenta).map(([k, v]) => v + ' ' + k).join(', ')}).\nCosto estimado: US$${r.costo_estimado_usd ?? '?'}\n\n` +
  p.slice(0, 25).map(x => `${x.id} [${x.tipo}, ${x.encuadre}] ${String(x.texto_narrado).slice(0, 90)}`).join('\n');
return [{ json: { etapa: 'storyboard', mensaje: mensaje.slice(0, 3900), contexto: r, video_id: $json.video_id, canal_id: $json.canal_id } }];
""")
call(f, 'Aprobar storyboard', W['aprob'], wait=False)
route(9, 'Mensaje de storyboard', 'Aprobar storyboard')

# 10 storyboard aprobado -> producción
dt_get(f, 'Canal (producción)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (producción)', 'trabajos', 'job_id', "={{ String($('Canal (producción)').first().json.biblia_ruta).replace('trabajo:','') }}")
dt_get(f, 'Video (producción)', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
code(f, 'Encargo de producción', r"""
const e = $('Inicio').first().json; const v = $('Video (producción)').first().json;
const biblia = (JSON.parse($('Biblia (producción)').first().json.resultado || '{}').resultado) || {};
return [{ json: { video_id: e.video_id, canal_id: e.canal_id, formato: v.formato, presupuesto_usd: v.presupuesto_usd, storyboard: e.contexto, biblia, notas: '' } }];
""")
call(f, 'Producir', W['prod'], wait=False)
route(10, 'Canal (producción)', 'Biblia (producción)', 'Video (producción)', 'Encargo de producción', 'Producir')

# 11 cambios en storyboard -> rehacer storyboard desde el anterior
dt_get(f, 'Canal (rehacer)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (rehacer)', 'trabajos', 'job_id', "={{ String($('Canal (rehacer)').first().json.biblia_ruta).replace('trabajo:','') }}")
dt_get(f, 'Video (rehacer)', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
code(f, 'Pedir storyboard corregido', r"""
const e = $('Inicio').first().json; const biblia = (JSON.parse($('Biblia (rehacer)').first().json.resultado || '{}').resultado) || {};
return [{ json: { modo: 'storyboard', canal_id: e.canal_id, video_id: e.video_id,
  datos: { storyboard_anterior: e.contexto, biblia, formato: $('Video (rehacer)').first().json.formato || 'largo', notas: e.cambios || '',
    presupuesto_usd: Number($('Video (rehacer)').first().json.presupuesto_usd) || 1.5,
    costos: { imagen_usd: $('Leer ajustes').first().json.costoImagenUsd, clip_seg_usd: $('Leer ajustes').first().json.costoClipSegUsd } } } }];
""")
call(f, 'Claude: storyboard corregido', W['claude'])
route(11, 'Canal (rehacer)', 'Biblia (rehacer)', 'Video (rehacer)', 'Pedir storyboard corregido', 'Claude: storyboard corregido')

# 12 aprendizaje -> resumen
tg(f, 'Resumen de aprendizaje', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Aprendizaje del canal ' + $json.canal_id + ':\\n' + ($json.resultado?.resumen || 'sin cambios') }}")
route(12, 'Resumen de aprendizaje')

# 13 aprobación final -> subir en privado a YouTube
dt_get(f, 'Video (publicar)', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
iff(f, '¿YouTube encendido?', "$('Leer ajustes').first().json.allowYoutube === true")
f.add('Descargar render', 'n8n-nodes-base.httpRequest', 4.2,
      {'method': 'GET', 'url': "={{ $('Inicio').first().json.contexto.render_url }}",
       'options': {'response': {'response': {'responseFormat': 'file'}}, 'timeout': 300000}})
gapi(f, 'Abrir subida YouTube', 'POST', 'https://www.googleapis.com/upload/youtube/v3/videos', 'youTubeOAuth2Api',
     query={'uploadType': 'resumable', 'part': 'snippet,status'}, full=True, timeout=30000,
     json_body="={{ { snippet: { title: $('Video (publicar)').first().json.tema.slice(0, 95), description: ($('Inicio').first().json.contexto.creditos || []).join('\n'), categoryId: '27', defaultLanguage: 'es' }, status: { privacyStatus: 'private', selfDeclaredMadeForKids: false } } }}")
gapi(f, 'Subir a YouTube', 'PUT', "={{ $('Abrir subida YouTube').first().json.headers.location }}", 'youTubeOAuth2Api',
     binary_field='data', timeout=600000)
code(f, 'Video publicado', "return [{ json: { estado: 'publicado', etapa: 'publicado', youtube_id: $json.id || '' } }];")
dt_update(f, 'Marcar publicado', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
tg(f, 'Aviso: subido', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Subido en privado: https://youtu.be/' + $('Video publicado').first().json.youtube_id }}")
tg(f, 'Aviso: YouTube apagado', "={{ $('Leer ajustes').first().json.chatId }}", "Aprobado. Para subirlo, enciende YouTube en F · Ajustes.")
f.link('Según evento', 'Video (publicar)', 13)
f.link('Video (publicar)', '¿YouTube encendido?')
f.link('¿YouTube encendido?', 'Abrir subida YouTube', 0)
f.link('¿YouTube encendido?', 'Aviso: YouTube apagado', 1)
f.chain('Abrir subida YouTube', 'Descargar render', 'Subir a YouTube', 'Video publicado', 'Marcar publicado', 'Aviso: subido')

# 14 cambios en el video final
tg(f, 'Aviso: cambios finales', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Anotado para ' + $json.video_id + ': ' + $json.cambios + '. En la v1, los cambios finales se aplican rehaciendo el storyboard.' }}")
route(14, 'Aviso: cambios finales')

# 15 otro / errores
tg(f, 'Aviso: evento', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Aviso de la fábrica (' + $json.clave + '): ' + JSON.stringify($json.avisos || $json.error || '').slice(0, 500) }}")
route(15, 'Aviso: evento')
ORQ = f.dump()

# ======================================================================================
# M4–M6 · Producción: planos, revisión visual y montaje con freno de gasto
# ======================================================================================
f = Flow(W['prod'], 'M4–M6 · Producción')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Plan de producción', r"""
const e = $('Inicio').first().json; const aj = $('Leer ajustes').first().json;
const planos = (e.storyboard?.planos || []).filter(p => p && p.id);
const n = t => planos.filter(p => p.tipo === t).length;
// Un clip parte de una imagen generada; el archivo (Pexels/Pixabay) no cuesta.
const costo = (n('imagen') + n('clip')) * aj.costoImagenUsd + n('clip') * 8 * aj.costoClipSegUsd + n('avatar') * 1;
const faltan = [];
if (!aj.allowImagenes) faltan.push('imágenes (OpenAI)');
if (n('clip') && !aj.allowClips) faltan.push('clips (Gemini Omni)');
if (n('avatar') && !aj.allowAvatar) faltan.push('avatar (HeyGen)');
if (!aj.allowVoz) faltan.push('voz (Gemini TTS)');
if (!aj.allowDrive) faltan.push('alojamiento (Google Drive)');
if (!aj.allowMontaje) faltan.push('montaje (Creatomate)');
const presupuesto = Number(e.presupuesto_usd) || aj.presupuestoLargoUsd;
if (costo > presupuesto) faltan.push(`ajustar el storyboard al tope (cuesta ~US$${(Math.round(costo * 100) / 100)}, tope US$${presupuesto})`);
return [{ json: { ...e, planos, costo_estimado_usd: Math.round(costo * 100) / 100, presupuesto,
  dentro: costo <= presupuesto, faltan, chatId: aj.chatId } }];
""")
iff(f, '¿Todo encendido?', '$json.faltan.length === 0')
tg(f, 'Aviso: falta encender', '={{ $json.chatId }}',
   "={{ 'Producción de ' + $json.video_id + ' preparada (' + $json.planos.length + ' planos, ~US$' + $json.costo_estimado_usd + '). Falta encender: ' + $json.faltan.join(', ') + '.' }}")
iff(f, '¿Dentro del presupuesto?', '$json.dentro === true')
tg(f, 'Aviso: sobre presupuesto', '={{ $json.chatId }}',
   "={{ 'El video ' + $json.video_id + ' costaría ~US$' + $json.costo_estimado_usd + ' y el tope es US$' + $json.presupuesto + '. Reduce clips o sube el tope.' }}")
code(f, 'Un ítem por plano', r"""
const e = $('Plan de producción').first().json; const b = e.biblia || {};
const estilo = [b.estilo_visual?.descripcion, b.estilo_visual?.luz, b.estilo_visual?.lente, b.estilo_visual?.textura,
  (b.estilo_visual?.paleta_hex || []).length ? 'paleta ' + b.estilo_visual.paleta_hex.join(' ') : ''].filter(Boolean).join('. ');
const refs = id => [...(b.personajes || []), ...(b.escenarios || [])].filter(x => (id || []).includes(x.id)).flatMap(x => x.referencias_urls || []).slice(0, 6);
return e.planos.map(p => ({ json: { video_id: e.video_id, plano: p, intento: 1,
  prompt: `${p.prompt_imagen}. Encuadre ${p.encuadre}, ángulo ${p.angulo || 'a la altura de los ojos'}, luz ${p.luz}. Estilo: ${estilo}. Sin texto ni logos.`,
  referencias: refs([...(p.personajes || []), p.escenario]),
  salida: p.tipo === 'avatar' ? 1 : (p.tipo === 'archivo' && $('Leer ajustes').first().json.allowArchivo) ? 2 : 0 } }));
""")
switch(f, 'Según tipo de plano', 3)
# Planos de archivo: Pexels y luego Pixabay; si ninguno tiene algo que sirva, se genera la imagen.
http(f, 'Buscar en Pexels', 'GET', "={{ 'https://api.pexels.com/videos/search?per_page=10&size=medium&orientation=' + ($('Plan de producción').first().json.formato === 'short' ? 'portrait' : 'landscape') + '&query=' + encodeURIComponent($json.plano.busqueda_archivo || $json.plano.prompt_imagen) }}",
     cred=CRED_PEXELS, timeout=30000)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Elegir de Pexels', r"""
const prev = $('Un ítem por plano').item.json; const vertical = $('Plan de producción').first().json.formato === 'short';
const ok = f => f.link && f.width && f.height && (vertical ? f.height > f.width : f.width > f.height) && Math.max(f.width, f.height) >= 1280;
const v = ($json.videos || []).filter(x => x.duration >= 4).flatMap(x => (x.video_files || []).filter(ok).map(f => ({ ...f, autor: x.user?.name, pagina: x.url })))
  .sort((a, b) => Math.abs(Math.max(a.width, a.height) - 1920) - Math.abs(Math.max(b.width, b.height) - 1920))[0];
return [{ json: { ...prev, url: v?.link || '', fuente: v ? { banco: 'Pexels', autor: v.autor, pagina: v.pagina } : null } }];
""")
iff(f, '¿Hay en Pexels?', '!!$json.url')
http(f, 'Buscar en Pixabay', 'GET', "={{ 'https://pixabay.com/api/videos/?per_page=10&safesearch=true&q=' + encodeURIComponent(($json.plano.busqueda_archivo || $json.plano.prompt_imagen).slice(0, 100)) }}",
     cred=CRED_PIXABAY, timeout=30000)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
f.nodes[-1]['parameters']['genericAuthType'] = 'httpQueryAuth'
code(f, 'Elegir de Pixabay', r"""
const prev = $('Un ítem por plano').item.json; const vertical = $('Plan de producción').first().json.formato === 'short';
const hit = ($json.hits || []).filter(h => h.duration >= 4).map(h => ({ h, f: h.videos?.large?.url ? h.videos.large : h.videos?.medium }))
  .filter(x => x.f?.url && (vertical ? x.f.height > x.f.width : x.f.width > x.f.height))[0];
return [{ json: { ...prev, url: hit?.f.url || '', fuente: hit ? { banco: 'Pixabay', autor: hit.h.user, pagina: hit.h.pageURL } : null } }];
""")
iff(f, '¿Hay en Pixabay?', '!!$json.url')
code(f, 'Archivo aprobado', "return [{ json: { video_id: $json.video_id, plano_id: $json.plano.id, url: $json.url, plano: { ...$json.plano, tipo: 'archivo' }, fuente: $json.fuente } }];")
code(f, 'Sin archivo: generar', "const p = $('Un ítem por plano').item.json; return [{ json: { ...p, plano: { ...p.plano, tipo: 'imagen' } } }];")
# Imagen con referencias vía Responses API (herramienta de imagen). Requiere credencial "OpenAI" (Header Auth: Authorization: Bearer ...).
http(f, 'Generar imagen', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: " + A.replace("$('Ajustes')", "$('Leer ajustes')") + ".modeloTexto, tools: [{ type: 'image_generation', model: $('Leer ajustes').first().json.modeloImagen, size: $('Plan de producción').first().json.formato === 'short' ? '1024x1536' : '1536x1024' }], tool_choice: { type: 'image_generation' }, input: [{ role: 'user', content: [{ type: 'input_text', text: $json.prompt }, ...$json.referencias.map(u => ({ type: 'input_image', image_url: u }))] }] } }}",
     timeout=180000, cred=CRED_OPENAI)
code(f, 'Extraer imagen', r"""
const out = ($json.output || []).find(o => o.type === 'image_generation_call');
if (!out?.result) throw new Error('Sin imagen en la respuesta');
const prev = { ...$('Un ítem por plano').item.json, plano: { ...$('Un ítem por plano').item.json.plano, tipo: $('Un ítem por plano').item.json.plano.tipo === 'archivo' ? 'imagen' : $('Un ítem por plano').item.json.plano.tipo } };
return [{ json: { ...prev, ext: 'png' }, binary: { imagen: { data: out.result, mimeType: 'image/png', fileName: prev.plano.id + '.png' } } }];
""")
iff(f, '¿Es clip?', "$json.plano.tipo === 'clip'")
# Clip: la imagen ya generada (con las referencias de la biblia) es el primer fotograma; Gemini Omni la anima.
http(f, 'Animar (Gemini Omni)', 'POST', 'https://generativelanguage.googleapis.com/v1beta/interactions',
     body="={{ { model: $('Leer ajustes').first().json.modeloClip, store: false, input: [{ type: 'image', data: $('Generar imagen').item.json.output.find(o => o.type === 'image_generation_call').result, mime_type: 'image/png' }, { type: 'text', text: '<FIRST_FRAME> [0-8s] ' + ($json.plano.prompt_movimiento || $json.plano.movimiento || 'movimiento de cámara lento') + '. ' + $json.plano.prompt_imagen + '. Use this image as the starting frame. Sin texto ni logos. Sin diálogo.' }], generation_config: { video_config: { task: 'image_to_video' } }, response_format: { type: 'video', aspect_ratio: $('Plan de producción').first().json.formato === 'short' ? '9:16' : '16:9', resolution: '720p' } } }}",
     timeout=600000, cred=CRED_GEMINI)
code(f, 'Extraer clip', r"""
const prev = $('Extraer imagen').item.json;
const v = ($json.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).find(c => c.type === 'video');
if (!v?.data) throw new Error(v?.uri ? 'Gemini Omni devolvió el video por URI (más de 4 MB); falta soportar esa entrega' : 'Sin video en la respuesta de Gemini Omni');
return [{ json: { ...prev, ext: 'mp4' }, binary: { imagen: { data: v.data, mimeType: v.mime_type || 'video/mp4', fileName: prev.plano.id + '.mp4' } } }];
""")
gapi(f, 'Subir a Drive', 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api',
     binary_field='imagen', query={'uploadType': 'media'})
gapi(f, 'Nombrar en Drive', 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
     json_body="={{ { name: $('Extraer imagen').item.json.video_id + '-' + $('Extraer imagen').item.json.plano.id + ($('Extraer imagen').item.json.plano.tipo === 'clip' ? '.mp4' : '.png') } }}",
     query={'addParents': "={{ $('Leer ajustes').first().json.driveCarpetaRaizId }}"}, timeout=30000)
gapi(f, 'Compartir enlace', 'POST', "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Subir a Drive').item.json.id + '/permissions' }}",
     'googleDriveOAuth2Api', json_body='={{ { role: "reader", type: "anyone" } }}', timeout=30000)
code(f, 'URL del plano', r"""
const prev = $('Extraer imagen').item.json; const id = $('Subir a Drive').item.json.id;
return [{ json: { ...prev, url: 'https://drive.google.com/uc?export=download&id=' + id } }];
""")
iff(f, '¿Revisión visual activa?', "$('Leer ajustes').first().json.allowRevisionVisual === true && $json.plano.tipo !== 'clip'")
http(f, 'Revisar plano', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloTexto, text: { format: { type: 'json_object' } }, input: [{ role: 'user', content: [{ type: 'input_text', text: 'Revisa si la imagen coincide con las referencias (rostro, vestuario, paleta) y con la escena: ' + $json.plano.texto_narrado + '. Responde JSON {\"aprobado\": bool, \"problemas\": [], \"prompt_corregido\": \"\"}.' }, { type: 'input_image', image_url: $json.url }, ...$json.referencias.map(u => ({ type: 'input_image', image_url: u }))] }] } }}",
     timeout=120000, cred=CRED_OPENAI)
code(f, 'Veredicto', r"""
const prev = $('URL del plano').item.json; let v = { aprobado: true };
try { v = JSON.parse(($json.output || []).flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text || '{}'); } catch (e) { v = { aprobado: false, problemas: ['respuesta ilegible'] }; }
const max = $('Leer ajustes').first().json.maxIntentosPlano;
const repetir = v.aprobado === false && prev.intento < max;
return [{ json: { ...prev, veredicto: v, repetir, intento: prev.intento + (repetir ? 1 : 0), prompt: repetir && v.prompt_corregido ? v.prompt_corregido : prev.prompt } }];
""")
iff(f, '¿Repetir plano?', '$json.repetir === true')
code(f, 'Plano aprobado', "return [{ json: { video_id: $json.video_id, plano_id: $json.plano.id, url: $json.url, plano: $json.plano } }];")
code(f, 'Avatar pendiente', "return [{ json: { video_id: $json.video_id, plano_id: $json.plano.id, url: '', plano: $json.plano, nota: 'avatar: definir ruta HeyGen' } }];")
f.add('Juntar planos', 'n8n-nodes-base.aggregate', 1, {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'planos', 'options': {}})
code(f, 'Encargo de sonido', r"""
const e = $('Plan de producción').first().json;
return [{ json: { video_id: e.video_id, biblia: e.biblia || {}, musica: e.storyboard?.musica || {}, planos: $json.planos } }];
""")
call(f, 'Sonido y emoción', W['sonido'])
code(f, 'Composición Creatomate', r"""
// Cada escena dura lo que su voz (+ un respiro); la música va debajo de todo y termina con el video.
const e = $('Plan de producción').first().json;
const planos = $('Juntar planos').first().json.planos;
const son = $json; const voces = Object.fromEntries((son.voces || []).map(v => [v.plano_id, v]));
const orden = e.planos.map(p => p.id);
const listos = planos.filter(p => p.url && voces[p.plano_id]?.url).sort((a, b) => orden.indexOf(a.plano_id) - orden.indexOf(b.plano_id));
const vertical = e.formato === 'short';
const RESPIRO = 0.35;
let total = 0;
const escenas = listos.map((p, i) => {
  const dur = Math.round((voces[p.plano_id].duracion_s + RESPIRO) * 100) / 100; total += dur;
  const video = p.plano.tipo === 'clip' || p.plano.tipo === 'archivo';
  const mov = p.plano.movimiento || '';
  const anim = video ? undefined : mov.includes('zoom') ? [{ type: 'scale', scope: 'element', start_scale: '100%', end_scale: '112%', easing: 'linear' }]
    : mov.includes('paneo') ? [{ type: 'pan', scope: 'element', start_x: '45%', end_x: '55%', easing: 'linear' }] : undefined;
  return { type: 'composition', track: 1, name: p.plano_id, duration: dur,
    transition: i && p.plano.transicion === 'fundido' ? { type: 'fade', duration: 0.5 } : undefined,
    elements: [
      { type: video ? 'video' : 'image', source: p.url, fit: 'cover', ...(video ? { volume: '0%', loop: true } : {}), animations: anim },
      { type: 'audio', source: voces[p.plano_id].url },
    ] };
});
const elementos = [...escenas];
if (son.musica?.url) elementos.push({ type: 'audio', track: 2, time: 0, duration: Math.round(total * 100) / 100, source: son.musica.url,
  volume: '16%', audio_fade_in: 1, audio_fade_out: 2.5 });
return [{ json: { source: { output_format: 'mp4', width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080, frame_rate: 30, elements: elementos },
  video_id: e.video_id, canal_id: e.canal_id, planos: listos.length, esperados: orden.length, duracion_estimada_s: Math.round(total),
  creditos: [son.musica?.credito, ...planos.filter(p => p.fuente).map(p => `${p.fuente.banco}: ${p.fuente.autor} (${p.fuente.pagina})`)].filter(Boolean) } }];
""")
http(f, 'Renderizar', 'POST', 'https://api.creatomate.com/v2/renders', body='={{ { source: $json.source } }}', timeout=60000, cred=CRED_CREATOMATE)
wait(f, 'Esperar render', 45)
http(f, 'Consultar render', 'GET', "={{ 'https://api.creatomate.com/v2/renders/' + ($('Renderizar').first().json.id || $('Renderizar').first().json[0]?.id) }}", timeout=30000, cred=CRED_CREATOMATE)
iff(f, '¿Render listo?', "$json.status === 'succeeded'")
code(f, 'Encargo de calidad', r"""
const c = $('Composición Creatomate').first().json;
return [{ json: { video_id: c.video_id, canal_id: c.canal_id, render_url: $json.url, duracion_s: $json.duration, planos: c.planos, esperados: c.esperados, creditos: c.creditos,
  formato: $('Plan de producción').first().json.formato } }];
""")
call(f, 'Calidad y publicación', W['pub'], wait=False)
f.chain('Inicio', 'Leer ajustes', 'Plan de producción', '¿Todo encendido?')
f.link('¿Todo encendido?', '¿Dentro del presupuesto?', 0)
f.link('¿Todo encendido?', 'Aviso: falta encender', 1)
f.link('¿Dentro del presupuesto?', 'Un ítem por plano', 0)
f.link('¿Dentro del presupuesto?', 'Aviso: sobre presupuesto', 1)
f.link('Un ítem por plano', 'Según tipo de plano')
f.link('Según tipo de plano', 'Generar imagen', 0)
f.link('Según tipo de plano', 'Avatar pendiente', 1)
f.link('Según tipo de plano', 'Buscar en Pexels', 2)
f.chain('Buscar en Pexels', 'Elegir de Pexels', '¿Hay en Pexels?')
f.link('¿Hay en Pexels?', 'Archivo aprobado', 0)
f.link('¿Hay en Pexels?', 'Buscar en Pixabay', 1)
f.chain('Buscar en Pixabay', 'Elegir de Pixabay', '¿Hay en Pixabay?')
f.link('¿Hay en Pixabay?', 'Archivo aprobado', 0)
f.link('¿Hay en Pixabay?', 'Sin archivo: generar', 1)
f.link('Sin archivo: generar', 'Generar imagen')
f.link('Archivo aprobado', 'Juntar planos')
f.chain('Generar imagen', 'Extraer imagen', '¿Es clip?')
f.link('¿Es clip?', 'Animar (Gemini Omni)', 0)
f.chain('Animar (Gemini Omni)', 'Extraer clip', 'Subir a Drive')
f.link('¿Es clip?', 'Subir a Drive', 1)
f.chain('Subir a Drive', 'Nombrar en Drive', 'Compartir enlace', 'URL del plano', '¿Revisión visual activa?')
f.link('¿Revisión visual activa?', 'Revisar plano', 0)
f.link('¿Revisión visual activa?', 'Plano aprobado', 1)
f.chain('Revisar plano', 'Veredicto', '¿Repetir plano?')
f.link('¿Repetir plano?', 'Generar imagen', 0)
f.link('¿Repetir plano?', 'Plano aprobado', 1)
f.link('Plano aprobado', 'Juntar planos')
f.link('Avatar pendiente', 'Juntar planos')
f.chain('Juntar planos', 'Encargo de sonido', 'Sonido y emoción', 'Composición Creatomate', 'Renderizar', 'Esperar render', 'Consultar render', '¿Render listo?')
f.link('¿Render listo?', 'Encargo de calidad', 0)
f.link('¿Render listo?', 'Esperar render', 1)
f.link('Encargo de calidad', 'Calidad y publicación')
PROD = f.dump()

# ======================================================================================
# M5 · Sonido y emoción: voz con emoción (Gemini TTS) y música por intensidad (Epidemic Sound)
# ======================================================================================
f = Flow(W['sonido'], 'M5 · Sonido y emoción')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Textos de voz', r"""
// Un ítem por plano. Gemini TTS lee el texto al pie de la letra: la actuación va aparte, en «style»
// (emoción y ritmo de todo el plano) y en etiquetas <short pause>/<long pause>; el énfasis, en MAYÚSCULAS.
const e = $('Inicio').first().json; const aj = $('Leer ajustes').first().json;
const b = e.biblia || {}; const voz = b.voz || {};
const base = [voz.descripcion, voz.tono, voz.ritmo].filter(Boolean).join(', ') || 'narrador de documental, voz grave y cercana, ritmo ágil';
const ESTILO = { 'susurro': 'en voz baja, casi un susurro', 'suspenso': 'con suspenso contenido', 'urgencia': 'con urgencia' };
const planos = (e.planos || []).filter(p => p.plano?.texto_narrado);
return planos.map(p => {
  const t = String(p.plano.texto_narrado);
  const extra = [...t.matchAll(/\[([^\]]{1,30})\]/g)].map(m => ESTILO[m[1].toLowerCase()]).filter(Boolean);
  const texto = t
    .replace(/\[(?:énfasis|enfasis)\]\s*([^\s.,;:!?…]+)/gi, (_, w) => w.toLocaleUpperCase('es'))
    .replace(/\[pausa larga\]/gi, ' <long pause> ').replace(/\[pausa\]/gi, ' <short pause> ')
    .replace(/\[[^\]]{1,30}\]/g, '').replace(/\s{2,}/g, ' ').trim();
  const estilo = [base, p.plano.emocion ? 'con ' + p.plano.emocion : '', ...extra, `en ${b.idioma || 'español latino neutro'}`].filter(Boolean).join(', ');
  return { json: { video_id: e.video_id, plano_id: p.plano_id, texto, estilo: estilo.slice(0, 300), voz: voz.gemini_voice || aj.vozGemini } };
});
""")
http(f, 'Voz (Gemini TTS)', 'POST', 'https://generativelanguage.googleapis.com/v1beta/interactions',
     body="={{ { model: $('Leer ajustes').first().json.modeloVoz, store: false, input: [{ type: 'user_input', content: [{ type: 'text', text: $json.texto, annotations: [{ type: 'speech_metadata', style: $json.estilo }] }] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: $json.voz }] } } }}",
     cred=CRED_GEMINI, timeout=180000)
f.nodes[-1].update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
code(f, 'WAV', r"""
// Gemini TTS entrega WAV (o PCM crudo 16 bits mono): se lee el formato, se recortan los silencios
// del principio y del final (dejan respiros artificiales) y se mide la duración exacta.
const prev = $('Textos de voz').item.json;
const audio = ($json.steps || []).filter(x => x.type === 'model_output').flatMap(x => x.content || []).filter(c => c.type === 'audio' && c.data).pop();
if (!audio) throw new Error('Gemini TTS no devolvió audio para ' + prev.plano_id);
const raw = Buffer.from(audio.data, 'base64');
let rate = Number((audio.mime_type || '').match(/rate=(\d+)/)?.[1] || 24000), canales = 1, bits = 16, pcm = raw;
if (raw.toString('ascii', 0, 4) === 'RIFF') {
  let o = 12;
  while (o + 8 <= raw.length) {
    const id = raw.toString('ascii', o, o + 4), sz = raw.readUInt32LE(o + 4);
    if (id === 'fmt ') { canales = raw.readUInt16LE(o + 10); rate = raw.readUInt32LE(o + 12); bits = raw.readUInt16LE(o + 22); }
    if (id === 'data') { pcm = raw.subarray(o + 8, Math.min(raw.length, o + 8 + sz)); break; }
    o += 8 + sz + (sz % 2);
  }
}
if (bits !== 16) throw new Error('Formato de audio no soportado: ' + bits + ' bits');
const paso = 2 * canales, n = Math.floor(pcm.length / paso), UMBRAL = 600, MARGEN = Math.round(rate * 0.12);
let ini = 0, fin = n - 1;
while (ini < n && Math.abs(pcm.readInt16LE(ini * paso)) < UMBRAL) ini++;
while (fin > ini && Math.abs(pcm.readInt16LE(fin * paso)) < UMBRAL) fin--;
if (ini >= fin) throw new Error('El audio de ' + prev.plano_id + ' está en silencio');
const recorte = pcm.subarray(Math.max(0, ini - MARGEN) * paso, Math.min(n, fin + MARGEN) * paso);
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + recorte.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(canales, 22); h.writeUInt32LE(rate, 24);
h.writeUInt32LE(rate * paso, 28); h.writeUInt16LE(paso, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(recorte.length, 40);
const segundos = recorte.length / (rate * paso);
const palabras = prev.texto.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
return [{ json: { ...prev, duracion_s: Math.round(segundos * 100) / 100, palabras_por_minuto: Math.round(palabras / segundos * 60) },
  binary: { archivo: { data: Buffer.concat([h, recorte]).toString('base64'), mimeType: 'audio/wav', fileName: prev.plano_id + '.wav' } } }];
""")
gapi(f, 'Subir voz a Drive', 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api',
     binary_field='archivo', query={'uploadType': 'media'})
gapi(f, 'Nombrar voz', 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
     json_body="={{ { name: $('WAV').item.json.video_id + '-' + $('WAV').item.json.plano_id + '-voz.wav' } }}",
     query={'addParents': "={{ $('Leer ajustes').first().json.driveCarpetaRaizId }}"}, timeout=30000)
gapi(f, 'Compartir voz', 'POST', "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Subir voz a Drive').item.json.id + '/permissions' }}",
     'googleDriveOAuth2Api', json_body='={{ { role: "reader", type: "anyone" } }}', timeout=30000)
code(f, 'Voz lista', "const w = $('WAV').item.json; return [{ json: { plano_id: w.plano_id, duracion_s: w.duracion_s, url: 'https://drive.google.com/uc?export=download&id=' + $('Subir voz a Drive').item.json.id } }];")
f.add('Juntar voces', 'n8n-nodes-base.aggregate', 1, {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'voces', 'options': {}})
iff(f, '¿Música activa?', "$('Leer ajustes').first().json.allowMusica === true")
code(f, 'Búsqueda de música', r"""
// Términos a partir de la biblia (estilo musical del canal) y del storyboard (estilo e intensidad).
const e = $('Inicio').first().json; const b = e.biblia || {};
const termino = [e.musica?.estilo, b.musica?.estilo, b.musica?.mood].filter(Boolean).join(' ') || 'cinematic documentary suspense';
const total = $json.voces.reduce((a, v) => a + v.duracion_s, 0);
return [{ json: { termino: termino.slice(0, 120), total_s: Math.round(total) } }];
""")
EP = 'https://www.epidemicsound.com/a/mcp-service/mcp'
H_MCP = {'Accept': 'application/json, text/event-stream'}
def mcp(nombre, cuerpo, sesion=True):
    hd = dict(H_MCP)
    if sesion:
        hd['mcp-session-id'] = "={{ $('Iniciar Epidemic').first().json.headers['mcp-session-id'] }}"
    n = http(f, nombre, 'POST', EP, body=cuerpo, cred=CRED_EPIDEMIC, headers=hd, timeout=90000)
    f.nodes[-1]['parameters']['options']['response'] = {'response': {'fullResponse': True, 'responseFormat': 'text'}}
    return n
mcp('Iniciar Epidemic', '={"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"fabrica-n8n","version":"1"}}}', sesion=False)
mcp('Epidemic listo', '={"jsonrpc":"2.0","method":"notifications/initialized","params":{}}')
mcp('Buscar música', "={{ JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'SearchRecordings', arguments: { query: { term: $('Búsqueda de música').first().json.termino }, first: 15 } } }) }}")
code(f, 'Elegir pista', r"""
// Respuesta MCP por SSE con GraphQL dentro: primera pista instrumental y lo bastante larga.
const sse = t => { const d = String(t || '').split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()); return d.length ? d[d.length - 1] : String(t || ''); };
const m = JSON.parse(sse($json.data)); const txt = (m.result?.content || []).find(c => c.type === 'text')?.text || '{}';
const d = JSON.parse(txt); if (d.errors?.length) throw new Error('Epidemic: ' + d.errors[0].message);
const nodos = (Object.values(d.data || {})[0]?.nodes || []).map(n => n.recording).filter(Boolean);
const total = $('Búsqueda de música').first().json.total_s;
const sinVoz = r => !JSON.stringify(r).toLowerCase().includes('"vocals"');
const dur = r => Number(r.durationInSeconds || r.duration || r.lengthInSeconds || 0);
const pista = nodos.find(r => sinVoz(r) && (!dur(r) || dur(r) >= Math.min(total, 120))) || nodos[0];
if (!pista) throw new Error('Epidemic no devolvió pistas para: ' + $('Búsqueda de música').first().json.termino);
return [{ json: { id: pista.id, titulo: pista.title || pista.name || '', artista: (pista.mainArtists || pista.artists || []).map(a => a.name).join(', ') } }];
""")
mcp('Pedir descarga', "={{ JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'DownloadRecording', arguments: { id: $json.id, options: { fileType: 'MP3', stemType: 'FULL' } } } }) }}")
code(f, 'Música lista', r"""
const sse = t => { const d = String(t || '').split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()); return d.length ? d[d.length - 1] : String(t || ''); };
const m = JSON.parse(sse($json.data)); const d = JSON.parse((m.result?.content || []).find(c => c.type === 'text')?.text || '{}');
const url = Object.values(d.data || {})[0]?.assetUrl;
if (!url) throw new Error('Epidemic no dio URL de descarga');
const p = $('Elegir pista').first().json;
// La URL firmada caduca: se usa en el render de inmediato. El crédito va a la descripción del video.
return [{ json: { voces: $('Juntar voces').first().json.voces, musica: { url, titulo: p.titulo, credito: `Música: «${p.titulo}» de ${p.artista || 'Epidemic Sound'}, cortesía de Epidemic Sound (www.epidemicsound.com)` } } }];
""")
code(f, 'Sin música', "return [{ json: { voces: $json.voces, musica: null } }];")
f.chain('Inicio', 'Leer ajustes', 'Textos de voz', 'Voz (Gemini TTS)', 'WAV', 'Subir voz a Drive', 'Nombrar voz', 'Compartir voz', 'Voz lista', 'Juntar voces', '¿Música activa?')
f.link('¿Música activa?', 'Búsqueda de música', 0)
f.link('¿Música activa?', 'Sin música', 1)
f.chain('Búsqueda de música', 'Iniciar Epidemic', 'Epidemic listo', 'Buscar música', 'Elegir pista', 'Pedir descarga', 'Música lista')
SONIDO = f.dump()

# ======================================================================================
# M7 · Calidad y publicación
# ======================================================================================
f = Flow(W['pub'], 'M7 · Calidad y publicación')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Chequeos objetivos', r"""
const e = $('Inicio').first().json;
const fallas = [];
if (!e.render_url) fallas.push('sin archivo de render');
if (e.planos < e.esperados) fallas.push(`faltan planos: ${e.esperados - e.planos}`);
const d = Number(e.duracion_s) || 0;
if (e.formato === 'short' ? (d < 15 || d > 60) : (d < 180)) fallas.push(`duración fuera de rango: ${d}s`);
return [{ json: { ...e, fallas, aprobado_qc: fallas.length === 0 } }];
""")
iff(f, '¿Pasa calidad?', '$json.aprobado_qc === true')
code(f, 'Mensaje final', r"""
const e = $json; return [{ json: { etapa: 'final', video_id: e.video_id, canal_id: e.canal_id, contexto: { render_url: e.render_url, creditos: e.creditos || [] },
  mensaje: `Video ${e.video_id} listo (${Math.round(e.duracion_s)} s).\nRevísalo: ${e.render_url}\n\n¿Lo apruebo para subirlo en privado?` } }];
""")
call(f, 'Aprobación final', W['aprob'], wait=False)
tg(f, 'Aviso: no pasó calidad', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'El video ' + $json.video_id + ' no pasó calidad: ' + $json.fallas.join('; ') }}")
f.chain('Inicio', 'Leer ajustes', 'Chequeos objetivos', '¿Pasa calidad?')
f.link('¿Pasa calidad?', 'Mensaje final', 0)
f.link('Mensaje final', 'Aprobación final')
f.link('¿Pasa calidad?', 'Aviso: no pasó calidad', 1)
PUB = f.dump()

# ======================================================================================
# M7 · Aprendizaje: lee retención de los videos publicados y propone lecciones
# ======================================================================================
f = Flow(W['aprende'], 'M7 · Aprendizaje semanal')
f.add('Cada lunes', 'n8n-nodes-base.scheduleTrigger', 1.2,
      {'rule': {'interval': [{'field': 'weeks', 'triggerAtDay': [1], 'triggerAtHour': 8}]}})
call(f, 'Leer ajustes', W['ajustes'])
iff(f, '¿Analytics activo?', '$json.allowAnalytics === true')
f.add('Videos publicados', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'publicado'}]}, 'returnAll': True})
f.add('Retención', 'n8n-nodes-base.httpRequest', 4.2,
      {'method': 'GET', 'url': 'https://youtubeanalytics.googleapis.com/v2/reports',
       'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'youTubeOAuth2Api',
       'sendQuery': True, 'queryParameters': {'parameters': [
           {'name': 'ids', 'value': 'channel==MINE'}, {'name': 'dimensions', 'value': 'elapsedVideoTimeRatio'},
           {'name': 'metrics', 'value': 'audienceWatchRatio,relativeRetentionPerformance'},
           {'name': 'filters', 'value': "={{ 'video==' + $json.youtube_id }}"},
           {'name': 'startDate', 'value': '2026-01-01'}, {'name': 'endDate', 'value': "={{ $now.toFormat('yyyy-MM-dd') }}"}]},
       'options': {}})
code(f, 'Pedir lecciones', r"""
const vids = $('Videos publicados').all().map((v, i) => ({ video_id: v.json.video_id, canal_id: v.json.canal_id, retencion: $('Retención').all()[i]?.json?.rows || [] }));
const porCanal = {}; for (const v of vids) (porCanal[v.canal_id] ||= []).push(v);
return Object.entries(porCanal).map(([canal_id, videos]) => ({ json: { modo: 'aprender', canal_id, video_id: '', datos: { canal_id, videos } } }));
""")
call(f, 'Claude: aprender', W['claude'], each=True)
f.chain('Cada lunes', 'Leer ajustes', '¿Analytics activo?')
f.link('¿Analytics activo?', 'Videos publicados', 0)
f.chain('Videos publicados', 'Retención', 'Pedir lecciones', 'Claude: aprender')
APRENDE = f.dump()

# ======================================================================================
# F · Estado: lo que consulta el agente de Telegram
# ======================================================================================
f = Flow(W['estado'], 'F · Estado de la fábrica')
trigger(f)
f.add('Últimos videos', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {}, 'returnAll': False, 'limit': 10, 'orderBy': True, 'orderByColumn': 'createdAt', 'orderByDirection': 'DESC'},
      alwaysOutputData=True)
code(f, 'Resumen', r"""
const filas = $input.all().map(i => i.json).filter(v => v.video_id);
return [{ json: { resumen: filas.length ? filas.map(v => `${v.video_id} · ${v.canal_id} · ${v.etapa} · ${v.estado} · US$${v.costo_usd}`).join('\n') : 'Sin videos todavía.' } }];
""")
f.chain('Inicio', 'Últimos videos', 'Resumen')
ESTADO = f.dump()

# ======================================================================================
# F · Agente de Telegram (inactivo): conversación natural con herramientas cerradas
# ======================================================================================
f = Flow(W['agente'], 'F · Agente de Telegram (inactivo)')
f.add('Telegram', 'n8n-nodes-base.telegramTrigger', 1.2, {'updates': ['message'], 'additionalFields': {}},
      credentials=CRED_TG, webhookId=nid())
iff(f, '¿Eres tú?', "String($json.message?.from?.id) === '8667738444' && $json.message?.chat?.type === 'private'")
f.add('Agente', '@n8n/n8n-nodes-langchain.agent', 2.2,
      {'promptType': 'define', 'text': '={{ $json.message.text }}',
       'options': {'systemMessage': 'Eres el operador de una fábrica de videos. Respondes en español, breve. Solo actúas con tus herramientas: crear_canal, crear_video, estado. Nunca prometes publicar sin aprobación. Si falta un dato (canal o tema), pregunta una sola cosa.'}})
f.add('Modelo', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 1.2,
      {'model': {'__rl': True, 'mode': 'id', 'value': 'gpt-6-astra'}, 'options': {}})
f.add('Memoria', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3,
      {'sessionIdType': 'customKey', 'sessionKey': "={{ String($('Telegram').first().json.message.chat.id) }}", 'contextWindowLength': 20})


def tool(name, desc, values):
    return f.add(name, '@n8n/n8n-nodes-langchain.toolWorkflow', 2.2,
                 {'description': desc, 'workflowId': {'__rl': True, 'mode': 'id', 'value': W['orq']},
                  'workflowInputs': {'mappingMode': 'defineBelow', 'value': values, 'matchingColumns': [], 'schema': [],
                                     'attemptToConvertTypes': False, 'convertFieldsToString': False}})


tool('crear_canal', 'Investiga nichos y propone un canal nuevo. Usa cuando pidan crear o buscar un canal.',
     {'evento': 'nuevo_canal', 'criterios': "={{ $fromAI('criterios', 'preferencias del operador, puede ir vacío', 'string') }}"})
tool('crear_video', 'Crea un video en un canal activo.',
     {'evento': 'nuevo_video', 'canal_id': "={{ $fromAI('canal_id', 'id del canal', 'string') }}",
      'tema': "={{ $fromAI('tema', 'tema del video', 'string') }}",
      'formato': "={{ $fromAI('formato', 'largo o short', 'string') }}"})
f.add('estado', '@n8n/n8n-nodes-langchain.toolWorkflow', 2.2,
      {'description': 'Muestra los últimos videos con su etapa y costo.', 'workflowId': {'__rl': True, 'mode': 'id', 'value': W['estado']},
       'workflowInputs': {'mappingMode': 'defineBelow', 'value': {}, 'matchingColumns': [], 'schema': [],
                          'attemptToConvertTypes': False, 'convertFieldsToString': False}})
tg(f, 'Responder', "={{ String($('Telegram').first().json.message.chat.id) }}", '={{ $json.output }}')
f.link('Telegram', '¿Eres tú?')
f.link('¿Eres tú?', 'Agente', 0)
f.link('Agente', 'Responder')
f.ai('Modelo', 'Agente', 'ai_languageModel')
f.ai('Memoria', 'Agente', 'ai_memory')
for t in ('crear_canal', 'crear_video', 'estado'):
    f.ai(t, 'Agente', 'ai_tool')
AGENTE = f.dump()

ALL = [AJUSTES, CLAUDE, RETORNO, APROB, ORQ, PROD, SONIDO, PUB, APRENDE, ESTADO, AGENTE]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for wf in ALL:
        fn = os.path.join(OUT, wf['id'] + '.json')
        with open(fn, 'w') as fh:
            json.dump(wf, fh, ensure_ascii=False, indent=2)
    print('\n'.join(f"{w['id']}  {w['name']}  ({len(w['nodes'])} nodos)" for w in ALL))
