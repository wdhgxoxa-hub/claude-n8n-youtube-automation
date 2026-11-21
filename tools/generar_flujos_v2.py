#!/usr/bin/env python3
"""Genera los flujos v2 de la fábrica para n8n 2.47.

Uso: python3 tools/generar_flujos_v2.py  -> escribe workflows/v2/*.json
Todo el gasto queda apagado en F · Ajustes hasta que se active a propósito.
"""
import json, os, uuid

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rol(nombre):
    """Texto de un rol del banco skill/roles/, para incrustarlo en las instrucciones de un modelo dentro de n8n."""
    with open(os.path.join(RAIZ, 'skill', 'roles', nombre + '.md'), encoding='utf-8') as fh:
        return ' '.join(l.strip() for l in fh if l.strip() and not l.startswith('#'))
ROL_CRITICO, ROL_REVISOR, ROL_VERIFICADOR = rol('critico'), rol('revisor-visual'), rol('verificador')
# Skills de YouTube (skill/youtube): n8n usa los MISMOS datos que las herramientas en Python de Claude.
SKILLS = os.path.join(RAIZ, 'skill', 'youtube')
GANCHOS_DATOS = json.load(open(os.path.join(SKILLS, 'yt-guion', 'ganchos.json'), encoding='utf-8'))
TITULO_DATOS = json.load(open(os.path.join(SKILLS, 'yt-empaque', 'titulo.json'), encoding='utf-8'))
# Puerto exacto de skill/youtube/yt-guion/ganchos.py (una prueba compara ambos sobre los mismos ganchos).
GANCHOS_JS = 'const GANCHOS = ' + json.dumps({k: GANCHOS_DATOS[k] for k in ('formulas', 'listas', 'rango_palabras')}, ensure_ascii=False) + ';\n' + r"""
const normalG = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿¡]/g, '').trim();
const palabrasG = t => normalG(t).match(/[a-z0-9%/.,]+/g) || [];
const escG = x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const cuentaG = (lista, t) => { const n = normalG(t); return lista.reduce((a, x) => a + (n.match(new RegExp('\\b' + escG(x) + '\\b', 'g')) || []).length, 0); };
const CONCRETO_G = /(\d[\d.,]*\s?(%|mil|millones|soles|dolares|s|m|h)?\b|s\/ ?\d|\$ ?\d|\b\d+\s?(segundos?|minutos?|horas?|dias?|semanas?|meses|anos?)\b)/g;
const nConcreto = t => (normalG(t).match(CONCRETO_G) || []).length;
const acotar = x => Math.max(0, Math.min(100, x));
function puntuarGancho(t) {
  const L = GANCHOS.listas, [MIN_P, MAX_P] = GANCHOS.rango_palabras, w = palabrasG(t);
  const mayusc = String(t).split(/\s+/).filter(Boolean).slice(1).filter(x => { const c = x.slice(0, 1); return c !== c.toLowerCase() && c === c.toUpperCase(); }).length;
  const especificidad = w.length ? acotar(34 + nConcreto(t) * 22 - cuentaG(L.vagas, t) * 16 - cuentaG(L.relleno, t) * 5 + Math.min(18, 6 * mayusc)) : 0;
  const primeras = String(t).split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  const a_ti = acotar(26 + cuentaG(L.tu, t) * 20 + (cuentaG(L.tu, primeras) ? 30 : 0));
  const riesgo = acotar(22 + cuentaG(L.riesgo, t) * 26 + (nConcreto(t) ? 14 : 0));
  const curiosidad = acotar(24 + cuentaG(L.curiosidad, t) * 17 + (String(t).trim().endsWith('?') ? 18 : 0) + (cuentaG(L.cierre, t) ? -18 : 0));
  const n = w.length; const brevedad = !n ? 0 : (n >= MIN_P && n <= MAX_P) ? 100 : n < MIN_P ? Math.max(30, 100 - (MIN_P - n) * 11) : Math.max(10, 100 - (n - MAX_P) * 7);
  const propiedades = { especificidad, a_ti, riesgo, curiosidad, brevedad }; const v = Object.values(propiedades);
  const veredicto = Math.floor(0.6 * v.reduce((a, b) => a + b, 0) / v.length + 0.4 * Math.min(...v) + 0.5);
  const nt = normalG(t); let formula = 'Sin fórmula', hits = 0;
  for (const f of GANCHOS.formulas) { const k = f.patrones.filter(p => new RegExp(p).test(nt)).length; if (k > hits) { hits = k; formula = f.nombre; } }
  const mas_debil = Object.keys(propiedades).reduce((a, b) => propiedades[b] < propiedades[a] ? b : a);
  return { gancho: String(t).trim(), propiedades, veredicto, banda: veredicto >= 72 ? 'FUERTE' : veredicto >= 55 ? 'SIRVE' : 'DÉBIL', formula, mas_debil };
}
"""
# Puerto exacto de skill/youtube/yt-empaque/titulo.py.
TITULO_JS = 'const TITULO = ' + json.dumps(TITULO_DATOS, ensure_ascii=False) + ';\n' + r"""
const normalT = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabrasT = t => normalT(t).match(/[a-z0-9ñ']+/g) || [];
function revisarTitulo(titulo, miniatura) {
  const t = String(titulo || '').trim(), n = [...t].length, fallas = [], bien = [];
  if (n > TITULO.maximo) fallas.push(['largo', `${n} caracteres: el límite de YouTube es ${TITULO.maximo}`]);
  else if (n > TITULO.escritorio) fallas.push(['largo', `${n} caracteres: la búsqueda de escritorio corta cerca de ${TITULO.escritorio}`]);
  else bien.push(`${n} caracteres, dentro del corte de escritorio (${TITULO.escritorio})`);
  if (n > TITULO.movil) { const cab = [...t].slice(0, TITULO.movil).join(''); const cabeza = cab.includes(' ') ? cab.slice(0, cab.lastIndexOf(' ')) : cab; fallas.push(['movil', `en el celular se ve «${cabeza}…»: revisa que el tema sobreviva`]); }
  const mayus = t.split(/\s+/).filter(w => [...w].length > 2 && w === w.toUpperCase() && w !== w.toLowerCase() && !/\d/.test(w));
  if (mayus.length > 2) fallas.push(['gritos', `${mayus.length} palabras en mayúsculas: más de dos parece spam`]);
  const vagas = [...new Set(palabrasT(t).filter(w => TITULO.vagas.includes(w)))].sort();
  if (vagas.length) fallas.push(['vago', `${vagas.join(', ')}: cámbialo por un número, un nombre o una fecha`]);
  if (/\d/.test(t)) bien.push('lleva una cifra concreta'); else fallas.push(['sin-cifra', 'sin número, fecha ni nombre: el arreglo más fiable']);
  if (t.endsWith('?')) bien.push('pregunta abierta');
  if (!palabrasT(t).slice(0, 3).filter(w => !TITULO.vacias.includes(w)).length) fallas.push(['inicio', 'las tres primeras palabras son relleno: adelanta el tema']);
  if (miniatura) {
    const clave = x => new Set(palabrasT(x).filter(w => w.length > 1 && !TITULO.vacias.includes(w)));
    const m = clave(miniatura); const comunes = [...clave(t)].filter(w => m.has(w)).sort();
    if (comunes.length) fallas.push(['repite', `la miniatura repite el título en ${comunes.join(', ')}: debe decir lo que el título no dice`]);
    else bien.push('título y miniatura dicen cosas distintas');
    if (palabrasT(miniatura).length > TITULO.palabras_miniatura) fallas.push(['miniatura-larga', `${palabrasT(miniatura).length} palabras en la miniatura: ${TITULO.palabras_miniatura} es el techo a tamaño de feed`]);
  }
  return { titulo: t, caracteres: n, puntaje: Math.max(0, Math.min(100, 100 - 14 * fallas.length + 4 * bien.length)), fallas, bien };
}
"""
PRESENTACION_JS = open(os.path.join(RAIZ, 'tools/cooper/presentacion.js'), encoding='utf-8').read()

JS = lambda t: json.dumps(t, ensure_ascii=False)   # texto como literal JS dentro de una expresión

OUT = os.path.join(os.path.dirname(__file__), '..', 'workflows', 'v2')

# --- Identificadores reales de la instancia -------------------------------------------
CRED_TG = {'telegramApi': {'id': 'MOSawTRQa5BzV3pt', 'name': 'Telegram account'}}
CRED_ROUTINE = {'httpHeaderAuth': {'id': 'EbZbO2zRt0RXWkfA', 'name': 'Claude Routine'}}
CRED_OPENAI = {'httpHeaderAuth': {'id': 'FabCredOpenAI001', 'name': 'OpenAI'}}
CRED_GEMINI = {'httpHeaderAuth': {'id': 'FabCredGemini001', 'name': 'Gemini (Veo)'}}  # también sirve para Gemini Omni
CRED_EPIDEMIC = {'httpHeaderAuth': {'id': 'FabCredEpidemic1', 'name': 'Epidemic Sound'}}
CRED_PEXELS = {'httpHeaderAuth': {'id': 'FabCredPexels001', 'name': 'Pexels'}}
CRED_PIXABAY = {'httpQueryAuth': {'id': 'FabCredPixabay01', 'name': 'Pixabay'}}
CRED_HEYGEN = {'httpHeaderAuth': {'id': 'FabCredHeyGen001', 'name': 'HeyGen (x-api-key)'}}
CRED_ELEVEN = {'httpHeaderAuth': {'id': 'FabCredEleven001', 'name': 'ElevenLabs (xi-api-key)'}}
CRED_CREATOMATE = {'httpHeaderAuth': {'id': 'mtHyTqYtuZSQYGWN', 'name': 'Creatomate'}}
CRED_GOOGLE = {'googleDriveOAuth2Api': {'id': '5fXmeNSyBH0EFFf7', 'name': 'Google Drive account'}}
# YouTube: cada canal guarda su propio permiso en la tabla «youtube»; aquí solo va el cliente OAuth de Google
# (client_id y client_secret, para renovar tokens). La crea tools/crear_credencial_google_cliente.py.
CRED_GOOGLE_CLIENTE = {'httpCustomAuth': {'id': 'FabCredGoogleCli', 'name': 'Google cliente (OAuth)'}}
CRED_VIDIQ = {'httpHeaderAuth': {'id': 'rbcIrn1tnyNe0OE1', 'name': 'vidIQ'}}            # Authorization: Bearer <clave de vidIQ>
CRED_UPLOADPOST = {'httpHeaderAuth': {'id': 'PpoAcczNUlZgLCwe', 'name': 'Upload-Post'}}  # Authorization: Apikey <clave de Upload-Post>
CRED_OPENAI_CHAT = {'openAiApi': {'id': 'FabCredOpenAIch1', 'name': 'OpenAI (chat)'}}  # la crea tools/crear_credencial_chat.py
CRED_OPERADOR = {'httpBasicAuth': {'id': 'wnLsVw4Y1BOf86wy', 'name': 'Operador Formulario'}}  # usuario y clave del chat web
CRED_CLAVE = {'httpHeaderAuth': {'id': 'Ve0w86W7EdgFTIJi', 'name': 'Clave Fábrica'}}
T = {  # tablas de datos
    'canales': 'dA6t0L2GGon32eFp', 'videos': 'VIfMDnjzrrw1p2EA', 'planos': 'GdWqVXaxFOEiZKQ9',
    'eventos': 'FE0Mjte3k2UOEbbE', 'costos': 'vk7TvbIvNcTbmkVv', 'trabajos': 'BIHxr4bhuShuU9pS',
    'youtube': 'Uez0VV0bdzTX2FnE',  # conexión de cada canal con su canal de YouTube
    'publicaciones': 'OMPWHAVyhbtekML0',  # cada subida a redes (Upload-Post) con su request_id
    'aprobaciones': 'XrPPyzBaFxJwT5O3',   # decisiones pendientes y tomadas (Telegram y web usan el mismo formulario)
    # columnas de fab_aprobaciones: aprobacion_id, etapa, video_id, canal_id, job_id, resumen, url, estado, cambios, decidido_en, aviso
}
W = {  # flujos
    'ajustes': 'FabAjustes000001', 'claude': 'FabLlamarClaude1', 'retorno': 'FabRetornoClaud1',
    'orq': 'FabOrquestador01', 'aprob': 'FabAprobacion001', 'prod': 'FabProduccion001',
    'pub': 'FabPublicacion01', 'aprende': 'FabAprendizaje01', 'agente': 'FabAgenteTelegr1',
    'estado': 'FabEstado0000001', 'sonido': 'FabSonido0000001', 'refs': 'FabReferencias01',
    'yt': 'FabYouTube000001', 'vidiq': 'FabVidiq00000001', 'deriv': 'FabDerivados0001', 'redes': 'FabRedes00000001',
    'errores': 'FabErrores000001', 'pendientes': 'FabPendientes001', 'chat': 'FabChatWeb000001', 'confirmar': 'FabConfirmar0001', 'reenviar': 'FabReenviar00001', 'radar': 'FabRadar00000001',
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


def code1(f, name, js, **kw):
    """Code que corre una vez por ítem (devuelve un objeto {json, binary})."""
    return f.add(name, 'n8n-nodes-base.code', 2, {'mode': 'runOnceForEachItem', 'jsCode': js}, **kw)


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


def tg_texto(text):
    # Telegram interpreta Markdown por defecto: un «_» o «*» en un id (en_proceso, margen_real) rompe el envío
    # («can't parse entities») y detiene el flujo. Se envía en HTML con el texto escapado: llega tal cual.
    if text.startswith('={{ ') and text.endswith(' }}'):
        return "={{ String(" + text[4:-3] + " ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}"
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
TG_OPC = {'disable_web_page_preview': True, 'appendAttribution': False, 'parse_mode': 'HTML'}


def tg(f, name, chat, text):
    return f.add(name, 'n8n-nodes-base.telegram', 1.2,
                 {'resource': 'message', 'operation': 'sendMessage', 'chatId': chat, 'text': tg_texto(text),
                  'additionalFields': dict(TG_OPC)},
                 credentials=CRED_TG)


def decision(f, p, etapa, titulo, mensaje, opciones, ids, con_cambios, aviso=None, pedido="''"):
    """Una decisión del operador con UN formulario firmado de n8n.
    El mismo enlace se abre desde el botón de Telegram y desde la computadora (chat web: «pendientes»).
    Deja la fila en fab_aprobaciones (pendiente → decidida). Devuelve el nombre del nodo con {estado, cambios}.
    opciones: [(etiqueta del formulario, estado)], p. ej. [('Aprobar', 'aprobado'), ('Pedir cambios', 'cambios')]."""
    n = lambda x: f'{p} · {x}'
    # Telegram recibe una tarjeta corta (aviso); el detalle completo va en el formulario.
    aviso = aviso or ("(String(" + mensaje + " || '').split('\\n').map(x => x.trim()).filter(Boolean).slice(0, 3).join('\\n') + "
                      "'\\n\\nÁbrelo para ver todo y decidir.')")
    code(f, n('preparar'), f"""const ids = {ids};
return [{{ json: {{ aprobacion_id: 'ap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), etapa: {etapa},
  video_id: String(ids.video_id || ''), canal_id: String(ids.canal_id || ''), job_id: String(ids.job_id || ''),
  resumen: String({mensaje} || '').slice(0, 600), url: $execution.resumeFormUrl, estado: 'pendiente', cambios: '', decidido_en: '',
  aviso: String({aviso} || '').slice(0, 1500), pedido: String({pedido} || '') }} }}];""")
    dt_insert(f, n('registrar'), 'aprobaciones')
    f.add(n('avisar'), 'n8n-nodes-base.telegram', 1.2,
          {'resource': 'message', 'operation': 'sendMessage', 'chatId': "={{ $('Leer ajustes').first().json.chatId }}",
           'text': tg_texto("={{ $('" + n('preparar') + "').first().json.aviso }}"), 'replyMarkup': 'inlineKeyboard',
           'inlineKeyboard': {'rows': [{'row': {'buttons': [{'text': '📝 Revisar y decidir', 'additionalFields': {
               'url': "={{ $('" + n('preparar') + "').first().json.url }}"}}]}}]},
           'additionalFields': dict(TG_OPC)},
          credentials=CRED_TG, onError='continueRegularOutput')   # si Telegram falla, la decisión sigue disponible desde la computadora
    campos = [{'fieldLabel': 'Decisión', 'fieldType': 'dropdown', 'requiredField': True,
               'fieldOptions': {'values': [{'option': o} for o, _ in opciones]}}]
    if con_cambios:
        campos.append({'fieldLabel': 'Cambios', 'fieldType': 'textarea', 'placeholder': 'Qué cambiar (solo si pides cambios)'})
    f.add(n('esperar'), 'n8n-nodes-base.wait', 1.1,
          {'resume': 'form', 'formTitle': '={{ ' + titulo + ' }}', 'formDescription': '={{ String(' + mensaje + ').slice(0, 3800) }}',
           'formFields': {'values': campos}, 'options': {}}, webhookId=nid())
    mapa = json.dumps({o: e for o, e in opciones}, ensure_ascii=False)
    code(f, n('decisión'), f"""const mapa = {mapa}; const d = $json['Decisión'];
const estado = mapa[d] || '{opciones[-1][1]}';
return [{{ json: {{ aprobacion_id: $('{n('preparar')}').first().json.aprobacion_id, estado, cambios: String($json['Cambios'] || '').slice(0, 4000), decidido_en: new Date().toISOString() }} }}];""")
    dt_update(f, n('cerrar'), 'aprobaciones', 'aprobacion_id', "={{ $json.aprobacion_id }}")
    f.chain(n('preparar'), n('registrar'), n('avisar'), n('esperar'), n('decisión'), n('cerrar'))
    return n('preparar'), n('cerrar'), n('decisión')


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
    if cred_type == 'youtube':  # token del canal del video, pedido a «FX · YouTube por canal»
        p = {'method': method, 'url': url, 'options': {'timeout': timeout}, 'sendHeaders': True,
             'headerParameters': {'parameters': [{'name': 'Authorization', 'value': "={{ 'Bearer ' + $('Token del canal').first().json.access_token }}"}]}}
    else:
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
    extra = {'credentials': {cred_type: CRED_GOOGLE[cred_type]}} if cred_type in CRED_GOOGLE else {}
    if cred_type == 'youtube':
        extra = {}
    return f.add(name, 'n8n-nodes-base.httpRequest', 4.2, p, **extra)


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
  allowEfectos: true,         // efectos de sonido de Epidemic Sound (incluidos en tu suscripción)
  allowCritico: false,        // segundo modelo (GPT-6 Astra) que critica investigación y guion (pago por uso, centavos)
  allowTextoApi: false,       // respaldo automático de texto; activar explícitamente para permitir gasto API
  allowVerificacion: false,   // verificador de cifras con búsqueda web (GPT-6 Astra + web_search) antes del crítico (pago por uso)
  allowReferencias: false,    // imágenes de referencia de personajes y escenarios del canal (pago por uso)
  allowAvatar: false,         // HeyGen
  allowMontaje: false,        // Creatomate: une imagen, voz y música
  allowDrive: false,          // Google Drive para alojar y archivar
  allowYoutube: false,        // subida privada a YouTube
  allowAnalytics: false,      // YouTube Analytics y estadísticas de redes para aprender
  allowVidiq: false,          // vidIQ: palabras clave, videos que destacan y puntaje de títulos (créditos de tu plan)
  allowRadar: false,          // radar diario de tendencias por canal: vidIQ (15 créditos) + análisis con GPT (centavos)
  allowMiniaturas: false,     // miniatura con GPT Image + texto montado en Creatomate (pago por uso)
  allowCortes: false,         // 2–3 cortes verticales de cada video largo para TikTok, Reels y Shorts (créditos de Creatomate)
  allowRedes: false,          // publicar en YouTube, TikTok, Instagram y Facebook con Upload-Post (suscripción)
  privacidadYoutube: 'public', // con Upload-Post (app auditada) el video sale público; 'private' o 'unlisted' para revisar antes
  modeloTexto: 'gpt-6-astra',
  modeloImagen: 'gpt-image-2.6-sunburst',
  modeloClip: 'gemini-omni-1.2-flash', // Veo quedó obsoleto el 22-10-2026; su reemplazo es Gemini Omni
  costoAvatarSegUsd: 0.10,     // estimación configurable; no conciliación de factura
  costoVozHeygenCaracterUsd: 0.0001,
  costoVozElevenCaracterUsd: 0.0003,
  modeloVoz: 'gemini-3.8-flash-tts',
  modeloCritico: 'gpt-6-astra',
  vozGemini: 'Charon',        // voz grave de narrador; cambiable por canal en la biblia (voz.gemini_voice)
  costoImagenUsd: 0.06,       // estimado, se corrige con facturas reales
  costoClipSegUsd: 0.07,      // Gemini Omni 1.2 Flash a 720p (precio de lista de Google, nov-2026)
  costoRevisionUsd: 0.01,     // revisión visual de un plano, estimado
  costoCriticoUsd: 0.02,      // una crítica de investigación o guion, estimado
  costoRadarUsd: 0.05,        // análisis diario de tendencias de un canal (GPT), estimado
  costoVerificacionUsd: 0.25, // una verificación de cifras con búsqueda web (~10 búsquedas y ~75k tokens), estimado
  costoVozUsdPorPlano: 0.002, // Gemini TTS por plano, estimado
  avisoGastoPct: 0.8,         // al pasar esta fracción del tope, pide permiso por Telegram antes de seguir
  presupuestoLargoUsd: 5,
  maxVideosDiaPorCanal: 3,    // videos nuevos por canal en 24 h (protege gasto y evita contenido repetitivo)
  maxVideosDiaTotal: 40,      // videos nuevos de toda la fábrica en 24 h
  presupuestoShortUsd: 2.5,   // un Short con movimiento real (clips animados) cuesta más que uno de imágenes
  movimientoMinShort: 0.6,    // fracción mínima de planos de un Short con movimiento real (archivo o clip animado)
  clipsMaxShort: 4,           // clips animados máximos por Short (además del tope de la biblia)
  maxIntentosPlano: 2,
  driveCarpetaRaizId: '1Asm7vpt16gjt7uSp5FxaNO1Nfnb4fp1k', // carpeta «Fabrica de Videos» en tu Drive
  costoMiniaturaUsd: 0.06,    // una imagen de GPT Image por miniatura, estimado
  idioma: 'es',               // idioma de los canales (vidIQ, títulos)
  // Calendario de publicación (hora local del público). Base: estudios 2026 de Buffer, Metricool y Sprout;
  // se corrige con los datos propios de cada canal. Ver skill/biblioteca/distribucion.md.
  calendario: {
    zona: 'America/Lima',
    horas: { youtube: 11, youtube_shorts: 16, tiktok: 19, instagram: 20, facebook: 21 },
    diasEntreLargos: 2,       // un video largo cada 2 días como mínimo por canal (2–4 por semana)
    cortesDias: [1, 3, 5],    // los cortes salen 1, 3 y 5 días después del largo, no todos el mismo día
    maxPorRedDia: 2,          // tope por canal, red y día (TikTok limita ~15 posts/día por cuenta)
  },
  baseUrl: '%s',
  googleClientId: '405080624452-o72pmo2ti4ofdhm9seje5nfb27l11kdr.apps.googleusercontent.com', // público; el secreto vive en una credencial
}}];
""" % (ROUTINE, BASE, BASE))
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
const modos = ['investigar_nichos','adoptar_cuenta','crear_biblia','guion','corregir_guion','storyboard','revisar_plano','aprender'];
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
f = Flow(W['aprob'], 'F · Aprobación (Telegram y computadora)')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
ini = "$('Inicio').first().json"
primero, ultimo, dec = decision(f, 'Aprobación', ini + ".etapa", "'Aprobar: ' + " + ini + ".etapa + (" + ini + ".video_id ? ' · ' + " + ini + ".video_id : '')",
                               ini + ".mensaje", [('Aprobar', 'aprobado'), ('Pedir cambios', 'cambios')], ini, True,
                               aviso="(" + ini + ".aviso || String(" + ini + ".mensaje || '').split('\\n').filter(Boolean).slice(0, 3).join('\\n') + '\\n\\nÁbrelo para ver todo y decidir.')",
                               pedido="JSON.stringify(" + ini + ")")   # para rehacerla igual si su ejecución muere («reenviar»)
iff(f, '¿Aprobado?', "$('" + dec + "').first().json.estado === 'aprobado'")
code(f, 'Evento aprobado', "const i = $('Inicio').first().json; return [{ json: { ...i, evento: 'aprobado', mensaje: undefined } }];")
code(f, 'Evento cambios', "const i = $('Inicio').first().json; return [{ json: { ...i, evento: 'cambios', cambios: $('" + dec + "').first().json.cambios || 'Revísalo de nuevo y mejóralo.', mensaje: undefined } }];")
call(f, 'Seguir (aprobado)', W['orq'], wait=False)
call(f, 'Seguir (cambios)', W['orq'], wait=False)
f.chain('Inicio', 'Leer ajustes', primero)
f.link(ultimo, '¿Aprobado?')
f.link('¿Aprobado?', 'Evento aprobado', 0)
f.link('Evento aprobado', 'Seguir (aprobado)')
f.link('¿Aprobado?', 'Evento cambios', 1)
f.link('Evento cambios', 'Seguir (cambios)')
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
         'aprobado:final', 'cambios:final', 'corregir', 'ajustar_biblia', 'programar', 'referencias', 'configurar_redes', 'metas', 'adoptar_cuenta', 'otro']
code(f, 'Ruta', r"""
const e = $('Inicio').first().json;
// adoptar_cuenta devuelve una propuesta de canal como investigar_nichos: pasa por la misma aprobación.
const clave = e.evento === 'claude_ok' ? 'claude_ok:' + ({ corregir_guion: 'guion', adoptar_cuenta: 'investigar_nichos' }[e.modo] || e.modo)
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
iff(f, '¿Criticar nichos?', "$('Leer ajustes').first().json.allowCritico === true")
http(f, 'Crítico de nichos', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloCritico, text: { format: { type: 'json_object' } }, input: [{ role: 'user', content: [{ type: 'input_text', text: 'Eres un crítico escéptico de investigación de mercado para YouTube. Revisa esta propuesta de canal y marca cada afirmación sin fuente o con datos dudosos (cifras de búsquedas, mercados, competidores). Responde JSON {\"sin_fuente\": [\"…\"], \"riesgos\": [\"…\"], \"veredicto\": \"una frase\"}.\n\n' + JSON.stringify($('Inicio').first().json.resultado).slice(0, 12000) }] }] } }}",
     timeout=120000, cred=CRED_OPENAI)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Mensaje de canal', r"""
const r = $('Inicio').first().json.resultado || {}; const c = r.canal || {};
let critica = '';
if ($('Crítico de nichos').isExecuted) { try { const k = JSON.parse(($('Crítico de nichos').first().json.output || []).flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text || '{}');
  critica = `\n\nCrítico (GPT-6 Astra): ${k.veredicto || ''}` + ((k.sin_fuente || []).length ? '\nSin fuente: ' + k.sin_fuente.slice(0, 4).join('; ') : ''); } catch (e) { critica = ''; } }
const ev = (r.evidencia || []).slice(0, 5).map(x => '• ' + x.dato).join('\n');
const temas = (r.primeros_temas || []).slice(0, 5).map(t => '– ' + t).join('\n');
const dg = r.diagnostico || null; const cu = r.cuenta || null; const mt = r.metas || null;
const diag = dg ? `\n\nDiagnóstico de la cuenta (${cu?.red || ''} ${cu?.handle || ''}):\nBien: ${(dg.bien || []).slice(0, 4).join('; ')}\nCambiar: ${(dg.cambiar || []).slice(0, 5).join('; ')}\nCompetencia: ${(dg.competencia || []).slice(0, 4).map(x => x.patron || x).join('; ')}` : '';
const metas = mt ? `\nMetas propuestas: ${mt.videos_semana} ${mt.formato || 'videos'}/semana, tope US$${mt.gasto_semana_usd}/semana` : '';
const mensaje = `${cu ? 'Adopción de cuenta' : 'Propuesta de canal'}: ${c.nombre_propuesto}\nNicho: ${c.nicho}\nPúblico: ${c.publico}\nPromesa: ${c.promesa}${diag}${metas}\n\nEvidencia:\n${ev}\n\nPrimeros temas:\n${temas}${critica}`;
const aviso = (cu ? `🧭 Adopción de ${cu.red} ${cu.handle}: ${c.nombre_propuesto}\n${String((dg?.cambiar || [])[0] || c.nicho || '').slice(0, 200)}` : `🧭 Propuesta de canal: ${c.nombre_propuesto}\n${String(c.nicho || '').slice(0, 200)}`) + '\n\nÁbrelo para ver la evidencia y decidir.';
return [{ json: { etapa: 'canal', mensaje: mensaje.slice(0, 3900), aviso, contexto: r, job_id: $('Inicio').first().json.job_id } }];
""")
call(f, 'Aprobar canal', W['aprob'], wait=False)
f.link('Según evento', '¿Criticar nichos?', 1)
f.link('¿Criticar nichos?', 'Crítico de nichos', 0)
f.link('¿Criticar nichos?', 'Mensaje de canal', 1)
f.chain('Crítico de nichos', 'Mensaje de canal', 'Aprobar canal')

# 2 canal aprobado -> registrar y crear biblia
code(f, 'Nuevo canal', r"""
const c = ($json.contexto || {}).canal || {};
const canal_id = (c.nombre_propuesto || 'canal').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 40) + '-' + Date.now().toString(36).slice(-4);
return [{ json: { canal_id, nombre: c.nombre_propuesto || '', nicho: c.nicho || '', estado: 'creando_biblia', biblia_ruta: '',
  presupuesto_largo_usd: $('Leer ajustes').first().json.presupuestoLargoUsd, presupuesto_short_usd: $('Leer ajustes').first().json.presupuestoShortUsd,
  plataformas: ($json.contexto || {}).cuenta?.red || 'youtube', formato_defecto: (c.formatos || ['largo'])[0],
  // Metas del canal: las propone la adopción; un canal nuevo empieza sin producción automática.
  metas: JSON.stringify({ videos_semana: 3, formato: (c.formatos || ['short']).includes('short') ? 'short' : 'largo', gasto_semana_usd: 10, retencion_min: 0.5, auto: false, ...(($json.contexto || {}).metas || {}) }),
  cuenta: ($json.contexto || {}).cuenta ? JSON.stringify(($json.contexto || {}).cuenta) : '' } }];
""")
dt_insert(f, 'Guardar canal', 'canales')
code(f, 'Pedir biblia', "const ctx = $('Según evento').first().json.contexto; return [{ json: { modo:'crear_biblia', canal_id: $('Nuevo canal').first().json.canal_id, video_id:'', datos:{ canal: ctx.canal, evidencia: ctx.evidencia, notas: ctx.cuenta ? 'Cuenta existente adoptada: la biblia debe respetar su identidad actual (tono, estilo, público) y aplicar este diagnóstico: ' + JSON.stringify({ cuenta: ctx.cuenta, diagnostico: ctx.diagnostico }).slice(0, 6000) : '' } } }];")
call(f, 'Claude: biblia', W['claude'])
route(2, 'Nuevo canal', 'Guardar canal', 'Pedir biblia', 'Claude: biblia')

# 3 canal rechazado -> nueva investigación con el motivo
code(f, 'Reinvestigar', r"""
const e = $json; const c = (e.contexto || {}).canal || {}; const cu = (e.contexto || {}).cuenta;
if (cu) return [{ json: { modo: 'adoptar_cuenta', canal_id: '', video_id: '', datos: { ...cu, notas: 'Cambios del operador a la propuesta anterior: ' + (e.cambios || '') + ' · Propuesta anterior: ' + JSON.stringify({ canal: c, diagnostico: e.contexto.diagnostico }).slice(0, 3000) } } }];
return [{ json: { modo:'investigar_nichos', canal_id:'', video_id:'', datos:{ criterios: e.cambios || '', rechazos:[{ nombre: c.nombre_propuesto, nicho: c.nicho, motivo: e.cambios || '' }] } } }];
""")
call(f, 'Claude: nichos otra vez', W['claude'])
route(3, 'Reinvestigar', 'Claude: nichos otra vez')

# 4 biblia lista -> activar canal
code(f, 'Canal activo', "return [{ json: { estado:'activo', biblia_ruta: 'trabajo:' + $json.job_id } }];")
dt_update(f, 'Activar canal', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
tg(f, 'Aviso: canal listo', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ 'Canal listo: ' + $('Inicio').first().json.canal_id + '. Pídeme un video con: video ' + $('Inicio').first().json.canal_id + ' | tema' }}")
code(f, 'Encargo de referencias', "return [{ json: { canal_id: $('Inicio').first().json.canal_id } }];")
call(f, 'Referencias del canal', W['refs'], wait=False)
route(4, 'Canal activo', 'Activar canal', 'Aviso: canal listo', 'Encargo de referencias', 'Referencias del canal')

# 5 nuevo_video -> buscar biblia y pedir guion
dt_get(f, 'Buscar canal', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
iff(f, '¿Canal activo?', "$json.estado === 'activo' && String($json.biblia_ruta).startsWith('trabajo:')")
dt_get(f, 'Buscar biblia', 'trabajos', 'job_id', "={{ $('Buscar canal').first().json.biblia_ruta.replace('trabajo:','') }}")
code(f, 'Nuevo video', r"""
const e = $('Inicio').first().json; const canal = $('Buscar canal').first().json;
const biblia = (JSON.parse($('Buscar biblia').first().json.resultado || '{}').resultado) || {};
// Sin tema: la fábrica lo elige (vidIQ investiga el nicho y el guionista elige sin repetir los temas recientes).
const elegir = !String(e.tema || '').trim();
const recientes = $input.all().map(i => i.json).filter(v => v.video_id && v.tema).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30).map(v => v.tema);
const formato = e.formato || canal.formato_defecto || 'largo';
const video_id = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
const presupuesto = formato === 'short' ? canal.presupuesto_short_usd : canal.presupuesto_largo_usd;
return [{ json: { fila: { presentacion: JSON.stringify(e.presentacion || null), cooper_orden_id: e.cooper_orden_id || '', video_id, canal_id: canal.canal_id, tema: elegir ? '(la fábrica elige el tema)' : String(e.tema || '').slice(0, 500), formato, etapa: 'guion', estado: 'en_proceso',
  version: 1, costo_usd: 0, presupuesto_usd: presupuesto, drive_carpeta: '', youtube_id: '', intentos: 0, error: '' },
  pedido: { modo: 'guion', canal_id: canal.canal_id, video_id, datos: { presentacion: e.presentacion || null, tema: elegir ? '' : e.tema, elegir_tema: elegir, temas_recientes: recientes,
    nicho: canal.nicho || '', formato, biblia, tendencias: (() => { try { const t = JSON.parse(canal.tendencias || '{}'); return Date.now() - Date.parse(t.fecha || 0) < 3 * 86400000 ? t : null; } catch (x) { return null; } })(),
    duracion_objetivo_s: formato === 'short' ? 50 : 540, vidiq: e.vidiq === 'use' ? 'use' : 'skip',
    indicaciones: String(e.indicaciones || '').slice(0, 2000), documental_url: String(e.documental_url || '') } } } }];
""")
f.add('Fila del video', 'n8n-nodes-base.set', 3.4, {'mode': 'raw', 'jsonOutput': '={{ $json.fila }}', 'includeOtherFields': False, 'options': {}})
dt_insert(f, 'Guardar video', 'videos')
iff(f, '¿Investigar con vidIQ?', "$('Leer ajustes').first().json.allowVidiq === true")
code(f, 'Pedido a vidIQ', r"""
// La investigación de palabras clave necesita una semilla corta (2–4 palabras); con la frase entera vidIQ devolvía volumen nulo.
const p = $('Nuevo video').first().json.pedido;
const vacias = new Set('a al como cómo con cuanto cuánto de del el en es la las lo los mas más para por que qué se su sus un una uno y o verdad realmente gana ganan cuesta hoy'.split(' '));
const semilla = String(p.datos.tema || p.datos.nicho || '').toLowerCase().normalize('NFC').replace(/[¿?¡!.,:;«»"()]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !vacias.has(w)).slice(0, 3).join(' ');
return [{ json: { accion: 'investigar', tema: p.datos.tema || semilla, semilla: semilla || p.datos.tema, formato: p.datos.formato, idioma: $('Leer ajustes').first().json.idioma } }];
""")
call(f, 'vidIQ: investigar', W['vidiq'])
code(f, 'Pedir guion', r"""
// El guion recibe lo que encontró vidIQ (palabras clave y videos que destacan) como contexto, si se usó.
const p = $('Nuevo video').first().json.pedido;
const vq = $('vidIQ: investigar').isExecuted ? $('vidIQ: investigar').first().json : null;
return [{ json: { ...p, datos: { ...p.datos, ...(vq?.ok ? { vidiq: 'datos', investigacion_vidiq: { palabras_clave: vq.palabras_clave, videos_destacados: vq.videos_destacados } } : {}) } } }];
""")
call(f, 'Claude: guion', W['claude'])
tg(f, 'Aviso: escribiendo', "={{ $('Leer ajustes').first().json.chatId }}", "={{ ($('Nuevo video').first().json.pedido.datos.elegir_tema ? '🔎 Investigando el nicho para elegir el tema y escribiendo el guion de ' : '✍️ Escribiendo el guion de ') + $('Nuevo video').first().json.fila.video_id + '.' }}")
tg(f, 'Aviso: canal no listo', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No encuentro un canal activo con id ' + $('Inicio').first().json.canal_id + '.' }}")
f.link('Según evento', 'Buscar canal', 5)
f.link('Buscar canal', '¿Canal activo?')
f.add('Videos de las últimas 24 h', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 1 * 86400000).toISOString() }}"}]}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)
code(f, 'Revisar topes', r"""
// Topes de 24 h: por canal y de toda la fábrica. Si se pasan, el video no se crea y te avisa.
const aj = $('Leer ajustes').first().json; const canal = $('Buscar canal').first().json.canal_id;
const v = $input.all().map(i => i.json).filter(x => x.video_id);
const delCanal = v.filter(x => x.canal_id === canal).length;
const motivo = delCanal >= aj.maxVideosDiaPorCanal ? `el canal ${canal} ya tiene ${delCanal} videos nuevos en 24 h (tope ${aj.maxVideosDiaPorCanal})`
  : v.length >= aj.maxVideosDiaTotal ? `la fábrica ya creó ${v.length} videos en 24 h (tope ${aj.maxVideosDiaTotal})` : '';
return [{ json: { ok: !motivo, motivo } }];
""")
iff(f, '¿Dentro de los topes?', '$json.ok === true')
tg(f, 'Aviso: tope diario', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No creé el video «' + String($('Inicio').first().json.tema || '').slice(0, 80) + '»: ' + $json.motivo + '. Cambia el tope en Ajustes si lo necesitas.' }}")
f.link('¿Canal activo?', 'Videos de las últimas 24 h', 0)
f.link('Videos de las últimas 24 h', 'Revisar topes')
f.link('Revisar topes', '¿Dentro de los topes?')
f.link('¿Dentro de los topes?', 'Buscar biblia', 0)
f.link('¿Dentro de los topes?', 'Aviso: tope diario', 1)
f.link('¿Canal activo?', 'Aviso: canal no listo', 1)
f.add('Temas recientes del canal', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'canal_id', 'condition': 'eq', 'keyValue': "={{ $('Buscar canal').first().json.canal_id }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
f.chain('Buscar biblia', 'Temas recientes del canal', 'Nuevo video', 'Fila del video', 'Guardar video', '¿Investigar con vidIQ?')
f.link('¿Investigar con vidIQ?', 'Pedido a vidIQ', 0)
f.link('¿Investigar con vidIQ?', 'Pedir guion', 1)
f.chain('Pedido a vidIQ', 'vidIQ: investigar', 'Pedir guion', 'Claude: guion', 'Aviso: escribiendo')

# 6 guion listo -> aprobación
dt_get(f, 'Video (crítico)', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
iff(f, '¿Criticar guion?', "$('Leer ajustes').first().json.allowCritico === true && Number($json.intentos || 0) < 2")
# Puntuar ganchos (alerta de yt-guion). Además deja UN solo ítem: «Temas del canal» devuelve una fila por video
# del canal y, sin esto, el verificador, el crítico y la corrección corrían una vez por fila.
code(f, 'Puntuar ganchos', GANCHOS_JS + r"""
const r = $('Inicio').first().json.resultado || {};
const ganchos = (r.ganchos || []).map(g => puntuarGancho(g));
return [{ json: { ganchos, elegido: ganchos[r.gancho_elegido || 0] || null } }];
""")
# Verificador de cifras: busca en la web (fuentes oficiales primero) cada cifra del guion y lo que el guionista no consiguió.
iff(f, '¿Verificar cifras?', "$('Leer ajustes').first().json.allowVerificacion === true")
http(f, 'Verificar cifras', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloCritico, tools: [{ type: 'web_search' }], max_tool_calls: 12, input: [{ role: 'user', content: [{ type: 'input_text', text: " + JS(ROL_VERIFICADOR) + " + ' Responde SOLO JSON {\"cifras\":[{\"dato\":\"\",\"valor_guion\":\"\",\"valor_verificado\":\"\",\"estado\":\"ok|corregir|sin_fuente|vieja\",\"fecha\":\"\",\"fuente_url\":\"\"}],\"faltantes\":[{\"dato\":\"\",\"valor\":\"\",\"fecha\":\"\",\"fuente_url\":\"\"}],\"cuenta\":[\"paso con su cifra\"],\"resumen\":\"\"}. Hoy es ' + new Date().toISOString().slice(0, 10) + '.' + String.fromCharCode(10, 10) + JSON.stringify({ titulo: $('Inicio').first().json.resultado?.titulo, guion: $('Inicio').first().json.resultado?.guion, fuentes: $('Inicio').first().json.resultado?.fuentes, notas_del_guionista: $('Inicio').first().json.resultado?.notas }).slice(0, 12000) }] }] } }}",
     timeout=300000, cred=CRED_OPENAI)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Cifras verificadas', r"""
// Lee la verificación (JSON dentro del texto). Si no hubo o falló, el guion sigue igual: nunca se bloquea por esto.
if (!$('Verificar cifras').isExecuted) return [{ json: { leido: false, verificacion: null } }];
const t = ($('Verificar cifras').first().json.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text || '';
let v = null; try { const m = t.match(/\{[\s\S]*\}/); v = m ? JSON.parse(m[0]) : null; } catch (e) { v = null; }
if (!v) return [{ json: { leido: false, verificacion: null } }];
const cifras = (Array.isArray(v.cifras) ? v.cifras : []).slice(0, 30); const faltantes = (Array.isArray(v.faltantes) ? v.faltantes : []).slice(0, 20);
const cuenta = (Array.isArray(v.cuenta) ? v.cuenta : []).map(String).slice(0, 15);
const n = e => cifras.filter(c => c.estado === e).length;
const resumen = `${n('ok')} confirmadas, ${n('corregir')} por corregir, ${n('vieja')} viejas, ${n('sin_fuente')} sin fuente; ${faltantes.filter(f => f.valor).length} datos nuevos encontrados`;
return [{ json: { leido: true, verificacion: { cifras, faltantes, cuenta, resumen: String(v.resumen || '').slice(0, 600) }, conteo: resumen,
  corregir: n('corregir') + n('vieja') > 0 || faltantes.some(f => f.valor) } }];
""")
code(f, 'Fila de costo (verificación)', "const aj = $('Leer ajustes').first().json; return [{ json: { video_id: $('Inicio').first().json.video_id, concepto: 'verificación de cifras', servicio: 'OpenAI (búsqueda web)', usd: aj.costoVerificacionUsd } }];")
dt_insert(f, 'Guardar costo (verificación)', 'costos')
http(f, 'Crítico del guion', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloCritico, text: { format: { type: 'json_object' } }, input: [{ role: 'user', content: [{ type: 'input_text', text: " + JS(ROL_CRITICO) + " + ' Responde JSON {\"gancho\":n,\"promesa\":n,\"claridad\":n,\"emocion\":n,\"exactitud\":n,\"originalidad\":n,\"problemas\":[\"…\"],\"instrucciones\":\"…\"}.\n\n' + JSON.stringify({ titulo: $('Inicio').first().json.resultado?.titulo, ganchos: $('Inicio').first().json.resultado?.ganchos, guion: $('Inicio').first().json.resultado?.guion, fuentes: $('Inicio').first().json.resultado?.fuentes, verificacion_de_cifras: $('Cifras verificadas').first().json.verificacion, puntaje_ganchos: $('Puntuar ganchos').first().json.ganchos.map(g => ({ gancho: g.gancho, veredicto: g.veredicto, banda: g.banda, formula: g.formula, mas_debil: g.mas_debil })), temas_recientes: $('Temas del canal').all().map(i => i.json).filter(v => v.video_id && v.video_id !== $('Inicio').first().json.video_id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 15).map(v => v.tema) }).slice(0, 15000) }] }] } }}",
     timeout=120000, cred=CRED_OPENAI)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Veredicto del crítico', r"""
let k = {}; try { k = JSON.parse(($json.output || []).flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text || '{}'); } catch (e) { k = {}; }
const dims = ['gancho', 'promesa', 'claridad', 'emocion', 'exactitud', 'originalidad'];
const notas = Object.fromEntries(dims.map(d => [d, Number(k[d]) || 0]));
const leido = dims.some(d => notas[d] > 0);
// Si el crítico no respondió bien, no se bloquea: el guion pasa a tu aprobación con la nota de Claude.
// Si la verificación encontró cifras por corregir o datos que faltaban, se reescribe aunque las notas sean altas.
const ver = $('Cifras verificadas').isExecuted ? $('Cifras verificadas').first().json : {};
const porCifras = ver.leido === true && ver.corregir === true;
const problemas = [...(k.problemas || []), ...(porCifras ? ['Cifras: ' + ver.conteo] : [])];
return [{ json: { notas, pasa: (!leido || dims.every(d => notas[d] >= 8)) && !porCifras, problemas, instrucciones: String(k.instrucciones || '').slice(0, 2000), leido, por_cifras: porCifras } }];
""")
iff(f, '¿Pasa el crítico?', '$json.pasa === true')
code(f, 'Contar revisión', "return [{ json: { intentos: Number($('Video (crítico)').first().json.intentos || 0) + 1, etapa: 'guion' } }];")
dt_update(f, 'Revisión en la tabla', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
dt_get(f, 'Canal (crítico)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (crítico)', 'trabajos', 'job_id', "={{ String($('Canal (crítico)').first().json.biblia_ruta).replace('trabajo:','') }}")
code(f, 'Pedir corrección (crítico)', r"""
const e = $('Inicio').first().json; const v = $('Veredicto del crítico').first().json;
const biblia = (JSON.parse($('Biblia (crítico)').first().json.resultado || '{}').resultado) || {};
const ver = $('Cifras verificadas').isExecuted ? $('Cifras verificadas').first().json : {};
const datosVer = ver.leido ? ` Datos verificados en la web (úsalos con su fuente y fecha, corrige lo marcado y arma la cuenta corrida completa): ${JSON.stringify(ver.verificacion)}` : '';
return [{ json: { modo: 'corregir_guion', canal_id: e.canal_id, video_id: e.video_id,
  datos: { guion: e.resultado, biblia, cifras_verificadas: ver.leido ? ver.verificacion : null,
    cambios: (`Crítica automática (notas ${JSON.stringify(v.notas)}): ${v.instrucciones} ${v.problemas.join('; ')}`.slice(0, 2500) + datosVer).slice(0, 8000) } } }];
""")
call(f, 'Claude: corregir (crítico)', W['claude'])
code(f, 'Fila de costo (crítico)', "const aj = $('Leer ajustes').first().json; return [{ json: { video_id: $('Inicio').first().json.video_id, concepto: 'crítico del guion', servicio: 'OpenAI', usd: aj.costoCriticoUsd } }];")
dt_insert(f, 'Guardar costo (crítico)', 'costos')
code(f, 'Mensaje de guion', GANCHOS_JS + r"""
const e = $('Inicio').first().json; const r = e.resultado || {}; const rb = r.rubrica || {};
const nota = Object.entries(rb).map(([k, v]) => k + ' ' + v).join(' · ');
let critica = '';
if ($('Veredicto del crítico').isExecuted && $('Veredicto del crítico').first().json.leido) {
  const n = $('Veredicto del crítico').first().json.notas; critica = '\nCrítico (GPT-6 Astra): ' + Object.entries(n).map(([k, v]) => k + ' ' + v).join(' · '); }
const ver = $('Cifras verificadas').isExecuted && $('Cifras verificadas').first().json.leido ? $('Cifras verificadas').first().json : null;
const cifras = ver ? '\nCifras (verificadas en la web): ' + ver.conteo + (ver.verificacion.cuenta.length ? '\nCuenta: ' + ver.verificacion.cuenta.join(' → ').slice(0, 600) : '') : '';
const pg = (r.ganchos || [])[r.gancho_elegido || 0] ? puntuarGancho(r.ganchos[r.gancho_elegido || 0]) : null;
const alerta = pg ? ` (alerta ${pg.veredicto}/100 ${pg.banda} · ${pg.formula}${pg.banda === 'DÉBIL' ? ' · flojo en ' + pg.mas_debil : ''})` : '';
const mensaje = `Guion: ${r.titulo}\nGancho: ${(r.ganchos || [])[r.gancho_elegido || 0] || ''}${alerta}\nRúbrica: ${nota}${critica}${cifras}\n\n${String(r.guion || '').slice(0, 3000)}`;
const prom = Object.values(rb).length ? Math.round(Object.values(rb).reduce((a, b) => a + Number(b || 0), 0) / Object.values(rb).length * 10) / 10 : null;
const aviso = `✍️ Guion listo · ${r.titulo || e.video_id}` + (r.tema_elegido ? `\n🔎 Tema elegido por la fábrica: ${String(r.motivo_tema || '').slice(0, 160)}` : '') + `\n\nGancho: «${String((r.ganchos || [])[r.gancho_elegido || 0] || '').slice(0, 220)}»` + (prom ? `\nPuntaje: ${prom}/10` : '') + (pg ? `\n🪝 Gancho: ${pg.veredicto}/100 ${pg.banda} · ${pg.formula}` : '') + (ver ? `\n🔎 Cifras: ${ver.conteo}` : '') + '\n\nÁbrelo para leerlo completo y decidir.';
return [{ json: { etapa: 'guion', mensaje: mensaje.slice(0, 3900), aviso, contexto: r, video_id: e.video_id, canal_id: e.canal_id } }];
""")
call(f, 'Aprobar guion', W['aprob'], wait=False)
f.link('Según evento', 'Video (crítico)', 6)
f.link('Video (crítico)', '¿Criticar guion?')
code(f, 'Tema elegido', "const r = $('Inicio').first().json.resultado || {}; const t = String(r.tema_elegido || '').trim(); return t ? [{ json: { tema: t.slice(0, 500) } }] : [];")
dt_update(f, 'Guardar tema elegido', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
f.link('Video (crítico)', 'Tema elegido')
f.link('Tema elegido', 'Guardar tema elegido')
f.add('Temas del canal', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'canal_id', 'condition': 'eq', 'keyValue': "={{ $('Inicio').first().json.canal_id }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
f.link('¿Criticar guion?', 'Temas del canal', 0)
f.link('Temas del canal', 'Puntuar ganchos')
f.link('Puntuar ganchos', '¿Verificar cifras?')
f.link('¿Verificar cifras?', 'Verificar cifras', 0)
f.link('¿Verificar cifras?', 'Cifras verificadas', 1)
f.chain('Verificar cifras', 'Cifras verificadas', 'Crítico del guion')
f.link('Verificar cifras', 'Fila de costo (verificación)')
f.link('Fila de costo (verificación)', 'Guardar costo (verificación)')
f.link('¿Criticar guion?', 'Mensaje de guion', 1)
f.chain('Crítico del guion', 'Veredicto del crítico', '¿Pasa el crítico?')
f.chain('Veredicto del crítico', 'Fila de costo (crítico)', 'Guardar costo (crítico)')
f.link('¿Pasa el crítico?', 'Mensaje de guion', 0)
f.link('¿Pasa el crítico?', 'Contar revisión', 1)
f.chain('Contar revisión', 'Revisión en la tabla', 'Canal (crítico)', 'Biblia (crítico)', 'Pedir corrección (crítico)', 'Claude: corregir (crítico)')
f.chain('Mensaje de guion', 'Aprobar guion')

# 7 guion aprobado -> storyboard (necesita la biblia del canal)
dt_get(f, 'Canal del video', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia del video', 'trabajos', 'job_id', "={{ String($('Canal del video').first().json.biblia_ruta).replace('trabajo:','') }}")
dt_get(f, 'Video', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
code(f, 'Pedir storyboard', r"""
const e = $('Inicio').first().json; const biblia = (JSON.parse($('Biblia del video').first().json.resultado || '{}').resultado) || {};
return [{ json: { modo: 'storyboard', canal_id: e.canal_id, video_id: e.video_id,
  datos: { guion: e.contexto, biblia, formato: $('Video').first().json.formato || 'largo', notas: e.notas || '', tendencias: (() => { try { const t = JSON.parse($('Canal del video').first().json.tendencias || '{}'); return Date.now() - Date.parse(t.fecha || 0) < 3 * 86400000 ? t : null; } catch (x) { return null; } })(),
    presentacion: JSON.parse($('Video').first().json.presentacion || 'null'),
    presentacion_instrucciones: 'Respeta presencia: completo en todas las escenas narradas; partes solo algunas. Marca usa_avatar boolean en cada plano. La voz elegida narra todos. No cambies IDs ni proveedores.',
    presupuesto_usd: Number($('Video').first().json.presupuesto_usd),
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
const nombres = { imagen: 'imágenes', archivo: 'clips de archivo', clip: 'clips animados', avatar: 'avatar' };
const aviso = `🎬 Storyboard listo · ${p.length} escenas\n${Object.entries(cuenta).map(([k, v]) => v + ' ' + (nombres[k] || k)).join(' · ')}\nCosto estimado: US$${r.costo_estimado_usd ?? '?'}\n\nÁbrelo para ver escena por escena y decidir. Al aprobar empieza el gasto.`;
return [{ json: { etapa: 'storyboard', mensaje: mensaje.slice(0, 3900), aviso, contexto: r, video_id: $json.video_id, canal_id: $json.canal_id } }];
""")
call(f, 'Aprobar storyboard', W['aprob'], wait=False)
route(9, 'Mensaje de storyboard', 'Aprobar storyboard')

# 10 storyboard aprobado -> producción
dt_get(f, 'Canal (producción)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (producción)', 'trabajos', 'job_id', "={{ String($('Canal (producción)').first().json.biblia_ruta).replace('trabajo:','') }}")
dt_get(f, 'Video (producción)', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
f.add('Trabajos (producción)', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('trabajos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'video_id', 'condition': 'eq', 'keyValue': "={{ $('Inicio').first().json.video_id }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Encargo de producción', r"""
const e = $('Inicio').first().json; const v = $('Video (producción)').first().json;
const biblia = (JSON.parse($('Biblia (producción)').first().json.resultado || '{}').resultado) || {};
// El guion aprobado es el último resultado listo de «guion» o «corregir_guion»: viaja con el video a su carpeta.
const guiones = $('Trabajos (producción)').all().map(i => i.json).filter(t => t.estado === 'listo' && ['guion', 'corregir_guion'].includes(t.modo));
const ultimo = guiones.sort((a, b) => String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id))).pop();
const guion = ultimo ? (JSON.parse(ultimo.resultado || '{}').resultado || {}) : {};
return [{ json: { video_id: e.video_id, canal_id: e.canal_id, tema: v.tema, version: v.version || 1, formato: v.formato, presupuesto_usd: v.presupuesto_usd,
  presentacion: JSON.parse(v.presentacion || 'null'), storyboard: e.contexto, guion, biblia, notas: '' } }];
""")
call(f, 'Producir', W['prod'], wait=False)
route(10, 'Canal (producción)', 'Biblia (producción)', 'Video (producción)', 'Trabajos (producción)', 'Encargo de producción', 'Producir')

# 11 cambios en storyboard -> rehacer storyboard desde el anterior
dt_get(f, 'Canal (rehacer)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (rehacer)', 'trabajos', 'job_id', "={{ String($('Canal (rehacer)').first().json.biblia_ruta).replace('trabajo:','') }}")
dt_get(f, 'Video (rehacer)', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
code(f, 'Pedir storyboard corregido', r"""
const e = $('Inicio').first().json; const biblia = (JSON.parse($('Biblia (rehacer)').first().json.resultado || '{}').resultado) || {};
return [{ json: { modo: 'storyboard', canal_id: e.canal_id, video_id: e.video_id,
  datos: { storyboard_anterior: e.contexto, biblia, formato: $('Video (rehacer)').first().json.formato || 'largo', notas: e.cambios || '', tendencias: (() => { try { const t = JSON.parse($('Canal (rehacer)').first().json.tendencias || '{}'); return Date.now() - Date.parse(t.fecha || 0) < 3 * 86400000 ? t : null; } catch (x) { return null; } })(),
    presentacion: JSON.parse($('Video (rehacer)').first().json.presentacion || 'null'),
    presentacion_instrucciones: 'Conserva el contrato de presentación y marca usa_avatar en cada plano; partes exige un subconjunto narrado.',
    presupuesto_usd: Number($('Video (rehacer)').first().json.presupuesto_usd),
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
gapi(f, 'Abrir subida YouTube', 'POST', 'https://www.googleapis.com/upload/youtube/v3/videos', 'youtube',
     query={'uploadType': 'resumable', 'part': 'snippet,status'}, full=True, timeout=30000,
     json_body="={{ { snippet: { title: $('Video (publicar)').first().json.tema.slice(0, 95), description: ($('Inicio').first().json.contexto.creditos || []).join('\n'), categoryId: '27', defaultLanguage: 'es' }, status: Object.assign({ privacyStatus: 'private', selfDeclaredMadeForKids: false, containsSyntheticMedia: true }, Date.parse($('Video (publicar)').first().json.publicar_en || '') > Date.now() + 3600000 ? { publishAt: new Date($('Video (publicar)').first().json.publicar_en).toISOString() } : {}) } }}")
gapi(f, 'Subir a YouTube', 'PUT', "={{ $('Abrir subida YouTube').first().json.headers.location }}", 'youtube',
     binary_field='data', timeout=600000)
code(f, 'Video publicado', "return [{ json: { estado: 'publicado', etapa: 'publicado', youtube_id: $json.id || '', publicado_en: (Date.parse($('Video (publicar)').first().json.publicar_en || '') > Date.now() ? new Date($('Video (publicar)').first().json.publicar_en) : new Date()).toISOString() } }];")
dt_update(f, 'Marcar publicado', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
tg(f, 'Aviso: subido', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Subido en privado a ' + ($('Token del canal').first().json.canal_youtube || 'YouTube') + ': https://youtu.be/' + $('Video publicado').first().json.youtube_id + (Date.parse($('Video (publicar)').first().json.publicar_en || '') > Date.now() ? '. Se publicará el ' + $('Video (publicar)').first().json.publicar_en : '') + '. Marcado como contenido sintético.' }}")
tg(f, 'Aviso: YouTube apagado', "={{ $('Leer ajustes').first().json.chatId }}", "Aprobado. Para subirlo, enciende YouTube en F · Ajustes.")
dt_get(f, 'Canal (publicar)', 'canales', 'canal_id', "={{ $('Video (publicar)').first().json.canal_id }}")
iff(f, '¿Publicar con Upload-Post?', "$('Leer ajustes').first().json.allowRedes === true && !!$json.uploadpost_perfil")
code(f, 'Encargo de redes', r"""
const e = $('Inicio').first().json; const v = $('Video (publicar)').first().json; const c = $('Canal (publicar)').first().json;
return [{ json: { video_id: v.video_id, canal_id: v.canal_id, tema: v.tema, formato: v.formato, publicar_en: v.publicar_en || '',
  perfil: c.uploadpost_perfil, redes: c.redes || 'youtube,tiktok,instagram,facebook', zona: c.zona || '', contexto: e.contexto || {} } }];
""")
call(f, 'Publicar en redes', W['redes'], wait=False)
tg(f, 'Aviso: publicando', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Publicando ' + $('Video (publicar)').first().json.video_id + ' en ' + ($('Canal (publicar)').first().json.redes || 'todas las redes') + ' con Upload-Post. Te aviso el resultado en unos minutos.' }}")
f.link('Según evento', 'Video (publicar)', 13)
f.link('Video (publicar)', 'Canal (publicar)')
f.link('Canal (publicar)', '¿Publicar con Upload-Post?')
f.link('¿Publicar con Upload-Post?', 'Encargo de redes', 0)
f.link('¿Publicar con Upload-Post?', '¿YouTube encendido?', 1)
f.chain('Encargo de redes', 'Publicar en redes', 'Aviso: publicando')
code(f, 'Pedir token del canal', "return [{ json: { accion: 'token', canal_id: $('Video (publicar)').first().json.canal_id } }];")
call(f, 'Token del canal', W['yt'])
iff(f, '¿Canal conectado?', '$json.ok === true')
tg(f, 'Aviso: canal sin YouTube', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Aprobado, pero no lo subí: ' + $json.error }}")
f.link('¿YouTube encendido?', 'Pedir token del canal', 0)
f.link('¿YouTube encendido?', 'Aviso: YouTube apagado', 1)
f.chain('Pedir token del canal', 'Token del canal', '¿Canal conectado?')
f.link('¿Canal conectado?', 'Abrir subida YouTube', 0)
f.link('¿Canal conectado?', 'Aviso: canal sin YouTube', 1)
f.chain('Abrir subida YouTube', 'Descargar render', 'Subir a YouTube', 'Video publicado', 'Marcar publicado', 'Aviso: subido')

# 14 cambios en el video final
# 14 cambios al video final -> se rehace el storyboard con la instrucción (solo se regenera lo que cambie)
code(f, 'Cambio final a corrección', "const e = $json; return [{ json: { evento: 'corregir', video_id: e.video_id, canal_id: e.canal_id, etapa: 'storyboard', instruccion: e.cambios || '' } }];")
call(f, 'Orquestar corrección final', W['orq'], wait=False)
route(14, 'Cambio final a corrección', 'Orquestar corrección final')

# 15 corregir (agente o cambios finales): busca la última versión lista del guion o storyboard y la manda a cambios
f.add('Trabajos del video', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('trabajos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'video_id', 'condition': 'eq', 'keyValue': "={{ $('Inicio').first().json.video_id }}"}]}, 'returnAll': True},
      alwaysOutputData=True)
code(f, 'Última versión', r"""
const e = $('Inicio').first().json; const etapa = /story/i.test(e.etapa || '') ? 'storyboard' : 'guion';
const modos = etapa === 'guion' ? ['guion', 'corregir_guion'] : ['storyboard'];
const t = $input.all().map(i => i.json).filter(x => x.job_id && x.estado === 'listo' && modos.includes(x.modo))
  .sort((a, b) => String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id))).pop();
if (!t) return [{ json: { hay: false, video_id: e.video_id, etapa } }];
return [{ json: { hay: true, evento: 'cambios', etapa, video_id: e.video_id, canal_id: t.canal_id || e.canal_id,
  contexto: JSON.parse(t.resultado || '{}').resultado || {}, cambios: String(e.instruccion || '').slice(0, 4000) } }];
""")
iff(f, '¿Hay versión?', '$json.hay === true')
call(f, 'Volver a orquestar', W['orq'], wait=False)
tg(f, 'Aviso: corrigiendo', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Corrigiendo el ' + $('Última versión').first().json.etapa + ' de ' + $('Inicio').first().json.video_id + '. Te llega para aprobar.' }}")
tg(f, 'Aviso: sin versión', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No encuentro un ' + $json.etapa + ' listo para ' + $json.video_id + '.' }}")
f.link('Según evento', 'Trabajos del video', 15)
f.chain('Trabajos del video', 'Última versión', '¿Hay versión?')
f.link('¿Hay versión?', 'Volver a orquestar', 0)
f.link('¿Hay versión?', 'Aviso: sin versión', 1)
f.link('Volver a orquestar', 'Aviso: corrigiendo')

# 16 ajustar_biblia: cambia un campo de la biblia para los videos siguientes
dt_get(f, 'Canal (ajuste)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia (ajuste)', 'trabajos', 'job_id', "={{ String($('Canal (ajuste)').first().json.biblia_ruta).replace('trabajo:','') }}")
code(f, 'Aplicar ajuste', r"""
const e = $('Inicio').first().json; const fila = $json;
const campo = String(e.campo || '').trim();
if (!fila.job_id || !/^[a-z_]+(\.[a-z_0-9]+){0,3}$/.test(campo) || ['canal_id', 'nombre'].includes(campo.split('.')[0]) || campo.split('.').some(k => ['__proto__', 'constructor', 'prototype'].includes(k)))
  return [{ json: { ok: false, motivo: !fila.job_id ? 'no encuentro la biblia de ' + e.canal_id : 'campo no válido: ' + campo } }];
let valor = e.valor; try { valor = JSON.parse(e.valor); } catch (err) { /* texto */ }
const env = JSON.parse(fila.resultado || '{}'); const b = env.resultado || (env.resultado = {});
const partes = campo.split('.'); let o = b;
for (const k of partes.slice(0, -1)) o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {});
const ultimo = partes[partes.length - 1];
if (Array.isArray(o[ultimo]) && !Array.isArray(valor)) o[ultimo].push(valor); else o[ultimo] = valor;
return [{ json: { ok: true, resultado: JSON.stringify(env), resumen: `${campo} = ${JSON.stringify(valor).slice(0, 200)}` } }];
""")
iff(f, '¿Ajuste válido?', '$json.ok === true')
code(f, 'Fila de biblia', "return [{ json: { resultado: $json.resultado } }];")
dt_update(f, 'Guardar ajuste', 'trabajos', 'job_id', "={{ $('Biblia (ajuste)').first().json.job_id }}")
tg(f, 'Aviso: ajuste guardado', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Biblia de ' + $('Inicio').first().json.canal_id + ': ' + $('Aplicar ajuste').first().json.resumen + '. Aplica desde el próximo video.' }}")
tg(f, 'Aviso: ajuste inválido', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No cambié la biblia: ' + $json.motivo }}")
f.link('Según evento', 'Canal (ajuste)', 16)
f.chain('Canal (ajuste)', 'Biblia (ajuste)', 'Aplicar ajuste', '¿Ajuste válido?')
f.link('¿Ajuste válido?', 'Fila de biblia', 0)
f.link('¿Ajuste válido?', 'Aviso: ajuste inválido', 1)
f.chain('Fila de biblia', 'Guardar ajuste', 'Aviso: ajuste guardado')

# 17 programar: fecha de publicación (la subida usa publishAt de YouTube)
code(f, 'Validar fecha', r"""
const e = $('Inicio').first().json; const t = Date.parse(e.fecha || '');
const ok = !isNaN(t) && t > Date.now() + 3600000 && t < Date.now() + 180 * 86400000;
return [{ json: { ok, publicar_en: ok ? new Date(t).toISOString() : '', motivo: isNaN(t) ? 'fecha ilegible: ' + e.fecha : 'la fecha debe estar entre 1 hora y 6 meses desde ahora' } }];
""")
iff(f, '¿Fecha válida?', '$json.ok === true')
code(f, 'Fila de fecha', "return [{ json: { publicar_en: $json.publicar_en } }];")
dt_update(f, 'Guardar fecha', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
tg(f, 'Aviso: programado', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Programado ' + $('Inicio').first().json.video_id + ' para ' + new Date($('Validar fecha').first().json.publicar_en).toLocaleString('es-PE', { timeZone: 'America/Lima' }) + ' (hora de Lima). Se aplica al subirlo tras tu aprobación final.' }}")
tg(f, 'Aviso: fecha inválida', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No programé: ' + $json.motivo }}")
f.link('Según evento', 'Validar fecha', 17)
f.link('Validar fecha', '¿Fecha válida?')
f.link('¿Fecha válida?', 'Fila de fecha', 0)
f.link('¿Fecha válida?', 'Aviso: fecha inválida', 1)
f.chain('Fila de fecha', 'Guardar fecha', 'Aviso: programado')

# 18 referencias del canal a pedido
code(f, 'Pedir referencias', "return [{ json: { canal_id: $json.canal_id } }];")
call(f, 'Referencias a pedido', W['refs'], wait=False)
route(18, 'Pedir referencias', 'Referencias a pedido')

# 20 metas: lo que el canal persigue cada semana (videos, gasto, retención) y si la fábrica produce sola
code(f, 'Validar metas', r"""
const e = $('Inicio').first().json; const n = (x, a, b) => { if (x === '' || x === null || x === undefined) return null; const v = Number(String(x).replace(',', '.')); return Number.isFinite(v) && v >= a && v <= b ? v : null; };
const cambios = { videos_semana: n(e.videos_semana, 0, 21), gasto_semana_usd: n(e.gasto_semana_usd, 0, 200), retencion_min: n(e.retencion_min, 0, 1),
  formato: ['short', 'largo'].includes(String(e.formato || '')) ? e.formato : null,
  auto: [true, 'true', 'sí', 'si'].includes(e.auto) ? true : [false, 'false', 'no'].includes(e.auto) ? false : null };
const limpio = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== null));
return [{ json: { ok: !!e.canal_id && Object.keys(limpio).length > 0, cambios: limpio } }];
""")
iff(f, '¿Metas válidas?', '$json.ok === true')
dt_get(f, 'Canal (metas)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
iff(f, '¿Existe el canal (metas)?', '!!$json.canal_id')
code(f, 'Fila de metas', r"""
let antes = {}; try { antes = JSON.parse($json.metas || '{}'); } catch (x) { antes = {}; }
const metas = { videos_semana: 3, formato: 'short', gasto_semana_usd: 10, retencion_min: 0.5, auto: false, ...antes, ...$('Validar metas').first().json.cambios };
return [{ json: { metas: JSON.stringify(metas), _texto: `Metas de ${$json.canal_id}: ${metas.videos_semana} ${metas.formato}/semana, tope US$${metas.gasto_semana_usd}/semana, retención mínima ${Math.round(metas.retencion_min * 100)} %, producción automática ${metas.auto ? 'encendida' : 'apagada'}.` } }];
""")
code(f, 'Solo metas', "return [{ json: { metas: $json.metas } }];")
dt_update(f, 'Guardar metas', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
tg(f, 'Aviso: metas', "={{ $('Leer ajustes').first().json.chatId }}", "={{ $('Fila de metas').first().json._texto }}")
tg(f, 'Aviso: metas inválidas', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No cambié las metas: falta el canal o un valor válido (videos por semana 0–21, gasto 0–200 US$, retención 0–1, formato short o largo, auto sí o no).' }}")
f.link('Según evento', 'Validar metas', 20)
f.link('Validar metas', '¿Metas válidas?')
f.link('¿Metas válidas?', 'Canal (metas)', 0)
f.link('¿Metas válidas?', 'Aviso: metas inválidas', 1)
f.link('Canal (metas)', '¿Existe el canal (metas)?')
f.link('¿Existe el canal (metas)?', 'Fila de metas', 0)
f.link('¿Existe el canal (metas)?', 'Aviso: metas inválidas', 1)
f.chain('Fila de metas', 'Solo metas', 'Guardar metas', 'Aviso: metas')

# 21 adoptar_cuenta: lee una cuenta existente (YouTube, TikTok o Instagram) y su competencia, y propone cómo llevarla
code(f, 'Leer enlace', r"""
// Acepta enlace o @usuario. Detecta la red y el usuario; sin red clara, asume Instagram si viene con @ y la red no se dice.
const e = $('Inicio').first().json; const u = String(e.url || e.cuenta || '').trim(); let red = String(e.red || '').toLowerCase(); let handle = '';
const m = u.match(/(?:youtube\.com\/(?:@|c\/|channel\/)?|youtu\.be\/)([\w.\-@]+)/i) || null;
if (/youtube\.com|youtu\.be/i.test(u)) { red = 'youtube'; handle = (u.match(/youtube\.com\/(@[\w.\-]+|channel\/[\w\-]+|c\/[\w.\-]+)/i) || [])[1] || ''; handle = handle.replace(/^c\//, '@').replace(/^channel\//, ''); }
else if (/tiktok\.com/i.test(u)) { red = 'tiktok'; handle = (u.match(/tiktok\.com\/@([\w.\-]+)/i) || [])[1] || ''; }
else if (/instagram\.com/i.test(u)) { red = 'instagram'; handle = (u.match(/instagram\.com\/([\w.]+)/i) || [])[1] || ''; }
else if (/^@?[\w.\-]{2,60}$/.test(u)) { handle = u.replace(/^@/, ''); red = ['youtube', 'tiktok', 'instagram'].includes(red) ? red : 'instagram'; if (red === 'youtube') handle = '@' + handle; }
const ok = !!handle && ['youtube', 'tiktok', 'instagram'].includes(red);
return [{ json: { ok, accion: 'cuenta', red, handle, url: u, notas: String(e.notas || e.indicaciones || ''), motivo: ok ? '' : 'no reconocí la cuenta: manda el enlace de YouTube, TikTok o Instagram' } }];
""")
iff(f, '¿Cuenta reconocida?', '$json.ok === true')
call(f, 'vidIQ: cuenta', W['vidiq'])
code(f, 'Pedir adopción', r"""
const c = $('Leer enlace').first().json; const v = $json || {};
return [{ json: { modo: 'adoptar_cuenta', canal_id: '', video_id: '', datos: { red: c.red, handle: c.handle, url: c.url, notas: c.notas,
  perfil: v.ok ? v.perfil : '', publicaciones: v.ok ? v.publicaciones : '', error_vidiq: v.ok ? '' : String(v.error || 'vidIQ no respondió') } } }];
""")
call(f, 'Claude: adopción', W['claude'])
tg(f, 'Aviso: adopción en marcha', "={{ $('Leer ajustes').first().json.chatId }}", "={{ '🔎 Analizando ' + $('Leer enlace').first().json.red + ' ' + $('Leer enlace').first().json.handle + ' y su competencia. Te llegará la propuesta para aprobar.' }}")
tg(f, 'Aviso: cuenta no reconocida', "={{ $('Leer ajustes').first().json.chatId }}", "={{ $('Leer enlace').first().json.motivo }}")
f.link('Según evento', 'Leer enlace', 21)
f.link('Leer enlace', '¿Cuenta reconocida?')
f.link('¿Cuenta reconocida?', 'vidIQ: cuenta', 0)
f.link('¿Cuenta reconocida?', 'Aviso: cuenta no reconocida', 1)
f.chain('vidIQ: cuenta', 'Pedir adopción', 'Claude: adopción', 'Aviso: adopción en marcha')

# 19 configurar_redes: perfil de Upload-Post y redes donde publica el canal
code(f, 'Validar redes', r"""
const e = $('Inicio').first().json;
const perfil = String(e.perfil || '').trim(); const redes = String(e.redes || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
const validas = ['youtube', 'tiktok', 'instagram', 'facebook'];
const malas = redes.filter(r => !validas.includes(r));
let zona = String(e.zona || '').trim(); let zonaMala = false;
if (zona) { try { new Intl.DateTimeFormat('en', { timeZone: zona }); } catch (err) { zonaMala = true; } }
const ok = /^[A-Za-z0-9_.-]{2,60}$/.test(perfil) && redes.length > 0 && !malas.length && !zonaMala;
return [{ json: { ok, fila: { uploadpost_perfil: perfil, redes: [...new Set(redes)].join(','), ...(zona && !zonaMala ? { zona } : {}) },
  motivo: zonaMala ? 'zona horaria desconocida: ' + zona + ' (ej.: America/Lima, America/Mexico_City, Europe/Madrid)' : !/^[A-Za-z0-9_.-]{2,60}$/.test(perfil) ? 'perfil de Upload-Post inválido: ' + perfil : malas.length ? 'redes desconocidas: ' + malas.join(', ') + ' (válidas: ' + validas.join(', ') + ')' : 'falta la lista de redes' } }];
""")
iff(f, '¿Redes válidas?', '$json.ok === true')
dt_get(f, 'Canal (redes)', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
iff(f, '¿Existe el canal?', '!!$json.canal_id')
code(f, 'Fila de redes', "return [{ json: $('Validar redes').first().json.fila }];")
dt_update(f, 'Guardar redes', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
tg(f, 'Aviso: redes guardadas', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Canal ' + $('Inicio').first().json.canal_id + ': publica con el perfil «' + $('Validar redes').first().json.fila.uploadpost_perfil + '» de Upload-Post en ' + $('Validar redes').first().json.fila.redes + ($('Validar redes').first().json.fila.zona ? ', a la hora de ' + $('Validar redes').first().json.fila.zona : '') + '.' }}")
tg(f, 'Aviso: redes inválidas', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No guardé las redes: ' + ($json.motivo || ('no existe el canal ' + $('Inicio').first().json.canal_id)) }}")
f.link('Según evento', 'Validar redes', 19)
f.link('Validar redes', '¿Redes válidas?')
f.link('¿Redes válidas?', 'Canal (redes)', 0)
f.link('¿Redes válidas?', 'Aviso: redes inválidas', 1)
f.link('Canal (redes)', '¿Existe el canal?')
f.link('¿Existe el canal?', 'Fila de redes', 0)
f.link('¿Existe el canal?', 'Aviso: redes inválidas', 1)
f.chain('Fila de redes', 'Guardar redes', 'Aviso: redes guardadas')

# 20 otro / errores
tg(f, 'Aviso: evento', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'Aviso de la fábrica (' + $json.clave + '): ' + JSON.stringify($json.avisos || $json.error || '').slice(0, 500) }}")
route(22, 'Aviso: evento')
ORQ = f.dump()

COMPONER = r"""
// componer(): arma la composición de Creatomate. La usan el video principal y los cortes verticales.
// Cada escena dura lo que su voz (+ un respiro). Encima: subtítulos (Shorts, cortes o si la biblia lo pide), título de
// capítulo en los largos y efectos del storyboard; debajo, la música hasta el final. Estilo desde biblia.montaje.
function componer({ plan, planos, son, vertical, soloIds, forzarSubtitulos }) {
  const m = plan.biblia?.montaje || {};
  const voces = Object.fromEntries((son.voces || []).map(v => [v.plano_id, v]));
  const efectos = {}; for (const x of son.efectos || []) if (x && x.url) (efectos[x.plano] ||= []).push(x);
  const orden = (plan.planos || []).map(p => p.id).filter(id => !soloIds || soloIds.includes(id));
  const listos = planos.filter(p => p.url && (voces[p.plano_id]?.url || !p.plano.texto_narrado && Number(p.plano.duracion_s) > 0) && orden.includes(p.plano_id))
    .sort((a, b) => orden.indexOf(a.plano_id) - orden.indexOf(b.plano_id));
  if (listos.length !== orden.length) throw new Error('Faltan planos o voces para montar');
  const subtitulos = forzarSubtitulos || (m.subtitulos ?? vertical);
  const fuente = m.fuente || 'Montserrat', color = m.color_texto || '#FFFFFF';
  const RESPIRO = vertical ? 0.15 : 0.35;   // en Shorts el respiro largo alargaba el video (67 s para 45 previstos)
  const limpio = t => String(t || '').replace(/\[[^\]]{1,30}\]/g, '').replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();
  // Subtítulos: frases cortas repartidas en el tiempo de la voz según su largo (sin marcas de tiempo por palabra).
  const trozos = (t, max) => { const w = limpio(t).split(' ').filter(Boolean); const r = []; for (let i = 0; i < w.length; i += max) r.push(w.slice(i, i + max).join(' ')); return r; };
  let total = 0;
  const escenas = listos.map((p, i) => {
    const voz = voces[p.plano_id] || {duracion_s:Number(p.plano.duracion_s)};
    if (!Number.isFinite(voz.duracion_s) || voz.duracion_s <= 0) throw new Error('Duración de voz inválida');
    const dur = Math.round((voz.duracion_s + (p.plano.tipo === 'avatar' ? 0 : RESPIRO)) * 100) / 100; total += dur;
    const video = ['clip', 'archivo', 'avatar'].includes(p.plano.tipo);
    const mov = p.plano.movimiento || '';
    const anim = video ? undefined : mov.includes('zoom') ? [{ type: 'scale', scope: 'element', start_scale: '100%', end_scale: '112%', easing: 'linear' }]
      : mov.includes('paneo') ? [{ type: 'pan', scope: 'element', start_x: '45%', end_x: '55%', easing: 'linear' }] : undefined;
    const els = [
      { type: video ? 'video' : 'image', source: p.url, fit: 'cover', ...(video ? { volume: '0%', loop: p.plano.tipo !== 'avatar' } : {}), animations: anim },
      ...(voz.url ? [{ type: 'audio', source: voz.url, duration: null }] : []),   // atada a su escena (Creatomate avisaba que seguía sonando debajo de la siguiente)
    ];
    if (subtitulos) {
      const partes = trozos(p.plano.texto_narrado, vertical ? 4 : 8); const letras = partes.reduce((a, x) => a + x.length, 0) || 1;
      let t = 0;
      for (const x of partes) { const d = Math.round(voz.duracion_s * x.length / letras * 100) / 100;
        els.push({ type: 'text', text: x, time: Math.round(t * 100) / 100, duration: d, y: vertical ? '72%' : '86%', width: '86%', x_alignment: '50%',
          font_family: fuente, font_weight: '700', font_size: vertical ? '7.5 vmin' : '5 vmin', fill_color: color, stroke_color: '#000000', stroke_width: '1.2 vmin' });
        t += d; }
    }
    // Cifra clave en grande (storyboard: texto_pantalla), para que el espectador siga la cuenta sin perderse.
    if (p.plano.texto_pantalla) els.push({ type: 'text', text: String(p.plano.texto_pantalla).slice(0, 40), time: 0, duration: dur, y: vertical ? '30%' : '20%', width: '88%', x_alignment: '50%',
      font_family: fuente, font_weight: '800', font_size: vertical ? '11 vmin' : '8 vmin', fill_color: m.color_cifra || '#22C55E', stroke_color: '#000000', stroke_width: '1.6 vmin',
      animations: [{ time: 'start', duration: 0.35, type: 'scale', start_scale: '70%', end_scale: '100%', easing: 'quadratic-out' }] });
    if (!vertical && p.plano.capitulo) els.push({ type: 'text', text: String(p.plano.capitulo).slice(0, 60), time: 0, duration: Math.min(2.5, dur), y: '14%', width: '80%',
      font_family: fuente, font_weight: '700', font_size: '6 vmin', fill_color: color, background_color: 'rgba(0,0,0,0.45)', x_padding: '3 vmin', y_padding: '1.5 vmin',
      animations: [{ time: 'start', duration: 0.4, type: 'fade' }, { time: 'end', duration: 0.4, type: 'fade', reversed: true }] });
    for (const x of efectos[p.plano_id] || []) els.push({ type: 'audio', source: x.url, time: 0, duration: Math.min(dur, x.duracion_s || dur), volume: m.efectos_volumen || '35%', audio_fade_out: 0.4 });
    return { type: 'composition', track: 1, name: p.plano_id, duration: dur,
      transition: i && (p.plano.transicion || m.transicion) === 'fundido' ? { type: 'fade', duration: 0.5 } : undefined, elements: els };
  });
  total = Math.round(total * 100) / 100;
  const elementos = [...escenas];
  if (son.musica?.url) elementos.push({ type: 'audio', track: 2, time: 0, duration: total, source: son.musica.url,
    volume: m.musica_volumen || '16%', audio_fade_in: 1, audio_fade_out: 2.5 });
  const creditos = [son.musica?.credito, ...(son.efectos || []).map(x => x && x.credito), ...listos.filter(p => p.fuente).map(p => `${p.fuente.banco}: ${p.fuente.autor} (${p.fuente.pagina})`)]
    .filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  return { source: { output_format: 'mp4', width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080, frame_rate: 30, elements: elementos },
    listos: listos.length, esperados: orden.length, total, subtitulos, creditos };
}
"""


# ======================================================================================
# M4–M6 · Producción: carpeta del video, planos, freno de gasto, sonido, montaje y costos
# ======================================================================================
f = Flow(W['prod'], 'M4–M6 · Producción')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Plan de producción', PRESENTACION_JS + r"""
const e = $('Inicio').first().json; const aj = $('Leer ajustes').first().json;
const presentacion = validarPresentacion(e.presentacion);
const planos = planosPresentacion((e.storyboard?.planos || []).filter(p => p && p.id), presentacion);
if (new Set(planos.map(p => p.id)).size !== planos.length) throw new Error('IDs de plano duplicados');
// Regla del operador: un Short nunca es una sucesión de imágenes fijas. El primer plano (el gancho) siempre se
// mueve, y al menos `movimientoMinShort` de los planos tienen movimiento real (archivo o clip animado). Si el
// storyboard se queda corto, se animan las imágenes de más emoción, sin pasar el tope de clips ni el presupuesto.
const seg = p => Math.max(4, Math.min(8, Math.round(String(p.texto_narrado || '').replace(/\[[^\]]*\]/g, '').split(/\s+/).filter(Boolean).length / 2.5)));
const movimiento = { animados: [] };
if (e.formato === 'short' && aj.allowClips) {
  const presupuesto0 = Number(e.presupuesto_usd) || aj.presupuestoShortUsd;
  const topeClips = Math.min(aj.clipsMaxShort ?? 4, e.biblia?.presupuesto?.clips_max ?? 99);
  const mueve = p => ['clip', 'archivo', 'avatar'].includes(p.tipo);
  const costoActual = () => planos.reduce((a, p) => a + (['imagen', 'clip'].includes(p.tipo) ? aj.costoImagenUsd + aj.costoRevisionUsd : p.tipo === 'archivo' ? 0.5 * aj.costoImagenUsd + aj.costoRevisionUsd : 0)
    + (p.tipo === 'clip' ? seg(p) * aj.costoClipSegUsd : 0), 0) + planos.length * aj.costoVozUsdPorPlano;
  const orden = planos.map((p, i) => ({ p, i, peso: (i === 0 ? 100 : 0) + (/tension|tensión|sorpresa|asombro|revel|miedo|emoci/i.test(p.emocion || '') ? 10 : 0) + (p.texto_pantalla ? -5 : 0) }))
    .filter(x => x.p.tipo === 'imagen').sort((a, b) => b.peso - a.peso);
  for (const x of orden) {
    const clips = planos.filter(p => p.tipo === 'clip').length; const cuota = planos.filter(mueve).length / planos.length;
    if (clips >= topeClips || (cuota >= aj.movimientoMinShort && mueve(planos[0]))) break;
    const extra = seg(x.p) * aj.costoClipSegUsd;
    if (costoActual() + extra > presupuesto0 * (aj.avisoGastoPct || 1)) continue;
    x.p.tipo = 'clip'; x.p.duracion_clip_s = seg(x.p); movimiento.animados.push(x.p.id);
  }
  planos.forEach(p => { if (p.tipo === 'clip' && !p.duracion_clip_s) p.duracion_clip_s = seg(p); });
  movimiento.cuota = Math.round(planos.filter(mueve).length / Math.max(1, planos.length) * 100) / 100;
}
planos.forEach(p => { if (p.tipo === 'clip' && !p.duracion_clip_s) p.duracion_clip_s = 8; });
const n = t => planos.filter(p => p.tipo === t).length;
const segClips = planos.filter(p => p.tipo === 'clip').reduce((a, p) => a + p.duracion_clip_s, 0);
// Un clip parte de una imagen generada; el archivo (Pexels/Pixabay) no cuesta.
// Incluye la revisión visual de cada plano y, por prudencia, que la mitad del archivo termine generándose.
const revisa = aj.allowRevisionVisual ? aj.costoRevisionUsd : 0;
const costo = (n('imagen') + n('clip') + n('archivo') * 0.5) * (aj.costoImagenUsd + revisa) + n('archivo') * revisa
  + segClips * aj.costoClipSegUsd + planos.filter(p => p.tipo === 'avatar').reduce((a,p) => a + Math.max(1, String(p.texto_narrado).split(/\s+/).length / 2.5) * aj.costoAvatarSegUsd, 0)
  + planos.reduce((a,p) => a + costoVozPresentacion(p.texto_narrado, presentacion, aj), 0);
if (!Number.isFinite(costo)) throw new Error('Configura las tarifas de presentación');
const faltan = [];
if (planos.some(p => p.tipo !== 'avatar') && !aj.allowImagenes) faltan.push('imágenes (OpenAI)');
if (n('clip') && !aj.allowClips) faltan.push('clips (Gemini Omni)');
if ((n('avatar') || presentacion?.avatar) && !aj.allowAvatar) faltan.push('avatar (HeyGen)');
if (!aj.allowVoz) faltan.push('voz (Gemini TTS)');
if (!aj.allowDrive) faltan.push('alojamiento (Google Drive)');
if (!aj.allowMontaje) faltan.push('montaje (Creatomate)');
const presupuesto = Number(e.presupuesto_usd ?? (e.formato === 'short' ? aj.presupuestoShortUsd : aj.presupuestoLargoUsd));
if (!Number.isFinite(presupuesto) || presupuesto < 0) throw new Error('Presupuesto inválido');
if (costo > presupuesto) faltan.push(`ajustar el storyboard al tope (cuesta ~US$${(Math.round(costo * 100) / 100)}, tope US$${presupuesto})`);
return [{ json: { ...e, presentacion, planos, movimiento, bloqueo: presentacion?.avatar && !aj.allowAvatar ? 'avatar_apagado' : !aj.allowVoz ? 'voz_apagada' : costo > presupuesto ? 'presupuesto' : faltan.length ? 'produccion_pausada' : '', costo_estimado_usd: Math.round(costo * 100) / 100, presupuesto,
  dentro: costo <= presupuesto, faltan, chatId: aj.chatId } }];
""")
iff(f, '¿Todo encendido?', '$json.faltan.length === 0')
tg(f, 'Aviso: falta encender', '={{ $json.chatId }}',
   "={{ 'Producción de ' + $json.video_id + ' preparada (' + $json.planos.length + ' planos, ~US$' + $json.costo_estimado_usd + '). Falta encender: ' + $json.faltan.join(', ') + '.' }}")
iff(f, '¿Dentro del presupuesto?', '$json.dentro === true')
tg(f, 'Aviso: sobre presupuesto', '={{ $json.chatId }}',
   "={{ 'El video ' + $json.video_id + ' costaría ~US$' + $json.costo_estimado_usd + ' y el tope es US$' + $json.presupuesto + '. Reduce clips o sube el tope.' }}")

# --- Carpeta en Drive: Fabrica de Videos / <canal> / <video> v<n> -----------------------
gapi(f, 'Carpeta del canal: buscar', 'GET', 'https://www.googleapis.com/drive/v3/files', 'googleDriveOAuth2Api',
     query={'q': "={{ \"name='\" + $('Plan de producción').first().json.canal_id + \"' and '\" + $('Leer ajustes').first().json.driveCarpetaRaizId + \"' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false\" }}",
            'fields': 'files(id,name)'}, timeout=30000)
iff(f, '¿Existe la carpeta del canal?', '($json.files || []).length > 0')
gapi(f, 'Carpeta del canal: crear', 'POST', 'https://www.googleapis.com/drive/v3/files', 'googleDriveOAuth2Api',
     json_body="={{ { name: $('Plan de producción').first().json.canal_id, mimeType: 'application/vnd.google-apps.folder', parents: [$('Leer ajustes').first().json.driveCarpetaRaizId] } }}", timeout=30000)
CARPETA_CANAL = "($('Carpeta del canal: crear').isExecuted ? $('Carpeta del canal: crear').first().json.id : $('Carpeta del canal: buscar').first().json.files[0].id)"
gapi(f, 'Carpeta del video', 'POST', 'https://www.googleapis.com/drive/v3/files', 'googleDriveOAuth2Api',
     json_body="={{ { name: $('Plan de producción').first().json.video_id + ' · ' + String($('Plan de producción').first().json.tema || '').slice(0, 60) + ' · v' + ($('Plan de producción').first().json.version || 1), mimeType: 'application/vnd.google-apps.folder', parents: [" + CARPETA_CANAL + "] } }}",
     timeout=30000)
CARPETA = "={{ $('Carpeta del video').first().json.id }}"
code(f, 'Archivos del encargo', r"""
// Guion, storyboard y biblia quedan junto al video: cualquier versión se puede rehacer o auditar.
const e = $('Plan de producción').first().json;
const json = (nombre, obj) => ({ json: { nombre }, binary: { archivo: { data: Buffer.from(JSON.stringify(obj, null, 2)).toString('base64'), mimeType: 'application/json', fileName: nombre } } });
return [json('storyboard.json', { ...e.storyboard, presentacion:e.presentacion, planos:e.planos }), json('biblia.json', e.biblia || {}), json('guion.json', e.guion || {})];
""")
gapi(f, 'Encargo: subir', 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api',
     binary_field='archivo', query={'uploadType': 'media'})
gapi(f, 'Encargo: nombrar', 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
     json_body="={{ { name: $('Archivos del encargo').item.json.nombre } }}",
     query={'addParents': CARPETA, 'removeParents': 'root'}, timeout=30000)
code(f, 'Carpeta en la tabla', "return [{ json: { drive_carpeta: 'https://drive.google.com/drive/folders/' + $('Carpeta del video').first().json.id, etapa: 'produccion', estado: 'en_proceso', error: '' } }];")
dt_update(f, 'Video en producción', 'videos', 'video_id', "={{ $('Plan de producción').first().json.video_id }}")

# --- Un ítem por plano ------------------------------------------------------------------
code(f, 'Un ítem por plano', r"""
const e = $('Plan de producción').first().json; const b = e.biblia || {};
const estilo = [b.estilo_visual?.descripcion, b.estilo_visual?.luz, b.estilo_visual?.lente, b.estilo_visual?.textura,
  (b.estilo_visual?.paleta_hex || []).length ? 'paleta ' + b.estilo_visual.paleta_hex.join(' ') : ''].filter(Boolean).join('. ');
const refs = id => [...(b.personajes || []), ...(b.escenarios || [])].filter(x => (id || []).includes(x.id)).flatMap(x => x.referencias_urls || []).slice(0, 6);
// Sin prompt_imagen (planos de archivo): la escena sale de lo que dice la voz y de la búsqueda, nunca solo del estilo del canal.
const limpio = t => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
const escena = p => limpio(p.prompt_imagen) || [p.busqueda_archivo ? 'Escena: ' + p.busqueda_archivo : '', 'Lo que narra la voz: ' + limpio(p.texto_narrado)].filter(Boolean).join('. ');
return e.planos.map(p => ({ json: { video_id: e.video_id, plano: p, intento: 1,
  prompt: `${escena(p)}. Encuadre ${p.encuadre}, ángulo ${p.angulo || 'a la altura de los ojos'}, luz ${p.luz}. Estilo: ${estilo}. Sin texto, letras, cifras ni logos dentro de la imagen: las cifras las pone el montaje encima.`,
  referencias: refs([...(p.personajes || []), p.escenario]),
  salida: p.tipo === 'avatar' ? 1 : (p.tipo === 'archivo' && $('Leer ajustes').first().json.allowArchivo) ? 2 : 0 } }));
""")
switch(f, 'Según tipo de plano', 3)
# Planos de archivo: Pexels y luego Pixabay; si ninguno tiene algo que sirva, se genera la imagen.
http(f, 'Buscar en Pexels', 'GET', "={{ 'https://api.pexels.com/videos/search?per_page=10&size=medium&orientation=' + ($('Plan de producción').first().json.formato === 'short' ? 'portrait' : 'landscape') + '&query=' + encodeURIComponent($json.plano.busqueda_archivo || $json.plano.prompt_imagen) }}",
     cred=CRED_PEXELS, timeout=30000)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code1(f, 'Elegir de Pexels', r"""
const prev = $('Un ítem por plano').item.json; const vertical = $('Plan de producción').first().json.formato === 'short';
const ok = f => f.link && f.width && f.height && (vertical ? f.height > f.width : f.width > f.height) && Math.max(f.width, f.height) >= 1280;
// Hasta 3 videos distintos (el mejor archivo de cada uno) con su miniatura: el revisor visual elige o los rechaza todos.
const candidatos = ($json.videos || []).filter(x => x.duration >= 4).map(x => {
  const f = (x.video_files || []).filter(ok).sort((a, b) => Math.abs(Math.max(a.width, a.height) - 1920) - Math.abs(Math.max(b.width, b.height) - 1920))[0];
  return f ? { url: f.link, thumb: x.image || (x.video_pictures || [])[0]?.picture || '', fuente: { banco: 'Pexels', autor: x.user?.name, pagina: x.url } } : null;
}).filter(c => c && c.thumb).slice(0, 3);
return { json: { ...prev, candidatos } };
""")
iff(f, '¿Hay en Pexels?', '($json.candidatos || []).length > 0')
http(f, 'Buscar en Pixabay', 'GET', "={{ 'https://pixabay.com/api/videos/?per_page=10&safesearch=true&q=' + encodeURIComponent(($json.plano.busqueda_archivo || $json.plano.prompt_imagen).slice(0, 100)) }}",
     cred=CRED_PIXABAY, timeout=30000)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
f.nodes[-1]['parameters']['genericAuthType'] = 'httpQueryAuth'
code1(f, 'Elegir de Pixabay', r"""
const prev = $('Un ítem por plano').item.json; const vertical = $('Plan de producción').first().json.formato === 'short';
const candidatos = ($json.hits || []).filter(h => h.duration >= 4).map(h => ({ h, f: h.videos?.large?.url ? h.videos.large : h.videos?.medium }))
  .filter(x => x.f?.url && (vertical ? x.f.height > x.f.width : x.f.width > x.f.height))
  .map(x => ({ url: x.f.url, thumb: x.f.thumbnail || x.h.videos?.medium?.thumbnail || '', fuente: { banco: 'Pixabay', autor: x.h.user, pagina: x.h.pageURL } }))
  .filter(c => c.thumb).slice(0, 3);
return { json: { ...prev, candidatos } };
""")
iff(f, '¿Hay en Pixabay?', '($json.candidatos || []).length > 0')
code1(f, 'Pedido de revisión de archivo', "return { json: { ...$json, revisar: $('Leer ajustes').first().json.allowRevisionVisual === true } };")
iff(f, '¿Revisar archivo?', '$json.revisar === true')
http(f, 'Revisar archivo', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloTexto, text: { format: { type: 'json_object' } }, input: [{ role: 'user', content: [{ type: 'input_text', text: " + JS(ROL_REVISOR) + " + ' Escena (lo que dice la voz): ' + $json.plano.texto_narrado + '. Búsqueda usada: ' + ($json.plano.busqueda_archivo || '') + '. Es video real de archivo: tolera letreros o logos pequeños de fondo (recháza solo si una marca o un texto es protagonista) y no exijas cifras: el montaje las pone encima. Te muestro ' + $json.candidatos.length + ' miniaturas de clips de archivo, en orden (1, 2, 3). Elige el número del mejor que sirva para esta escena o -1 si ninguno sirve. Responde JSON {\\\"elegido\\\": n, \\\"motivo\\\": \\\"\\\"}.' }, ...$json.candidatos.map(c => ({ type: 'input_image', image_url: c.thumb }))] }] } }}",
     timeout=90000, cred=CRED_OPENAI)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code1(f, 'Archivo elegido', r"""
// Sin revisión: el primero. Con revisión: el que eligió el revisor visual; si ninguno sirve (o falló), se genera la imagen.
const p = $('Pedido de revisión de archivo').item.json; const c = p.candidatos || [];
let n = 1, motivo = '';
if (p.revisar) { try { const v = JSON.parse(($json.output || []).flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text || '{}'); n = Number(v.elegido); motivo = String(v.motivo || ''); } catch (e) { n = -1; motivo = 'revisión ilegible'; } }
const elegido = Number.isInteger(n) && n >= 1 && n <= c.length ? c[n - 1] : null;
return { json: { ...p, url: elegido?.url || '', fuente: elegido?.fuente || null, nota_archivo: elegido ? '' : ('archivo rechazado: ' + (motivo || 'ninguno sirve')).slice(0, 200) } };
""")
iff(f, '¿Sirve el archivo?', '!!$json.url')
code1(f, 'Archivo aprobado', "return { json: { video_id: $json.video_id, plano_id: $json.plano.id, url: $json.url, plano: { ...$json.plano, tipo: 'archivo' }, fuente: $json.fuente, intento: 0 } };")
code1(f, 'Sin archivo: generar', "const p = $('Un ítem por plano').item.json; return { json: { ...p, plano: { ...p.plano, tipo: 'imagen' } } };")
# Todo pedido de imagen (primer intento, plano de archivo sin resultado o repetición) pasa por aquí.
code1(f, 'Pedido de imagen', "return { json: { ...$json, plano: { ...$json.plano, tipo: $json.plano.tipo === 'archivo' ? 'imagen' : $json.plano.tipo } } };")
# Imagen con referencias vía Responses API (herramienta de imagen).
http(f, 'Generar imagen', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloTexto, tools: [{ type: 'image_generation', model: $('Leer ajustes').first().json.modeloImagen, size: $('Plan de producción').first().json.formato === 'short' ? '1024x1536' : '1536x1024' }], tool_choice: { type: 'image_generation' }, input: [{ role: 'user', content: [{ type: 'input_text', text: $json.prompt }, ...$json.referencias.map(u => ({ type: 'input_image', image_url: u }))] }] } }}",
     timeout=180000, cred=CRED_OPENAI)
f.nodes[-1].update({'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 5000})
code1(f, 'Extraer imagen', r"""
const out = ($json.output || []).find(o => o.type === 'image_generation_call');
const pedido = $('Pedido de imagen').item.json;   // primer intento o repetición
if (!out?.result) throw new Error('Sin imagen en la respuesta para ' + pedido.plano?.id);
return { json: pedido,
  binary: { imagen: { data: out.result, mimeType: 'image/png', fileName: pedido.plano.id + '.png' } } };
""")
iff(f, '¿Es clip?', "$json.plano.tipo === 'clip'")
# Clip: la imagen ya generada (con las referencias de la biblia) es el primer fotograma; Gemini Omni la anima.
http(f, 'Animar (Gemini Omni)', 'POST', 'https://generativelanguage.googleapis.com/v1beta/interactions',
     body="={{ { model: $('Leer ajustes').first().json.modeloClip, store: false, input: [{ type: 'image', data: $('Generar imagen').item.json.output.find(o => o.type === 'image_generation_call').result, mime_type: 'image/png' }, { type: 'text', text: '<FIRST_FRAME> [0-' + ($json.plano.duracion_clip_s || 8) + 's] ' + ($json.plano.prompt_movimiento || $json.plano.movimiento || 'movimiento de cámara lento') + '. ' + $json.plano.prompt_imagen + '. Use this image as the starting frame. Sin texto ni logos. Sin diálogo.' }], generation_config: { video_config: { task: 'image_to_video' } }, response_format: { type: 'video', aspect_ratio: $('Plan de producción').first().json.formato === 'short' ? '9:16' : '16:9', resolution: '720p' } } }}",
     timeout=600000, cred=CRED_GEMINI)
code1(f, 'Extraer clip', r"""
// Gemini Omni entrega el clip en base64 o, si pesa más de 4 MB, como URI que hay que descargar con la clave.
const prev = $('Extraer imagen').item.json;
const v = ($json.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).find(c => c.type === 'video');
if (v?.data) return { json: { ...prev, clip_uri: '' }, binary: { imagen: { data: v.data, mimeType: v.mime_type || 'video/mp4', fileName: prev.plano.id + '.mp4' } } };
if (v?.uri) return { json: { ...prev, clip_uri: v.uri } };
throw new Error('Sin video en la respuesta de Gemini Omni para ' + prev.plano?.id);
""")
iff(f, '¿Clip por URI?', "!!$json.clip_uri")
f.add('Descargar clip', 'n8n-nodes-base.httpRequest', 4.2,
      {'method': 'GET', 'url': '={{ $json.clip_uri }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
       'options': {'timeout': 300000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'imagen'}}}},
      credentials=CRED_GEMINI, retryOnFail=True, maxTries=3, waitBetweenTries=5000)
code1(f, 'Clip descargado', "const prev = $('Extraer imagen').item.json; const b = $binary.imagen; return { json: { ...prev, clip_uri: '' }, binary: { imagen: { ...b, mimeType: 'video/mp4', fileName: prev.plano.id + '.mp4' } } };")
gapi(f, 'Subir a Drive', 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api',
     binary_field='imagen', query={'uploadType': 'media'})
gapi(f, 'Nombrar en Drive', 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
     json_body="={{ { name: $('Extraer imagen').item.json.plano.id + '-i' + $('Extraer imagen').item.json.intento + ($('Extraer imagen').item.json.plano.tipo === 'clip' ? '.mp4' : '.png') } }}",
     query={'addParents': CARPETA, 'removeParents': 'root'}, timeout=30000)
gapi(f, 'Compartir enlace', 'POST', "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Subir a Drive').item.json.id + '/permissions' }}",
     'googleDriveOAuth2Api', json_body='={{ { role: "reader", type: "anyone" } }}', timeout=30000)
code1(f, 'URL del plano', r"""
const prev = $('Extraer imagen').item.json; const id = $('Subir a Drive').item.json.id;
return { json: { ...prev, url: 'https://drive.google.com/uc?export=download&id=' + id } };
""")
iff(f, '¿Revisión visual activa?', "$('Leer ajustes').first().json.allowRevisionVisual === true && $json.plano.tipo !== 'clip'")
http(f, 'Revisar plano', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloTexto, text: { format: { type: 'json_object' } }, input: [{ role: 'user', content: [{ type: 'input_text', text: " + JS(ROL_REVISOR) + " + ' Escena (lo que dice la voz): ' + $json.plano.texto_narrado + (($json.plano.texto_pantalla) ? ' · El montaje pondrá encima el texto «' + $json.plano.texto_pantalla + '»: NO lo exijas dentro de la imagen; la imagen debe ir sin texto.' : '') + '. La primera imagen es la generada; las siguientes, las referencias. Responde JSON {\"aprobado\": bool, \"problemas\": [], \"prompt_corregido\": \"\"}.' }, { type: 'input_image', image_url: $json.url }, ...$json.referencias.map(u => ({ type: 'input_image', image_url: u }))] }] } }}",
     timeout=120000, cred=CRED_OPENAI)
code(f, 'Veredicto', r"""
// Repetir una imagen cuesta: solo se repite si cabe en el tope del video, contando lo ya gastado en TODAS las pasadas
// (imágenes y revisiones) y reservando lo que falta generar. Si no cabe, se acepta y queda anotado.
const aj = $('Leer ajustes').first().json; const e = $('Plan de producción').first().json; const max = aj.maxIntentosPlano;
const pasadas = n => { const l = []; if (!$(n).isExecuted) return l; for (let k = 0; k < 500; k++) { let it; try { it = $(n).all(0, k); } catch (x) { break; } if (!it || !it.length) break; l.push(...it); } return l; };
const hechas = pasadas('Extraer imagen'); const ya = new Set(hechas.map(i => i.json.plano?.id));
const revisiones = pasadas('Revisar plano').length + pasadas('Revisar archivo').length;
const unidad = aj.costoImagenUsd + aj.costoRevisionUsd;
const faltan = (e.planos || []).filter(p => ['imagen', 'clip'].includes(p.tipo) && !ya.has(p.id)).length;
const gastado = hechas.length * aj.costoImagenUsd + revisiones * aj.costoRevisionUsd;
// Tope para repetir: el umbral del aviso de gasto, para que las repeticiones no frenen el video pidiendo permiso.
let cupo = Math.floor((e.presupuesto * (aj.avisoGastoPct || 1) - gastado - faltan * unidad - (e.planos || []).length * aj.costoVozUsdPorPlano) / unidad + 1e-9);
return $input.all().map((it, i) => {
  const prev = $('URL del plano').itemMatching(i).json; let v = { aprobado: true };
  try { v = JSON.parse((it.json.output || []).flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text || '{}'); } catch (x) { v = { aprobado: false, problemas: ['respuesta ilegible'] }; }
  const quiere = v.aprobado === false && prev.intento < max;
  const repetir = quiere && cupo > 0; if (repetir) cupo--;
  const prompt = repetir && v.prompt_corregido ? v.prompt_corregido + '. Sin texto, letras, cifras ni logos dentro de la imagen.' : prev.prompt;
  const problemas = [...(v.problemas || []), ...(quiere && !repetir ? ['aceptado sin repetir: no cabe en el tope de gasto'] : [])];
  return { json: { ...prev, revisiones: (prev.revisiones || 0) + 1, veredicto: { ...v, problemas }, repetir, intento: prev.intento + (repetir ? 1 : 0), prompt } };
});
""")
iff(f, '¿Repetir plano?', '$json.repetir === true')
code1(f, 'Plano aprobado', "return { json: { video_id: $json.video_id, plano_id: $json.plano.id, url: $json.url, plano: $json.plano, intento: $json.intento, revisiones: $json.revisiones || 0, nota_revision: ($json.veredicto?.problemas || []).join('; ') } };")
code1(f, 'Plano para avatar', "return { json: { video_id: $json.video_id, plano_id: $json.plano.id, url: '', plano: $json.plano, intento: 0, nota_revision: 'pendiente de sincronización con la voz elegida' } };")
# Puerta: a «Juntar planos» llegan tres caminos (archivo, imagen con reintentos y avatar). n8n lo ejecuta una vez por cada llegada,
# así que solo deja pasar cuando están TODOS los planos del plan, juntando lo que dejó cada camino en todas sus pasadas.
# (Antes era un nodo Aggregate: la primera llegada, con solo los planos de archivo, seguía sola hasta el montaje.)
code(f, 'Juntar planos', r"""
const plan = $('Plan de producción').first().json.planos || [];
const ids = plan.map(p => p.id);
const listos = new Map();
for (const fuente of ['Archivo aprobado', 'Plano aprobado', 'Plano para avatar']) {
  if (!$(fuente).isExecuted) continue;
  for (let pasada = 0; pasada < 500; pasada++) {
    let items; try { items = $(fuente).all(0, pasada); } catch (e) { break; }
    if (!items || !items.length) break;
    for (const it of items) if (it.json.plano_id) listos.set(it.json.plano_id, it.json);
  }
}
if (!ids.length || ids.some(id => !listos.has(id))) return [];   // aún faltan planos: esta llegada no sigue
return [{ json: { planos: ids.map(id => listos.get(id)) } }];
""")

# --- Registro de planos y freno de gasto ------------------------------------------------
code(f, 'Filas de planos', r"""
const aj = $('Leer ajustes').first().json;
return $('Juntar planos').first().json.planos.map(p => ({ json: { video_id: p.video_id, plano_id: p.plano_id, tipo: p.plano?.tipo || '', usa_avatar:p.plano?.tipo === 'avatar', presentacion:JSON.stringify(p.plano?.presentacion || null),
  archivo_url: p.url || '', estado: p.url ? 'listo' : 'pendiente', intentos: p.intento || 0, nota_revision: String(p.nota_revision || '').slice(0, 500),
  costo_usd: Math.round(((['imagen', 'clip'].includes(p.plano?.tipo) ? (p.intento || 1) * aj.costoImagenUsd : 0)
    + (p.plano?.tipo === 'clip' ? (p.plano.duracion_clip_s || 8) * aj.costoClipSegUsd : 0) + (p.revisiones || 0) * aj.costoRevisionUsd) * 1000) / 1000 } }));
""")
dt_insert(f, 'Guardar planos', 'planos')
code(f, 'Gasto de planos', r"""
// Lo gastado hasta aquí, contado plano por plano (incluye repeticiones y revisiones).
const aj = $('Leer ajustes').first().json; const e = $('Plan de producción').first().json;
const planos = $('Juntar planos').first().json.planos;
const imagenes = planos.filter(p => ['imagen', 'clip'].includes(p.plano?.tipo)).reduce((a, p) => a + (p.intento || 1), 0);
const clips = planos.filter(p => p.plano?.tipo === 'clip').length; const segClips = planos.filter(p => p.plano?.tipo === 'clip').reduce((a, p) => a + (p.plano.duracion_clip_s || 8), 0);
const revisiones = planos.reduce((a, p) => a + (p.revisiones || 0), 0);
const usd = imagenes * aj.costoImagenUsd + segClips * aj.costoClipSegUsd + revisiones * aj.costoRevisionUsd;
const pct = usd / (e.presupuesto || 1);
return [{ json: { imagenes, clips, seg_clips: segClips, revisiones, usd: Math.round(usd * 100) / 100, pct: Math.round(pct * 100) / 100, aviso: pct >= aj.avisoGastoPct } }];
""")
iff(f, '¿Pasa el aviso de gasto?', '$json.aviso === true')
pe = "$('Plan de producción').first().json"
gasto_ini, gasto_fin, gasto_dec = decision(f, 'Permiso de gasto', "'gasto'", "'Permiso de gasto · ' + " + pe + ".video_id",
    "'El video ' + " + pe + ".video_id + ' ya gastó ~US$' + $('Gasto de planos').first().json.usd + ' (' + Math.round($('Gasto de planos').first().json.pct * 100) + ' % del tope de US$' + " + pe + ".presupuesto + ') solo en imágenes y clips. ¿Sigo con voz, música y montaje?'",
    [('Seguir', 'seguir'), ('Detener', 'detenido')], pe, False,
    aviso="'💸 Permiso de gasto · ' + " + pe + ".video_id + '\\nYa gastó ~US$' + $('Gasto de planos').first().json.usd + ' en imágenes (' + Math.round($('Gasto de planos').first().json.pct * 100) + ' % del tope de US$' + " + pe + ".presupuesto + ').\\n\\n¿Sigo con voz, música y montaje? Ábrelo para decidir.'")
iff(f, '¿Sigo?', "$('" + gasto_dec + "').first().json.estado === 'seguir'")
code(f, 'Producción detenida', "return [{ json: { etapa: 'produccion', estado: 'detenido', error: 'detenido por el operador al pasar el aviso de gasto' } }];")
dt_update(f, 'Video detenido', 'videos', 'video_id', "={{ $('Plan de producción').first().json.video_id }}")

# --- Sonido -----------------------------------------------------------------------------
code(f, 'Encargo de sonido', r"""
const e = $('Plan de producción').first().json;
return [{ json: { video_id: e.video_id, presentacion: e.presentacion, biblia: e.biblia || {}, musica: e.storyboard?.musica || {}, efectos: e.storyboard?.efectos || [],
  carpeta: $('Carpeta del video').first().json.id, planos: $('Juntar planos').first().json.planos } }];
""")
call(f, 'Sonido y emoción', W['sonido'])

# --- Montaje ----------------------------------------------------------------------------
code(f, 'Composición Creatomate', COMPONER + r"""
const e = $('Plan de producción').first().json;
const c = componer({ plan: e, planos: $json.planos || $('Juntar planos').first().json.planos, son: $json, vertical: e.formato === 'short' });
return [{ json: { source: c.source, video_id: e.video_id, canal_id: e.canal_id, planos: c.listos, esperados: c.esperados,
  duracion_estimada_s: c.total, subtitulos: c.subtitulos, creditos: c.creditos } }];
""")
http(f, 'Renderizar', 'POST', 'https://api.creatomate.com/v2/renders', body='={{ { source: $json.source } }}', timeout=60000, cred=CRED_CREATOMATE)
wait(f, 'Esperar render', 45)
http(f, 'Consultar render', 'GET', "={{ 'https://api.creatomate.com/v2/renders/' + ($('Renderizar').first().json.id || $('Renderizar').first().json[0]?.id) }}", timeout=30000, cred=CRED_CREATOMATE)
iff(f, '¿Render listo?', "$json.status === 'succeeded'")
iff(f, '¿Render fallido?', "$json.status === 'failed'")
tg(f, 'Aviso: render fallido', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ 'El montaje de ' + $('Plan de producción').first().json.video_id + ' falló en Creatomate: ' + String($json.error_message || '').slice(0, 300) }}")

# --- Costos reales del video ------------------------------------------------------------
code(f, 'Costos del video', r"""
// Una fila por concepto en «costos». Los montos de pago por uso son estimados con los precios de Ajustes;
// música, efectos y montaje van dentro de suscripciones (0 US$, se anotan para saber qué se usó).
const aj = $('Leer ajustes').first().json; const g = $('Gasto de planos').first().json;
const son = $('Sonido y emoción').first().json; const vid = $('Plan de producción').first().json.video_id;
const filas = [
  ['imágenes', 'OpenAI', g.imagenes * aj.costoImagenUsd],
  ['clips', 'Gemini Omni', (g.seg_clips ?? g.clips * 8) * aj.costoClipSegUsd],
  ['revisión visual', 'OpenAI', g.revisiones * aj.costoRevisionUsd],
  ['voz', 'Gemini TTS', (son.voces || []).length * aj.costoVozUsdPorPlano],
  ['música', 'Epidemic Sound (suscripción)', 0],
  ['efectos', 'Epidemic Sound (suscripción)', 0],
  ['montaje', 'Creatomate (créditos)', 0],
].filter(([c, s, usd], i) => usd > 0 || i >= 4);
return filas.map(([concepto, servicio, usd]) => ({ json: { video_id: vid, concepto, servicio, usd: Math.round(usd * 1000) / 1000 } }));
""")
dt_insert(f, 'Guardar costos', 'costos')
code(f, 'Costo total', "const t = $('Costos del video').all().reduce((a, i) => a + i.json.usd, 0); return [{ json: { costo_usd: Math.round(t * 100) / 100, etapa: 'calidad' } }];")
dt_update(f, 'Costo en la tabla', 'videos', 'video_id', "={{ $('Plan de producción').first().json.video_id }}")
code(f, 'Encargo de derivados', r"""
const e = $('Plan de producción').first().json;
return [{ json: { plan: e, planos: $('Juntar planos').first().json.planos, son: $('Sonido y emoción').first().json, carpeta: $('Carpeta del video').first().json.id } }];
""")
call(f, 'Derivados', W['deriv'])
code(f, 'Costo de derivados', r"""
const d = $json; const vid = $('Plan de producción').first().json.video_id;
const filas = [];
if (d.costo_usd) filas.push({ video_id: vid, concepto: 'miniatura', servicio: 'OpenAI', usd: Math.round(d.costo_usd * 1000) / 1000 });
if ((d.cortes || []).length) filas.push({ video_id: vid, concepto: 'cortes verticales (' + d.cortes.length + ')', servicio: 'Creatomate (créditos)', usd: 0 });
return filas.length ? filas.map(x => ({ json: x })) : [{ json: { nada: true } }];
""")
iff(f, '¿Anotar derivados?', '$json.nada !== true')
dt_insert(f, 'Guardar costo de derivados', 'costos')
code(f, 'Encargo de calidad', r"""
const c = $('Composición Creatomate').first().json; const r = $('Consultar render').last().json; const e = $('Plan de producción').first().json;
const son = $('Sonido y emoción').first().json; const d = $('Derivados').first().json;
return [{ json: { video_id: c.video_id, canal_id: c.canal_id, render_url: r.url, duracion_s: r.duration, ancho: r.width, alto: r.height,
  planos: c.planos, esperados: c.esperados, creditos: c.creditos, subtitulos: c.subtitulos, duracion_estimada_s: c.duracion_estimada_s,
  voces: (son.voces || []).map(v => ({ plano_id: v.plano_id, ppm: v.palabras_por_minuto, duracion_s: v.duracion_s })),
  usa_musica: !!son.musica?.url, costo_usd: Math.round(($('Costo total').first().json.costo_usd + (d.costo_usd || 0)) * 100) / 100, presupuesto: e.presupuesto,
  formato: e.formato, carpeta: $('Carpeta del video').first().json.id, tema: e.tema,
  cortes: d.cortes || [], miniatura_url: d.miniatura_url || '', avisos_derivados: d.avisos || [], publicacion: e.storyboard?.publicacion || {}, miniatura_texto: e.storyboard?.miniatura?.texto || '',
  movimiento_real: (() => { const l = $('Juntar planos').first().json.planos; return l.length ? Math.round(l.filter(p => p.url && ['clip', 'archivo'].includes(p.plano?.tipo)).length / l.length * 100) / 100 : 1; })() } }];
""")
f.nodes[-1].update({'executeOnce': True})
call(f, 'Calidad y publicación', W['pub'], wait=False)

f.chain('Inicio', 'Leer ajustes', 'Plan de producción', '¿Todo encendido?')
f.link('¿Todo encendido?', '¿Dentro del presupuesto?', 0)
f.link('¿Todo encendido?', 'Aviso: falta encender', 1)
f.link('¿Dentro del presupuesto?', 'Carpeta del canal: buscar', 0)
f.link('¿Dentro del presupuesto?', 'Aviso: sobre presupuesto', 1)
f.link('Carpeta del canal: buscar', '¿Existe la carpeta del canal?')
f.link('¿Existe la carpeta del canal?', 'Carpeta del video', 0)
f.link('¿Existe la carpeta del canal?', 'Carpeta del canal: crear', 1)
f.link('Carpeta del canal: crear', 'Carpeta del video')
f.chain('Carpeta del video', 'Archivos del encargo', 'Encargo: subir', 'Encargo: nombrar', 'Carpeta en la tabla', 'Video en producción', 'Un ítem por plano', 'Según tipo de plano')
f.link('Según tipo de plano', 'Pedido de imagen', 0)
f.link('Según tipo de plano', 'Plano para avatar', 1)
f.link('Según tipo de plano', 'Buscar en Pexels', 2)
f.chain('Buscar en Pexels', 'Elegir de Pexels', '¿Hay en Pexels?')
f.link('¿Hay en Pexels?', 'Pedido de revisión de archivo', 0)
f.link('¿Hay en Pexels?', 'Buscar en Pixabay', 1)
f.chain('Buscar en Pixabay', 'Elegir de Pixabay', '¿Hay en Pixabay?')
f.link('¿Hay en Pixabay?', 'Pedido de revisión de archivo', 0)
f.link('Pedido de revisión de archivo', '¿Revisar archivo?')
f.link('¿Revisar archivo?', 'Revisar archivo', 0)
f.link('¿Revisar archivo?', 'Archivo elegido', 1)
f.link('Revisar archivo', 'Archivo elegido')
f.link('Archivo elegido', '¿Sirve el archivo?')
f.link('¿Sirve el archivo?', 'Archivo aprobado', 0)
f.link('¿Sirve el archivo?', 'Sin archivo: generar', 1)
f.link('¿Hay en Pixabay?', 'Sin archivo: generar', 1)
f.link('Sin archivo: generar', 'Pedido de imagen')
f.link('Archivo aprobado', 'Juntar planos')
f.chain('Pedido de imagen', 'Generar imagen', 'Extraer imagen', '¿Es clip?')
f.link('¿Es clip?', 'Animar (Gemini Omni)', 0)
f.chain('Animar (Gemini Omni)', 'Extraer clip', '¿Clip por URI?')
f.link('¿Clip por URI?', 'Descargar clip', 0)
f.chain('Descargar clip', 'Clip descargado', 'Subir a Drive')
f.link('¿Clip por URI?', 'Subir a Drive', 1)
f.link('¿Es clip?', 'Subir a Drive', 1)
f.chain('Subir a Drive', 'Nombrar en Drive', 'Compartir enlace', 'URL del plano', '¿Revisión visual activa?')
f.link('¿Revisión visual activa?', 'Revisar plano', 0)
f.link('¿Revisión visual activa?', 'Plano aprobado', 1)
f.chain('Revisar plano', 'Veredicto', '¿Repetir plano?')
f.link('¿Repetir plano?', 'Pedido de imagen', 0)
f.link('¿Repetir plano?', 'Plano aprobado', 1)
f.link('Plano aprobado', 'Juntar planos')
f.link('Plano para avatar', 'Juntar planos')
f.chain('Juntar planos', 'Filas de planos', 'Guardar planos')
f.link('Juntar planos', 'Gasto de planos')
f.link('Gasto de planos', '¿Pasa el aviso de gasto?')
f.link('¿Pasa el aviso de gasto?', gasto_ini, 0)
f.link('¿Pasa el aviso de gasto?', 'Encargo de sonido', 1)
f.link(gasto_fin, '¿Sigo?')
f.link('¿Sigo?', 'Encargo de sonido', 0)
f.link('¿Sigo?', 'Producción detenida', 1)
f.link('Producción detenida', 'Video detenido')
f.chain('Encargo de sonido', 'Sonido y emoción', 'Composición Creatomate', 'Renderizar', 'Esperar render', 'Consultar render', '¿Render listo?')
f.link('¿Render listo?', 'Costos del video', 0)
f.link('¿Render listo?', '¿Render fallido?', 1)
f.link('¿Render fallido?', 'Aviso: render fallido', 0)
f.link('¿Render fallido?', 'Esperar render', 1)
f.chain('Costos del video', 'Guardar costos')
f.link('Costos del video', 'Costo total')
f.chain('Costo total', 'Costo en la tabla', 'Encargo de derivados', 'Derivados', 'Costo de derivados', '¿Anotar derivados?')
f.link('¿Anotar derivados?', 'Guardar costo de derivados', 0)
f.link('¿Anotar derivados?', 'Encargo de calidad', 1)
f.link('Guardar costo de derivados', 'Encargo de calidad')
f.link('Encargo de calidad', 'Calidad y publicación')
PROD = f.dump()

# ======================================================================================
# M5 · Sonido y emoción: voz con emoción (Gemini TTS), música y efectos (Epidemic Sound)
# ======================================================================================
f = Flow(W['sonido'], 'M5 · Sonido y emoción')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Textos de voz', PRESENTACION_JS + r"""
// Un ítem por plano. Gemini TTS lee el texto al pie de la letra: la actuación va aparte, en «style»
// (emoción y ritmo de todo el plano) y en etiquetas <short pause>/<long pause>; el énfasis, en MAYÚSCULAS.
const e = $('Inicio').first().json; const aj = $('Leer ajustes').first().json;
const b = e.biblia || {}; const voz = b.voz || {};
const presentacion = validarPresentacion(e.presentacion);
if (presentacion && !aj.allowVoz) throw new Error('La voz está desactivada');
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
  return { json: { video_id: e.video_id, plano_id: p.plano_id, texto, estilo: estilo.slice(0, 300), voz: presentacion?.voz?.id || voz.gemini_voice || aj.vozGemini, proveedor: presentacion?.voz?.proveedor || 'gemini', presentacion, costo_voz_usd: costoVozPresentacion(texto, presentacion, aj) } };
});
""")
http(f, 'Voz (Gemini TTS)', 'POST', 'https://generativelanguage.googleapis.com/v1beta/interactions',
     body="={{ { model: $('Leer ajustes').first().json.modeloVoz, store: false, input: [{ type: 'user_input', content: [{ type: 'text', text: $json.texto, annotations: [{ type: 'speech_metadata', style: $json.estilo }] }] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: $json.voz }] } } }}",
     cred=CRED_GEMINI, timeout=180000)
f.nodes[-1].update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
code1(f, 'WAV', r"""
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
return { json: { ...prev, duracion_s: Math.round(segundos * 100) / 100, palabras_por_minuto: Math.round(palabras / segundos * 60) },
  binary: { archivo: { data: Buffer.concat([h, recorte]).toString('base64'), mimeType: 'audio/wav', fileName: prev.plano_id + '.wav' } } };
""")
gapi(f, 'Subir voz a Drive', 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api',
     binary_field='archivo', query={'uploadType': 'media'})
gapi(f, 'Nombrar voz', 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
     json_body="={{ { name: $('WAV').item.json.plano_id + '-voz.wav' } }}",
     query={'addParents': "={{ $('Inicio').first().json.carpeta || $('Leer ajustes').first().json.driveCarpetaRaizId }}", 'removeParents': 'root'}, timeout=30000)
gapi(f, 'Compartir voz', 'POST', "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Subir voz a Drive').item.json.id + '/permissions' }}",
     'googleDriveOAuth2Api', json_body='={{ { role: "reader", type: "anyone" } }}', timeout=30000)
code1(f, 'Voz lista', "const w = $('WAV').item.json; return { json: { plano_id: w.plano_id, duracion_s: w.duracion_s, palabras_por_minuto: w.palabras_por_minuto, url: 'https://drive.google.com/uc?export=download&id=' + $('Subir voz a Drive').item.json.id } };")
f.add('Juntar voces', 'n8n-nodes-base.aggregate', 1, {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'voces', 'options': {}})
iff(f, '¿Usa Epidemic?', "$('Leer ajustes').first().json.allowMusica === true || ($('Leer ajustes').first().json.allowEfectos === true && ($('Inicio').first().json.efectos || []).length > 0)")

EP = 'https://www.epidemicsound.com/a/mcp-service/mcp'
H_MCP = {'Accept': 'application/json, text/event-stream'}
SSE = "const sse = t => { const d = String(t || '').split('\\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()); return d.length ? d[d.length - 1] : String(t || ''); };\n" \
      "const datos = t => { const m = JSON.parse(sse(t)); const d = JSON.parse((m.result?.content || []).find(c => c.type === 'text')?.text || '{}'); if (d.errors?.length) throw new Error('Epidemic: ' + d.errors[0].message); return Object.values(d.data || {})[0]; };\n"
def mcp(nombre, cuerpo, sesion=True):
    hd = dict(H_MCP)
    if sesion:
        hd['mcp-session-id'] = "={{ $('Iniciar Epidemic').first().json.headers['mcp-session-id'] }}"
    n = http(f, nombre, 'POST', EP, body=cuerpo, cred=CRED_EPIDEMIC, headers=hd, timeout=90000)
    f.nodes[-1]['parameters']['options']['response'] = {'response': {'fullResponse': True, 'responseFormat': 'text'}}
    f.nodes[-1].update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 4000})
    return n
mcp('Iniciar Epidemic', '={"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"fabrica-n8n","version":"1"}}}', sesion=False)
mcp('Epidemic listo', '={"jsonrpc":"2.0","method":"notifications/initialized","params":{}}')
iff(f, '¿Música activa?', "$('Leer ajustes').first().json.allowMusica === true")
code(f, 'Búsqueda de música', r"""
// Términos a partir del storyboard (estilo) y de la biblia (estilo musical del canal).
const e = $('Inicio').first().json; const b = e.biblia || {};
const termino = [e.musica?.estilo, b.musica?.estilo, b.musica?.mood].filter(Boolean).join(' ') || 'cinematic documentary suspense';
const total = $('Juntar voces').first().json.voces.reduce((a, v) => a + v.duracion_s, 0);
return [{ json: { termino: termino.slice(0, 120), total_s: Math.round(total) } }];
""")
mcp('Buscar música', "={{ JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'SearchRecordings', arguments: { query: { term: $json.termino }, first: 15 } } }) }}")
code(f, 'Elegir pista', SSE + r"""
// Primera pista instrumental y lo bastante larga para cubrir el video.
const nodos = ((datos($json.data) || {}).nodes || []).map(n => n.recording).filter(Boolean);
const total = $('Búsqueda de música').first().json.total_s;
const sinVoz = r => !JSON.stringify(r).toLowerCase().includes('"vocals"');
const dur = r => Number(r.durationInSeconds || r.duration || r.lengthInSeconds || 0);
const pista = nodos.find(r => sinVoz(r) && (!dur(r) || dur(r) >= Math.min(total, 120))) || nodos[0];
if (!pista) throw new Error('Epidemic no devolvió pistas para: ' + $('Búsqueda de música').first().json.termino);
return [{ json: { id: pista.id, titulo: pista.title || pista.name || '', artista: (pista.mainArtists || pista.artists || []).map(a => a.name).join(', ') } }];
""")
mcp('Pedir descarga', "={{ JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'DownloadRecording', arguments: { id: $json.id, options: { fileType: 'MP3', stemType: 'FULL' } } } }) }}")
code(f, 'Música lista', SSE + r"""
const url = (datos($json.data) || {}).assetUrl;
if (!url) throw new Error('Epidemic no dio URL de descarga');
const p = $('Elegir pista').first().json;
// La URL firmada caduca: se usa en el render de inmediato. El crédito va a la descripción del video.
return [{ json: { musica: { url, titulo: p.titulo, credito: `Música: «${p.titulo}» de ${p.artista || 'Epidemic Sound'}, cortesía de Epidemic Sound (www.epidemicsound.com)` } } }];
""")
code(f, 'Efectos pedidos', r"""
// Los efectos que pide el storyboard ({plano, efecto} con el efecto en inglés), como máximo 8 por video.
const aj = $('Leer ajustes').first().json; const lista = ($('Inicio').first().json.efectos || [])
  .filter(x => x && x.plano && x.efecto).slice(0, 8);
if (!aj.allowEfectos || !lista.length) return [{ json: { ninguno: true } }];
return lista.map(x => ({ json: { plano: x.plano, termino: String(x.efecto).slice(0, 80) } }));
""")
iff(f, '¿Hay efectos?', '$json.ninguno !== true')
mcp('Buscar efecto', "={{ JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'SearchSoundEffects', arguments: { query: { term: $json.termino }, first: 5 } } }) }}")
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Elegir efecto', SSE + r"""
// Por cada efecto pedido, el primero de 1 a 15 s.
return $input.all().map((it, i) => {
  const pedido = $('Efectos pedidos').all()[i]?.json || {};
  let nodos = []; try { nodos = ((datos(it.json.data) || {}).nodes || []).map(n => n.soundEffect).filter(Boolean); } catch (err) { nodos = []; }
  const fx = nodos.find(x => { const ms = x.audioFile?.durationInMilliseconds || 0; return ms >= 1000 && ms <= 15000; }) || nodos[0];
  return { json: { plano: pedido.plano, termino: pedido.termino, id: fx?.id || '', titulo: fx?.title || '', duracion_s: fx ? Math.round(fx.audioFile.durationInMilliseconds / 100) / 10 : 0 } };
});
""")
mcp('Pedir efecto', "={{ JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'DownloadSoundEffect', arguments: { id: $json.id || '00000000-0000-0000-0000-000000000000', options: { fileType: 'MP3' } } } }) }}")
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Efecto listo', SSE + r"""
// Un efecto que no se encontró o no se pudo bajar se omite; el video sigue sin él.
const listos = $input.all().map((it, i) => {
  const e = $('Elegir efecto').all()[i].json; let url = '';
  try { url = e.id ? ((datos(it.json.data) || {}).assetUrl || '') : ''; } catch (err) { url = ''; }
  return { json: { plano: e.plano, url, duracion_s: e.duracion_s, credito: 'Efectos de sonido: Epidemic Sound (www.epidemicsound.com)' } };
}).filter(x => x.json.url);
return listos.length ? listos : [{ json: { vacio: true } }];
""")
f.add('Juntar efectos', 'n8n-nodes-base.aggregate', 1, {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'efectos', 'options': {}})
code(f, 'Resultado sonido', r"""
return [{ json: { voces: $('Juntar voces').first().json.voces,
  musica: $('Música lista').isExecuted ? $('Música lista').first().json.musica : null,
  efectos: ($('Juntar efectos').isExecuted ? $('Juntar efectos').first().json.efectos : []).filter(x => x && x.url) } }];
""")
f.chain('Inicio', 'Leer ajustes', 'Textos de voz', 'Voz (Gemini TTS)', 'WAV', 'Subir voz a Drive', 'Nombrar voz', 'Compartir voz', 'Voz lista', 'Juntar voces', '¿Usa Epidemic?')
f.link('¿Usa Epidemic?', 'Iniciar Epidemic', 0)
f.link('¿Usa Epidemic?', 'Resultado sonido', 1)
f.chain('Iniciar Epidemic', 'Epidemic listo', '¿Música activa?')
f.link('¿Música activa?', 'Búsqueda de música', 0)
f.link('¿Música activa?', 'Efectos pedidos', 1)
f.chain('Búsqueda de música', 'Buscar música', 'Elegir pista', 'Pedir descarga', 'Música lista', 'Efectos pedidos', '¿Hay efectos?')
f.link('¿Hay efectos?', 'Buscar efecto', 0)
f.link('¿Hay efectos?', 'Resultado sonido', 1)
f.chain('Buscar efecto', 'Elegir efecto', 'Pedir efecto', 'Efecto listo', 'Juntar efectos', 'Resultado sonido')
SONIDO = f.dump()

# ======================================================================================
# M7 · Calidad y publicación: puerta final con números antes de que lo veas
# ======================================================================================
f = Flow(W['pub'], 'M7 · Calidad y publicación')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Chequeos objetivos', r"""
// Fallas bloquean (el video no te llega); avisos acompañan al video para que decidas.
const e = $('Inicio').first().json; const fallas = []; const avisos = [];
if (!e.render_url) fallas.push('sin archivo de render');
if (e.planos < e.esperados) fallas.push(`faltan planos: ${e.esperados - e.planos} de ${e.esperados}`);
const d = Number(e.duracion_s) || 0; const corto = e.formato === 'short';
if (corto ? (d < 15 || d > 90) : d < 180) fallas.push(`duración fuera de rango: ${Math.round(d)} s`);
if (e.duracion_estimada_s && Math.abs(d - e.duracion_estimada_s) > 1.5) fallas.push(`desfase de sincronía: render ${d} s vs. voz ${e.duracion_estimada_s} s`);
const esperado = corto ? [1080, 1920] : [1920, 1080];
if (e.ancho && e.alto && (e.ancho !== esperado[0] || e.alto !== esperado[1])) fallas.push(`resolución ${e.ancho}x${e.alto}, se esperaba ${esperado.join('x')}`);
if (corto && !e.subtitulos) fallas.push('un Short necesita subtítulos (se ve sin sonido)');
if (e.usa_musica && !(e.creditos || []).some(c => /Epidemic/.test(c))) fallas.push('falta el crédito de la música');
const lentos = (e.voces || []).filter(v => v.ppm && v.ppm < 100).map(v => v.plano_id);
const rapidos = (e.voces || []).filter(v => v.ppm && v.ppm > 200).map(v => v.plano_id);
if (lentos.length) avisos.push(`voz lenta (<100 palabras/min) en ${lentos.join(', ')}`);
if (rapidos.length) avisos.push(`voz rápida (>200 palabras/min) en ${rapidos.join(', ')}`);
if (e.presupuesto && e.costo_usd > e.presupuesto) avisos.push(`costó US$${e.costo_usd}, por encima del tope de US$${e.presupuesto}`);
const minMov = ($('Leer ajustes').isExecuted ? $('Leer ajustes').first().json.movimientoMinShort : 0) || 0.6;
if (corto && e.movimiento_real !== undefined && e.movimiento_real < minMov) avisos.push(`solo ${Math.round(e.movimiento_real * 100)} % de los planos tiene movimiento real (mínimo ${Math.round(minMov * 100)} %): se ve como diapositivas`);
for (const a of e.avisos_derivados || []) avisos.push(a);
return [{ json: { ...e, fallas, avisos, aprobado_qc: fallas.length === 0 } }];
""")
iff(f, '¿Pasa calidad?', '$json.aprobado_qc === true')
code(f, 'Mensaje final', TITULO_JS + r"""
const e = $json;
const extra = e.avisos.length ? '\n\nAvisos:\n• ' + e.avisos.join('\n• ') : '';
const cortes = (e.cortes || []).map(c => `\n• Corte ${c.corte} (${Math.round(c.duracion_s)} s): ${c.url}`).join('');
// Cada título revisado con yt-empaque (mismo titulo.json que usa Claude), junto con el texto de la miniatura.
const mini = e.miniatura_texto || '';
const titulos = (e.publicacion?.youtube?.titulos || []).slice(0, 3).map((t, i) => { const r = revisarTitulo(t, mini);
  return `\n${i + 1}. ${t} — ${r.puntaje}/100` + (r.fallas.length ? ' · ' + r.fallas.map(f => f[0]).join(', ') : ''); }).join('');
const aviso = `🎞️ Video listo · ${Math.round(e.duracion_s)} s · US$${e.costo_usd}\n▶️ ${e.render_url}` + (e.avisos.length ? `\n⚠️ ${e.avisos.length} aviso(s): míralos en el enlace` : '') + '\n\nSi te gusta, apruébalo para publicarlo.';
return [{ json: { etapa: 'final', video_id: e.video_id, canal_id: e.canal_id, aviso,
  contexto: { render_url: e.render_url, creditos: e.creditos || [], cortes: e.cortes || [], miniatura_url: e.miniatura_url || '', publicacion: e.publicacion || {}, formato: e.formato },
  mensaje: (`Video ${e.video_id} listo (${Math.round(e.duracion_s)} s, ~US$${e.costo_usd}).\nRevísalo: ${e.render_url}` + (e.miniatura_url ? `\nMiniatura: ${e.miniatura_url}` : '')
    + (cortes ? `\nCortes verticales:${cortes}` : '') + (titulos ? `\nTítulos propuestos:${titulos}` : '')
    + `\nCarpeta: https://drive.google.com/drive/folders/${e.carpeta}${extra}\n\n¿Lo apruebo para publicarlo?`).slice(0, 3900) } }];
""")
call(f, 'Aprobación final', W['aprob'], wait=False)
code(f, 'Video rechazado por calidad', "return [{ json: { etapa: 'calidad', estado: 'con_fallas', error: $json.fallas.join('; ').slice(0, 500) } }];")
dt_update(f, 'Marcar fallas', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
tg(f, 'Aviso: no pasó calidad', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ '❌ El video ' + $('Inicio').first().json.video_id + ' no pasó el control de calidad (no se publicó):\n• ' + $('Chequeos objetivos').first().json.fallas.join('\n• ') + ($('Inicio').first().json.render_url ? '\n\n▶️ Lo que salió: ' + $('Inicio').first().json.render_url : '') }}")
f.chain('Inicio', 'Leer ajustes', 'Chequeos objetivos', '¿Pasa calidad?')
f.link('¿Pasa calidad?', 'Mensaje final', 0)
f.link('Mensaje final', 'Aprobación final')
f.link('¿Pasa calidad?', 'Video rechazado por calidad', 1)
f.chain('Video rechazado por calidad', 'Marcar fallas', 'Aviso: no pasó calidad')
PUB = f.dump()

# ======================================================================================
# M7 · Aprendizaje: a los 2 y 7 días de publicado, la retención vuelve a Claude como lecciones
# ======================================================================================
f = Flow(W['aprende'], 'M7 · Aprendizaje (2 y 7 días)')
f.add('Cada día', 'n8n-nodes-base.scheduleTrigger', 1.2,
      {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 8}]}})
call(f, 'Leer ajustes', W['ajustes'])
iff(f, '¿Analytics activo?', '$json.allowAnalytics === true')
f.add('Videos publicados', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'publicado'}, {'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 45 * 86400000).toISOString() }}"}]}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)
code(f, 'Toca medir', r"""
// Solo los videos que cumplen hoy 2 o 7 días de publicados.
const hoy = Date.now(); const dia = 86400000;
const toca = $input.all().map(i => i.json).filter(v => v.youtube_id && v.publicado_en).filter(v => {
  const d = Math.floor((hoy - Date.parse(v.publicado_en)) / dia); return d === 2 || d === 7; });
return toca.length ? toca.map(v => ({ json: { ...v, dias: Math.floor((hoy - Date.parse(v.publicado_en)) / dia), desde: v.publicado_en.slice(0, 10) } })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay que medir?', '$json.nada !== true')
code(f, 'Pedir tokens', "return $input.all().map(i => ({ json: { accion: 'token', canal_id: i.json.canal_id } }));")
call(f, 'Tokens de los canales', W['yt'], each=True)
code(f, 'Pedidos de retención', r"""
// Une cada video con el token de su canal (mismo orden). Los canales sin conexión se saltan.
const vids = $('Toca medir').all().map(i => i.json); const toks = $input.all().map(i => i.json);
const out = vids.map((v, i) => ({ ...v, token: toks[i]?.ok ? toks[i].access_token : '' })).filter(v => v.token);
return out.length ? out.map(v => ({ json: v })) : [{ json: { nada: true } }];
""")
iff(f, '¿Algún canal conectado?', '$json.nada !== true')
f.add('Retención', 'n8n-nodes-base.httpRequest', 4.2,
      {'method': 'GET', 'url': 'https://youtubeanalytics.googleapis.com/v2/reports',
       'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Authorization', 'value': "={{ 'Bearer ' + $json.token }}"}]},
       'sendQuery': True, 'queryParameters': {'parameters': [
           {'name': 'ids', 'value': 'channel==MINE'}, {'name': 'dimensions', 'value': 'elapsedVideoTimeRatio'},
           {'name': 'metrics', 'value': 'audienceWatchRatio,relativeRetentionPerformance'},
           {'name': 'filters', 'value': "={{ 'video==' + $json.youtube_id }}"},
           {'name': 'startDate', 'value': '={{ $json.desde }}'}, {'name': 'endDate', 'value': "={{ $now.toFormat('yyyy-MM-dd') }}"}]},
       'options': {}}, onError='continueRegularOutput')
f.add('Publicaciones', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('publicaciones'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 15 * 86400000).toISOString() }}"}]}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)
code(f, 'Toca medir en redes', r"""
// Envíos a TikTok, Instagram, Facebook y YouTube (Upload-Post) que cumplen hoy 2 o 7 días.
const hoy = Date.now(); const dia = 86400000;
const toca = $input.all().map(i => i.json).filter(p => p.request_id && p.publicado_en && p.estado !== 'error')
  .map(p => ({ ...p, dias: Math.floor((hoy - Date.parse(p.publicado_en)) / dia) })).filter(p => p.dias === 2 || p.dias === 7);
return toca.length ? toca.map(p => ({ json: p })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay en redes?', '$json.nada !== true')
http(f, 'Métricas en redes', 'GET', "={{ 'https://api.upload-post.com/api/uploadposts/post-analytics/' + encodeURIComponent($json.request_id) }}", timeout=30000, cred=CRED_UPLOADPOST)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Pedir lecciones', r"""
// YouTube: curva de retención. Redes: vistas, likes, comentarios, compartidos y guardados por red (Upload-Post).
// Todo va a Claude (modo «aprender») por canal; una lección solo entra a la biblia si se repite en 3 videos.
const yt = $('Pedidos de retención').isExecuted ? $('Pedidos de retención').all().map(i => i.json).filter(v => v.video_id) : [];
const ret = $('Retención').isExecuted ? $('Retención').all().map(i => i.json) : [];
const vids = yt.map((v, i) => ({ video_id: v.video_id, canal_id: v.canal_id, dias: v.dias, retencion: ret[i]?.rows || [] }));
const env = $('Métricas en redes').isExecuted ? $('Toca medir en redes').all().map(i => i.json) : [];
const met = $('Métricas en redes').isExecuted ? $('Métricas en redes').all().map(i => i.json) : [];
const redes = env.map((p, i) => ({ video_id: p.video_id, canal_id: p.canal_id, tipo: p.tipo, titulo: p.titulo, plataformas: p.plataformas, dias: p.dias,
  metricas: met[i]?.error || JSON.stringify(met[i] || {}).length > 6000 ? null : met[i] }));
const porCanal = {};
for (const v of vids) (porCanal[v.canal_id] ||= { videos: [], redes: [] }).videos.push(v);
for (const r of redes) (porCanal[r.canal_id] ||= { videos: [], redes: [] }).redes.push(r);
return Object.entries(porCanal).map(([canal_id, d]) => ({ json: { modo: 'aprender', canal_id, video_id: '', datos: { canal_id, videos: d.videos, redes: d.redes } } }));
""")
call(f, 'Claude: aprender', W['claude'], each=True)
f.chain('Cada día', 'Leer ajustes', '¿Analytics activo?')
f.link('¿Analytics activo?', 'Publicaciones', 0)
f.chain('Publicaciones', 'Toca medir en redes', '¿Hay en redes?')
f.link('¿Hay en redes?', 'Métricas en redes', 0)
f.link('¿Hay en redes?', 'Videos publicados', 1)
f.link('Métricas en redes', 'Videos publicados')
f.chain('Videos publicados', 'Toca medir', '¿Hay que medir?')
f.link('¿Hay que medir?', 'Pedir tokens', 0)
f.chain('Pedir tokens', 'Tokens de los canales', 'Pedidos de retención', '¿Algún canal conectado?')
f.link('¿Algún canal conectado?', 'Retención', 0)
f.link('¿Algún canal conectado?', 'Pedir lecciones', 1)
f.link('¿Hay que medir?', 'Pedir lecciones', 1)
code(f, 'Retención media', r"""
// Media de la curva (audienceWatchRatio por tramo) ≈ porcentaje medio visto. La usa el freno de calidad de la rutina.
const yt = $('Pedidos de retención').all().map(i => i.json);
return $input.all().map((i, k) => { const rows = i.json.rows || []; const v = yt[k] || {};
  const m = rows.length ? rows.reduce((a, r) => a + Math.min(1.5, Number(r[1]) || 0), 0) / rows.length : null;
  return { json: { video_id: v.video_id, retencion_media: m === null ? null : Math.round(Math.min(1, m) * 1000) / 1000 } }; })
  .filter(x => x.json.video_id && x.json.retencion_media !== null);
""")
dt_update(f, 'Guardar retención', 'videos', 'video_id', '={{ $json.video_id }}')
f.chain('Retención', 'Pedir lecciones', 'Claude: aprender')
f.chain('Retención', 'Retención media', 'Guardar retención')
APRENDE = f.dump()

# ======================================================================================
# F · Estado y reportes (lo consultan Telegram y el agente)
# ======================================================================================
f = Flow(W['estado'], 'F · Estado y reportes')
trigger(f)
f.add('Videos', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - Math.max(Number($('Inicio').first().json.dias) || 30, 30) * 86400000).toISOString() }}"}]}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)
f.add('Costos', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('costos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - Math.max(Number($('Inicio').first().json.dias) || 30, 30) * 86400000).toISOString() }}"}]}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)
iff(f, '¿Es reporte?', "$('Inicio').first().json.tipo === 'reporte'")
f.add('Conexiones', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('youtube'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'conectado'}]}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)
code(f, 'Pedir estadísticas', r"""
const p = $('Inicio').first().json;
const cs = $input.all().map(i => i.json).filter(c => c.canal_id && (!p.canal_id || c.canal_id === p.canal_id));
return cs.length ? cs.map(c => ({ json: { accion: 'estadisticas', canal_id: c.canal_id } })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay canales conectados?', '$json.nada !== true')
call(f, 'Estadísticas de YouTube', W['yt'], each=True)
code(f, 'Resumen', r"""
// «estado»: los 10 videos más recientes. «reporte»: por canal, cuánto se produjo, publicó y gastó.
const pedido = $('Inicio').first().json;
const videos = $('Videos').all().map(i => i.json).filter(v => v.video_id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
const costos = $('Costos').all().map(i => i.json).filter(c => c.video_id);
if (pedido.tipo !== 'reporte') {
  const ult = videos.slice(0, 10);
  return [{ json: { resumen: ult.length ? ult.map(v => `${v.video_id} · ${v.canal_id} · ${v.etapa} · ${v.estado} · US$${v.costo_usd || 0}`).join('\n') : 'Sin videos todavía.' } }];
}
const desde = pedido.dias ? Date.now() - Number(pedido.dias) * 86400000 : 0;
const vs = videos.filter(v => (!pedido.canal_id || v.canal_id === pedido.canal_id) && Date.parse(v.createdAt || 0) >= desde);
const porCanal = {};
for (const v of vs) { const c = (porCanal[v.canal_id] ||= { videos: 0, publicados: 0, gasto: 0, etapas: {} });
  c.videos++; if (v.estado === 'publicado') c.publicados++; c.etapas[v.etapa] = (c.etapas[v.etapa] || 0) + 1;
  c.gasto += costos.filter(x => x.video_id === v.video_id).reduce((a, x) => a + (x.usd || 0), 0); }
const yt = {}; if ($('Estadísticas de YouTube').isExecuted) for (const i of $('Estadísticas de YouTube').all()) if (i.json.ok) yt[i.json.canal_id] = i.json;
for (const id of Object.keys(yt)) porCanal[id] ||= { videos: 0, publicados: 0, gasto: 0, etapas: {} };
const lineas = Object.entries(porCanal).map(([id, c]) => (yt[id] ? `${id} (YouTube «${yt[id].canal_youtube}»: ${yt[id].ocultos ? 'suscriptores ocultos' : yt[id].suscriptores + ' suscriptores'}, ${yt[id].vistas} vistas, ${yt[id].videos} videos) — ` : `${id}: `) + `${c.videos} videos, ${c.publicados} publicados, US$${Math.round(c.gasto * 100) / 100} (prom. US$${c.videos ? Math.round(c.gasto / c.videos * 100) / 100 : 0}) · etapas: ${Object.entries(c.etapas).map(([k, n]) => k + ' ' + n).join(', ')}`);
return [{ json: { resumen: lineas.length ? `Reporte${pedido.dias ? ' de ' + pedido.dias + ' días' : ''}:\n` + lineas.join('\n') : 'Sin videos en ese periodo.' } }];
""")
f.chain('Inicio', 'Videos', 'Costos', '¿Es reporte?')
f.link('¿Es reporte?', 'Conexiones', 0)
f.link('¿Es reporte?', 'Resumen', 1)
f.chain('Conexiones', 'Pedir estadísticas', '¿Hay canales conectados?')
f.link('¿Hay canales conectados?', 'Estadísticas de YouTube', 0)
f.link('¿Hay canales conectados?', 'Resumen', 1)
f.link('Estadísticas de YouTube', 'Resumen')
ESTADO = f.dump()

# ======================================================================================
# M1 · Referencias del canal: imágenes de cada personaje y escenario que todos los planos reutilizan
# ======================================================================================
f = Flow(W['refs'], 'M1 · Referencias del canal')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
dt_get(f, 'Canal', 'canales', 'canal_id', "={{ $('Inicio').first().json.canal_id }}")
dt_get(f, 'Biblia', 'trabajos', 'job_id', "={{ String($('Canal').first().json.biblia_ruta).replace('trabajo:','') }}")
code(f, 'Pedidos principales', r"""
// Pasada 1: una imagen principal por personaje (frente) y por escenario (plano general), con el estilo del canal.
const aj = $('Leer ajustes').first().json; const b = (JSON.parse($json.resultado || '{}').resultado) || {};
const ev = b.estilo_visual || {};
const estilo = [ev.descripcion, ev.luz, ev.lente, ev.textura, (ev.paleta_hex || []).length ? 'paleta ' + ev.paleta_hex.join(' ') : ''].filter(Boolean).join('. ');
const personajes = (b.personajes || []).filter(p => p.id && !(p.referencias_urls || []).length);
const escenarios = (b.escenarios || []).filter(p => p.id && !(p.referencias_urls || []).length);
const pedidos = [
  ...personajes.map(p => ({ id: p.id, clase: 'personaje', vista: 'frente', prompt: `Retrato de referencia de ${p.nombre || p.id}: ${p.descripcion || ''}. De frente, plano medio, fondo neutro liso. Estilo: ${estilo}. Sin texto.` })),
  ...escenarios.map(p => ({ id: p.id, clase: 'escenario', vista: 'general', prompt: `Imagen de referencia del escenario ${p.nombre || p.id}: ${p.descripcion || ''}. Plano general, sin personas. Estilo: ${estilo}. Sin texto.` })),
].slice(0, 12);
const costo = Math.round((pedidos.length + personajes.length * 2) * aj.costoImagenUsd * 100) / 100;
if (!aj.allowReferencias || !pedidos.length) return [{ json: { nada: true, pendientes: pedidos.length, costo } }];
return pedidos.map(p => ({ json: { ...p, costo } }));
""")
iff(f, '¿Generar referencias?', '$json.nada !== true')


def cadena_ref(sufijo, nombre_expr):
    """Generar → extraer → subir → nombrar → compartir → URL, por ítem."""
    http(f, 'Generar ' + sufijo, 'POST', 'https://api.openai.com/v1/responses',
         body="={{ { model: $('Leer ajustes').first().json.modeloTexto, tools: [{ type: 'image_generation', model: $('Leer ajustes').first().json.modeloImagen, size: '1024x1024' }], tool_choice: { type: 'image_generation' }, input: [{ role: 'user', content: [{ type: 'input_text', text: $json.prompt }, ...($json.referencia ? [{ type: 'input_image', image_url: $json.referencia }] : [])] }] } }}",
         timeout=180000, cred=CRED_OPENAI)
    f.nodes[-1].update({'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 5000})
    code1(f, 'Extraer ' + sufijo, r"""
const out = ($json.output || []).find(o => o.type === 'image_generation_call');
const p = $('PEDIDOS').item.json;
if (!out?.result) throw new Error('Sin imagen de referencia para ' + p.id);
return { json: p, binary: { imagen: { data: out.result, mimeType: 'image/png', fileName: p.id + '-' + p.vista + '.png' } } };
""".replace('PEDIDOS', 'Pedidos principales' if sufijo == 'principal' else 'Pedidos de vistas'))
    gapi(f, 'Subir ' + sufijo, 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api',
         binary_field='imagen', query={'uploadType': 'media'})
    gapi(f, 'Nombrar ' + sufijo, 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
         json_body="={{ { name: 'ref-' + $('Inicio').first().json.canal_id + '-' + $('Extraer " + sufijo + "').item.json.id + '-' + $('Extraer " + sufijo + "').item.json.vista + '.png' } }}",
         query={'addParents': "={{ $('Leer ajustes').first().json.driveCarpetaRaizId }}", 'removeParents': 'root'}, timeout=30000)
    gapi(f, 'Compartir ' + sufijo, 'POST', "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Subir " + sufijo + "').item.json.id + '/permissions' }}",
         'googleDriveOAuth2Api', json_body='={{ { role: "reader", type: "anyone" } }}', timeout=30000)
    code1(f, 'URL ' + sufijo, "const p = $('Extraer " + sufijo + "').item.json; return { json: { id: p.id, clase: p.clase, vista: p.vista, url: 'https://drive.google.com/uc?export=download&id=' + $('Subir " + sufijo + "').item.json.id } };")
    f.add('Juntar ' + sufijo, 'n8n-nodes-base.aggregate', 1, {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'refs', 'options': {}})


cadena_ref('principal', None)
code(f, 'Pedidos de vistas', r"""
// Pasada 2: perfil y cuerpo entero de cada personaje, usando su imagen principal como referencia (misma cara y vestuario).
const principales = $('Juntar principal').first().json.refs.filter(r => r.clase === 'personaje');
const pedidos = principales.flatMap(r => [
  { id: r.id, clase: 'personaje', vista: 'perfil', referencia: r.url, prompt: 'El mismo personaje de la imagen de referencia, idéntico rostro, peinado y vestuario, de perfil, plano medio, fondo neutro liso. Sin texto.' },
  { id: r.id, clase: 'personaje', vista: 'cuerpo entero', referencia: r.url, prompt: 'El mismo personaje de la imagen de referencia, idéntico rostro, peinado y vestuario, de cuerpo entero, de pie, fondo neutro liso. Sin texto.' },
]);
return pedidos.length ? pedidos.map(p => ({ json: p })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay vistas?', '$json.nada !== true')
cadena_ref('vista', None)
code(f, 'Biblia con referencias', r"""
// Las URL se guardan en la biblia (personajes[].referencias_urls, escenarios[].referencias_urls); producción ya las usa.
const fila = $('Biblia').first().json; const env = JSON.parse(fila.resultado || '{}'); const b = env.resultado || {};
const refs = [...$('Juntar principal').first().json.refs, ...($('Juntar vista').isExecuted ? $('Juntar vista').first().json.refs : [])];
for (const lista of [b.personajes || [], b.escenarios || []]) for (const x of lista) {
  const urls = refs.filter(r => r.id === x.id).map(r => r.url); if (urls.length) x.referencias_urls = [...(x.referencias_urls || []), ...urls]; }
env.resultado = b;
return [{ json: { resultado: JSON.stringify(env), total: refs.length } }];
""")
dt_update(f, 'Guardar biblia', 'trabajos', 'job_id', "={{ $('Biblia').first().json.job_id }}")
code(f, 'Costo de referencias', "const aj = $('Leer ajustes').first().json; return [{ json: { video_id: 'canal:' + $('Inicio').first().json.canal_id, concepto: 'referencias del canal', servicio: 'OpenAI', usd: Math.round($('Biblia con referencias').first().json.total * aj.costoImagenUsd * 1000) / 1000 } }];")
dt_insert(f, 'Guardar costo de referencias', 'costos')
tg(f, 'Aviso: referencias listas', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ 'Referencias del canal ' + $('Inicio').first().json.canal_id + ' listas: ' + $('Biblia con referencias').first().json.total + ' imágenes. Desde ahora cada plano las usa para mantener caras, vestuario y estilo.' }}")
tg(f, 'Aviso: referencias pendientes', "={{ $('Leer ajustes').first().json.chatId }}",
   "={{ $json.pendientes ? 'El canal ' + $('Inicio').first().json.canal_id + ' tiene ' + $json.pendientes + ' personajes o escenarios sin imágenes de referencia (~US$' + $json.costo + '). Enciende allowReferencias en Ajustes y escribe: referencias ' + $('Inicio').first().json.canal_id : 'El canal ' + $('Inicio').first().json.canal_id + ' ya tiene todas sus referencias.' }}")
f.chain('Inicio', 'Leer ajustes', 'Canal', 'Biblia', 'Pedidos principales', '¿Generar referencias?')
f.link('¿Generar referencias?', 'Generar principal', 0)
f.link('¿Generar referencias?', 'Aviso: referencias pendientes', 1)
f.chain('Generar principal', 'Extraer principal', 'Subir principal', 'Nombrar principal', 'Compartir principal', 'URL principal', 'Juntar principal', 'Pedidos de vistas', '¿Hay vistas?')
f.link('¿Hay vistas?', 'Generar vista', 0)
f.link('¿Hay vistas?', 'Biblia con referencias', 1)
f.chain('Generar vista', 'Extraer vista', 'Subir vista', 'Nombrar vista', 'Compartir vista', 'URL vista', 'Juntar vista', 'Biblia con referencias')
f.chain('Biblia con referencias', 'Guardar biblia', 'Aviso: referencias listas')
f.chain('Biblia con referencias', 'Costo de referencias', 'Guardar costo de referencias')
REFS = f.dump()

# ======================================================================================
# F · Agente de Telegram: lo que escribes libremente en el chat, con herramientas cerradas
# ======================================================================================
f = Flow(W['agente'], 'F · Agente de Telegram')
trigger(f)
f.add('Agente', '@n8n/n8n-nodes-langchain.agent', 3.1,
      {'promptType': 'define', 'text': '={{ $json.texto }}',
       'options': {'systemMessage': (
           "={{ 'Hoy es ' + $now.setZone('America/Lima').setLocale('es').toFormat(\"cccc d 'de' LLLL 'de' yyyy, HH:mm\") + ' (hora de Lima, UTC-5). ' }}"
           'Eres el operador de una fábrica de videos de YouTube. Respondes en español, en una o dos frases. '
           'Solo actúas con tus herramientas; si algo no se puede hacer con ellas, lo dices. '
           'Herramientas: crear_canal, crear_video, estado, reporte, corregir, ajustar_biblia, programar, referencias, conectar_youtube, configurar_redes, pendientes, reenviar, metas, adoptar_cuenta, tendencias. '
           'Si el operador pide un video «de la idea N» o de una tendencia, primero usa tendencias (ver) y luego crear_video con ese tema y su gancho en indicaciones. '
           'Si el operador da una cuenta existente (enlace o @usuario) para que la fábrica la lleve, usa adoptar_cuenta. Si habla de metas, ritmo o de que la fábrica trabaje sola, usa metas. '
           'Si el operador dice que no le llegó una aprobación o que un enlace no abre, usa reenviar (nunca reintentes ejecuciones). '
           'Si el operador pide un video sin tema o que la fábrica elija el tema, usa crear_video con tema vacío: la fábrica investiga el nicho y elige. '
           'Si preguntan qué falta aprobar o qué está pendiente, usa pendientes y devuelve la lista con sus enlaces tal cual (el operador decide en ese enlace). '
           'Para conectar un canal a YouTube usa conectar_youtube y devuelve el enlace tal cual. '
           'Nunca publicas ni gastas: la fábrica pide aprobación con un enlace «Revisar y decidir» (en Telegram y en pendientes). Si falta un dato (canal, video, tema, fecha), pregunta solo eso. '
           'Para «programar», convierte la fecha que diga el operador a ISO 8601 con zona America/Lima (UTC-5) y confírmala en tu respuesta.')}})
# gpt-6-astra solo acepta herramientas por la API Responses (por chat/completions responde 400): nodo 1.3 con Responses activado
f.add('Modelo', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 1.3,
      {'model': {'__rl': True, 'mode': 'id', 'value': 'gpt-6-astra'}, 'responsesApiEnabled': True, 'options': {}}, credentials=CRED_OPENAI_CHAT)
f.add('Memoria', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3,
      {'sessionIdType': 'customKey', 'sessionKey': "={{ 'fabrica-' + $('Inicio').first().json.chatId }}", 'contextWindowLength': 20})


def tool(name, desc, values, wid=None):
    return f.add(name, '@n8n/n8n-nodes-langchain.toolWorkflow', 2.2,
                 {'description': desc, 'workflowId': {'__rl': True, 'mode': 'id', 'value': wid or W['orq']},
                  # Sin esquema, n8n trata la herramienta como de un solo texto («query») y el sub-flujo no recibe evento, canal ni tema.
                  'workflowInputs': {'mappingMode': 'defineBelow', 'value': values, 'matchingColumns': [],
                                     'schema': [{'id': k, 'displayName': k, 'required': False, 'defaultMatch': False, 'display': True,
                                                 'canBeUsedToMatch': True, 'type': 'string', 'removed': False} for k in values],
                                     'attemptToConvertTypes': False, 'convertFieldsToString': False}})


AI = lambda k, d, t='string': "={{ $fromAI('" + k + "', '" + d + "', '" + t + "') }}"
tool('crear_canal', 'Investiga nichos y propone un canal nuevo para aprobar.', {'evento': 'nuevo_canal', 'criterios': AI('criterios', 'preferencias del operador; puede ir vacío')})
tool('crear_video', 'Crea un video en un canal activo: escribe el guion y lo manda a aprobar.',
     {'evento': 'nuevo_video', 'canal_id': AI('canal_id', 'id del canal'), 'tema': AI('tema', 'tema del video, corto; VACÍO si el operador no da tema o pide que la fábrica lo elija'), 'formato': AI('formato', 'largo o short'),
      'indicaciones': AI('indicaciones', 'todo lo demás que pidió el operador para este video, con sus palabras: gancho, tono, emoción, estructura, competencia, cierre; vacío si no pidió nada')})
tool('estado', 'Muestra los últimos videos con su etapa, estado y costo.', {'tipo': 'estado'}, W['estado'])
tool('reporte', 'Resume por canal lo producido, publicado y gastado en un periodo.',
     {'tipo': 'reporte', 'canal_id': AI('canal_id', 'id del canal o vacío para todos'), 'dias': AI('dias', 'número de días hacia atrás, p. ej. 30')}, W['estado'])
tool('corregir', 'Rehace el guion o el storyboard de un video con una instrucción del operador.',
     {'evento': 'corregir', 'video_id': AI('video_id', 'id del video'), 'etapa': AI('etapa', 'guion o storyboard'), 'instruccion': AI('instruccion', 'qué cambiar')})
tool('ajustar_biblia', 'Cambia un campo de la biblia de un canal (voz, estilo, montaje…) para los videos siguientes.',
     {'evento': 'ajustar_biblia', 'canal_id': AI('canal_id', 'id del canal'), 'campo': AI('campo', 'ruta del campo, p. ej. voz.descripcion o montaje.musica_volumen'), 'valor': AI('valor', 'valor nuevo')})
tool('programar', 'Fija fecha y hora de publicación de un video ya aprobado.',
     {'evento': 'programar', 'video_id': AI('video_id', 'id del video'), 'fecha': AI('fecha', 'fecha y hora ISO 8601 con zona, p. ej. 2026-11-27T18:00:00-05:00')})
tool('referencias', 'Genera las imágenes de referencia de personajes y escenarios de un canal.',
     {'evento': 'referencias', 'canal_id': AI('canal_id', 'id del canal')})
tool('configurar_redes', 'Fija dónde publica un canal: su perfil de Upload-Post y la lista de redes (youtube, tiktok, instagram, facebook).',
     {'evento': 'configurar_redes', 'canal_id': AI('canal_id', 'id del canal'), 'perfil': AI('perfil', 'nombre del perfil en Upload-Post'), 'redes': AI('redes', 'lista separada por comas: youtube, tiktok, instagram, facebook'),
      'zona': AI('zona', 'zona horaria IANA del público del canal, p. ej. America/Lima o America/Mexico_City; vacío = la de Ajustes')})
tool('conectar_youtube', 'Da el enlace para conectar un canal de la fábrica a su canal de YouTube (una vez por canal). Devuelve el enlace tal cual al operador.',
     {'accion': 'enlace', 'canal_id': AI('canal_id', 'id del canal de la fábrica')}, W['yt'])
tool('pendientes', 'Lista lo que espera la decisión del operador (canal, guion, storyboard, video final, permiso de gasto) con el enlace para decidir. Devuelve los enlaces tal cual.',
     {'tipo': 'pendientes'}, W['pendientes'])
tool('metas', 'Fija las metas semanales de un canal y si la fábrica produce sola hacia ellas (videos por semana, formato, tope de gasto semanal, retención mínima, auto).',
     {'evento': 'metas', 'canal_id': AI('canal_id', 'id del canal'), 'videos_semana': AI('videos_semana', 'videos por semana (0–21); vacío si no cambia'),
      'formato': AI('formato', 'short o largo; vacío si no cambia'), 'gasto_semana_usd': AI('gasto_semana_usd', 'tope de gasto semanal en dólares; vacío si no cambia'),
      'retencion_min': AI('retencion_min', 'retención media mínima de 0 a 1 (0.6 = 60 %); vacío si no cambia'),
      'auto': AI('auto', 'true para que la fábrica produzca sola hacia la meta, false para apagarlo; vacío si no cambia')})
tool('adoptar_cuenta', 'Adopta una cuenta existente de YouTube, TikTok o Instagram: la analiza con su competencia y propone canal, biblia, metas y plan para aprobar.',
     {'evento': 'adoptar_cuenta', 'url': AI('url', 'enlace de la cuenta o @usuario'), 'red': AI('red', 'youtube, tiktok o instagram si el operador lo dice; vacío si viene en el enlace'),
      'notas': AI('notas', 'lo que pidió el operador sobre la cuenta; vacío si nada')})
tool('tendencias', 'Muestra el radar de tendencias de los canales (ideas por red, formatos y sonidos de esta semana), o lo corre de nuevo. Úsalo antes de crear un video «de la idea N».',
     {'accion': AI('accion', 'ver (por defecto) o correr si el operador pide actualizar el radar ahora'), 'canal_id': AI('canal_id', 'id del canal; vacío para todos')}, W['radar'])
tool('reenviar', 'Vuelve a mandar las aprobaciones pendientes (todas o las de un video). Si un enlace ya no funciona, rehace esa aprobación con un enlace nuevo. Devuelve el resultado tal cual.',
     {'video_id': AI('video_id', 'id del video o vacío para todas')}, W['reenviar'])
code(f, 'Respuesta', "return [{ json: { respuesta: String($json.output || 'Listo.').slice(0, 3900) } }];")
f.chain('Inicio', 'Agente', 'Respuesta')
f.ai('Modelo', 'Agente', 'ai_languageModel')
f.ai('Memoria', 'Agente', 'ai_memory')
for t in ('crear_canal', 'crear_video', 'estado', 'reporte', 'corregir', 'ajustar_biblia', 'programar', 'referencias', 'conectar_youtube', 'configurar_redes', 'pendientes', 'reenviar', 'metas', 'adoptar_cuenta', 'tendencias'):
    f.ai(t, 'Agente', 'ai_tool')
AGENTE = f.dump()

# ======================================================================================
# FX · YouTube por canal: cada canal de la fábrica se conecta a su propio canal de YouTube.
#   - accion 'enlace': arma el enlace de Google para conectar (lo pide «conectar <canal>» en Telegram).
#   - accion 'token': da un token de acceso del canal (subir, medir).
#   - accion 'estadisticas': suscriptores, vistas y videos del canal (reporte).
#   - webhook /webhook/youtube-callback: Google vuelve aquí; se guarda el permiso del canal.
# El permiso (refresh token) vive en la tabla «youtube»; el cliente OAuth, en la credencial «Google cliente».
# ======================================================================================
f = Flow(W['yt'], 'FX · YouTube por canal')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
switch(f, 'Según acción', 3, "({ enlace: 0, token: 1, estadisticas: 1 })[$('Inicio').first().json.accion] ?? 1")
# --- enlace ---
dt_get(f, 'Conexión (enlace)', 'youtube', 'canal_id', "={{ String($('Inicio').first().json.canal_id || '').toLowerCase() }}")
code(f, 'Preparar enlace', r"""
const e = $('Inicio').first().json; const aj = $('Leer ajustes').first().json;
const canal_id = String(e.canal_id || '').toLowerCase().trim();
if (!/^[a-z0-9-]{3,60}$/.test(canal_id)) return [{ json: { valido: false, respuesta: 'Formato: conectar <id-del-canal>' } }];
const bytes = new Uint8Array(16);
if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes); else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
const nonce = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const params = { client_id: aj.googleClientId, redirect_uri: aj.baseUrl + '/webhook/youtube-callback', response_type: 'code',
  access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'false', state: canal_id + '.' + nonce,
  scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'].join(' ') };
// El entorno de Code de n8n no trae URLSearchParams: se codifica a mano.
const q = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
return [{ json: { valido: true, existe: !!$json.canal_id, canal_id, nonce, estado: 'pendiente',
  url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q } }];
""")
iff(f, '¿Canal válido?', '$json.valido === true')
iff(f, '¿Ya existe?', '$json.existe === true')
code(f, 'Fila pendiente', "return [{ json: { canal_id: $json.canal_id, nonce: $json.nonce, estado: 'pendiente' } }];")
dt_update(f, 'Guardar pendiente', 'youtube', 'canal_id', "={{ $('Preparar enlace').first().json.canal_id }}")
code(f, 'Fila nueva', "return [{ json: { canal_id: $json.canal_id, nonce: $json.nonce, estado: 'pendiente' } }];")
dt_insert(f, 'Crear pendiente', 'youtube')
code(f, 'Respuesta enlace', r"""
const p = $('Preparar enlace').first().json;
return [{ json: { ok: true, respuesta: `Para conectar «${p.canal_id}» a YouTube abre este enlace, elige el canal (o su cuenta de marca) y acepta:\n${p.url}\n\nEl enlace sirve una vez. Te aviso aquí cuando quede conectado.` } }];
""")
code(f, 'Respuesta inválida', "return [{ json: { ok: false, respuesta: $json.respuesta } }];")
f.link('Inicio', 'Leer ajustes')
f.link('Leer ajustes', 'Según acción')
f.link('Según acción', 'Conexión (enlace)', 0)
f.chain('Conexión (enlace)', 'Preparar enlace', '¿Canal válido?')
f.link('¿Canal válido?', '¿Ya existe?', 0)
f.link('¿Canal válido?', 'Respuesta inválida', 1)
f.link('¿Ya existe?', 'Fila pendiente', 0)
f.link('¿Ya existe?', 'Fila nueva', 1)
f.chain('Fila pendiente', 'Guardar pendiente', 'Respuesta enlace')
f.chain('Fila nueva', 'Crear pendiente', 'Respuesta enlace')

# --- token / estadísticas ---
dt_get(f, 'Conexión', 'youtube', 'canal_id', "={{ String($('Inicio').first().json.canal_id || '').toLowerCase() }}")
iff(f, '¿Conectado?', "$json.estado === 'conectado' && !!$json.refresh_token")
http(f, 'Renovar token', 'POST', 'https://oauth2.googleapis.com/token', auth=False, timeout=30000,
     body="={{ { grant_type: 'refresh_token', refresh_token: $json.refresh_token } }}")
f.nodes[-1]['parameters'].update({'authentication': 'genericCredentialType', 'genericAuthType': 'httpCustomAuth'})
f.nodes[-1].update({'credentials': CRED_GOOGLE_CLIENTE, 'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 2000})
code(f, 'Token', r"""
const r = $json; const c = $('Conexión').first().json;
if (!r.access_token) return [{ json: { ok: false, error: 'Google no renovó el permiso de «' + c.canal_id + '»' + (r.error ? ' (' + JSON.stringify(r.error).slice(0, 120) + ')' : '') + '. Vuelve a conectarlo: conectar ' + c.canal_id } }];
return [{ json: { ok: true, access_token: r.access_token, canal_id: c.canal_id, canal_youtube: c.canal_youtube, canal_youtube_id: c.canal_youtube_id } }];
""")
code(f, 'Sin conexión', "const id = $('Inicio').first().json.canal_id; return [{ json: { ok: false, error: `El canal «${id}» no está conectado a YouTube. Escribe en Telegram: conectar ${id}` } }];")
iff(f, '¿Pide estadísticas?', "$('Inicio').first().json.accion === 'estadisticas' && $json.ok === true")
http(f, 'Canal en YouTube', 'GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', auth=False, timeout=30000,
     headers={'Authorization': "={{ 'Bearer ' + $json.access_token }}"})
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Estadísticas', r"""
const t = $('Token').first().json; const it = ($json.items || [])[0];
if (!it) return [{ json: { ok: false, canal_id: t.canal_id, error: 'YouTube no devolvió el canal' } }];
const s = it.statistics || {};
return [{ json: { ok: true, canal_id: t.canal_id, canal_youtube: it.snippet?.title || t.canal_youtube,
  suscriptores: Number(s.subscriberCount || 0), vistas: Number(s.viewCount || 0), videos: Number(s.videoCount || 0), ocultos: !!s.hiddenSubscriberCount } }];
""")
f.link('Según acción', 'Conexión', 1)
f.link('Conexión', '¿Conectado?')
f.link('¿Conectado?', 'Renovar token', 0)
f.link('¿Conectado?', 'Sin conexión', 1)
f.chain('Renovar token', 'Token', '¿Pide estadísticas?')
code(f, 'Devolver token', 'return [{ json: $json }];')
f.link('¿Pide estadísticas?', 'Canal en YouTube', 0)
f.link('¿Pide estadísticas?', 'Devolver token', 1)
f.link('Canal en YouTube', 'Estadísticas')

# --- vuelta de Google ---
f.add('Vuelta de Google', 'n8n-nodes-base.webhook', 2,
      {'httpMethod': 'GET', 'path': 'youtube-callback', 'responseMode': 'responseNode', 'options': {}},
      webhookId='fab-youtube-callback')
call(f, 'Ajustes (vuelta)', W['ajustes'])
code(f, 'Leer vuelta', r"""
const q = $('Vuelta de Google').first().json.query || {};
const [canal_id, nonce] = String(q.state || '').split('.');
return [{ json: { canal_id: String(canal_id || '').toLowerCase(), nonce: nonce || '', code: q.code || '', error: q.error || '' } }];
""")
dt_get(f, 'Conexión pendiente', 'youtube', 'canal_id', "={{ $('Leer vuelta').first().json.canal_id || '-' }}")
code(f, 'Validar vuelta', r"""
const v = $('Leer vuelta').first().json; const fila = $json;
const motivo = v.error ? 'Google respondió: ' + v.error
  : !fila.canal_id ? 'no reconozco el canal'
  : fila.estado !== 'pendiente' || !fila.nonce || fila.nonce !== v.nonce ? 'el enlace ya se usó o caducó; pide otro con «conectar ' + v.canal_id + '»'
  : !v.code ? 'falta el código de Google' : '';
return [{ json: { ok: !motivo, motivo, canal_id: v.canal_id, code: v.code } }];
""")
iff(f, '¿Vuelta válida?', '$json.ok === true')
http(f, 'Canjear código', 'POST', 'https://oauth2.googleapis.com/token', auth=False, timeout=30000,
     body="={{ { grant_type: 'authorization_code', code: $json.code, redirect_uri: $('Ajustes (vuelta)').first().json.baseUrl + '/webhook/youtube-callback' } }}")
f.nodes[-1]['parameters'].update({'authentication': 'genericCredentialType', 'genericAuthType': 'httpCustomAuth'})
f.nodes[-1].update({'credentials': CRED_GOOGLE_CLIENTE, 'onError': 'continueRegularOutput'})
http(f, 'Qué canal es', 'GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', auth=False, timeout=30000,
     headers={'Authorization': "={{ 'Bearer ' + ($json.access_token || '-') }}"})
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Fila conectada', r"""
const t = $('Canjear código').first().json; const it = ($json.items || [])[0];
if (!t.refresh_token || !it) return [{ json: { ok: false, motivo: !t.refresh_token ? 'Google no entregó un permiso duradero (' + JSON.stringify(t.error || 'sin refresh_token').slice(0, 120) + ')' : 'esa cuenta no tiene canal de YouTube' } }];
return [{ json: { ok: true, estado: 'conectado', nonce: '', refresh_token: t.refresh_token, canal_youtube: it.snippet?.title || '', canal_youtube_id: it.id, conectado_en: new Date().toISOString() } }];
""")
iff(f, '¿Conexión lista?', '$json.ok === true')
code(f, 'Datos de conexión', "const { ok, ...fila } = $json; return [{ json: fila }];")
dt_update(f, 'Guardar conexión', 'youtube', 'canal_id', "={{ $('Leer vuelta').first().json.canal_id }}")
tg(f, 'Aviso: conectado', "={{ $('Ajustes (vuelta)').first().json.chatId }}",
   "={{ 'Canal «' + $('Leer vuelta').first().json.canal_id + '» conectado a YouTube: ' + $('Fila conectada').first().json.canal_youtube + '. Desde ahora sus videos se suben y miden ahí.' }}")
f.add('Página: listo', 'n8n-nodes-base.respondToWebhook', 1.1,
      {'respondWith': 'text', 'responseBody': "={{ '<!doctype html><meta charset=utf-8><body style=\"font-family:sans-serif;padding:40px\"><h2>Listo</h2><p>«' + $('Leer vuelta').first().json.canal_id + '» quedó conectado a ' + $('Fila conectada').first().json.canal_youtube + '. Ya puedes cerrar esta ventana.</p>' }}",
       'options': {'responseCode': 200, 'responseHeaders': {'entries': [{'name': 'Content-Type', 'value': 'text/html; charset=utf-8'}]}}})
code(f, 'Motivo del fallo', "return [{ json: { motivo: $json.motivo || 'error desconocido' } }];")
tg(f, 'Aviso: no conectado', "={{ $('Ajustes (vuelta)').first().json.chatId }}", "={{ 'No pude conectar YouTube: ' + $json.motivo }}")
f.add('Página: error', 'n8n-nodes-base.respondToWebhook', 1.1,
      {'respondWith': 'text', 'responseBody': "={{ '<!doctype html><meta charset=utf-8><body style=\"font-family:sans-serif;padding:40px\"><h2>No se conectó</h2><p>' + $('Motivo del fallo').first().json.motivo + '</p>' }}",
       'options': {'responseCode': 400, 'responseHeaders': {'entries': [{'name': 'Content-Type', 'value': 'text/html; charset=utf-8'}]}}})
f.chain('Vuelta de Google', 'Ajustes (vuelta)', 'Leer vuelta', 'Conexión pendiente', 'Validar vuelta', '¿Vuelta válida?')
f.link('¿Vuelta válida?', 'Canjear código', 0)
f.link('¿Vuelta válida?', 'Motivo del fallo', 1)
f.chain('Canjear código', 'Qué canal es', 'Fila conectada', '¿Conexión lista?')
f.link('¿Conexión lista?', 'Datos de conexión', 0)
f.link('¿Conexión lista?', 'Motivo del fallo', 1)
f.chain('Datos de conexión', 'Guardar conexión', 'Aviso: conectado', 'Página: listo')
f.chain('Motivo del fallo', 'Aviso: no conectado', 'Página: error')
YT = f.dump()

# ======================================================================================
# FX · vidIQ: investigación de YouTube y puntaje de títulos con la API de vidIQ (servidor MCP, clave de API).
#   accion 'investigar' {tema, formato}: palabras clave relacionadas y videos que destacan del tema.
#   accion 'titulos' {titulos[], formato}: puntaje 0–100 de cada título; devuelve el mejor.
# Cada llamada gasta 5 créditos de tu plan de vidIQ. Si vidIQ falla, devuelve ok:false y la fábrica sigue sin él.
# ======================================================================================
f = Flow(W['vidiq'], 'FX · vidIQ')
trigger(f)
H_VQ = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
def vq(nombre, cuerpo, sesion=True):
    hd = dict(H_VQ)
    if sesion:
        hd['mcp-session-id'] = "={{ $('Iniciar vidIQ').first().json.headers['mcp-session-id'] || '' }}"
    n = http(f, nombre, 'POST', 'https://mcp.vidiq.com/mcp', body=cuerpo, cred=CRED_VIDIQ, headers=hd, timeout=90000)
    f.nodes[-1]['parameters']['options']['response'] = {'response': {'fullResponse': True, 'responseFormat': 'text'}}
    f.nodes[-1].update({'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000, 'onError': 'continueRegularOutput'})
    return n
vq('Iniciar vidIQ', '={"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"fabrica-n8n","version":"1"}}}', sesion=False)
vq('vidIQ listo', '={"jsonrpc":"2.0","method":"notifications/initialized","params":{}}')
VQ_LEER = r"""
// Lee una respuesta de MCP (JSON o SSE) y devuelve el texto de la herramienta (o lanza el error de vidIQ).
const leer = r => { const t = String(r?.data ?? r?.body ?? '');
  const d = t.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()); const raw = d.length ? d[d.length - 1] : t;
  let m; try { m = JSON.parse(raw); } catch (e) { return { ok: false, error: 'respuesta ilegible de vidIQ' }; }
  if (m.error) return { ok: false, error: String(m.error.message || m.error).slice(0, 200) };
  const txt = (m.result?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (m.result?.isError) return { ok: false, error: txt.slice(0, 200) };
  return { ok: true, texto: txt }; };
"""
switch(f, 'Según acción', 3, "({ titulos: 1, cuenta: 2, radar: 2 })[$('Inicio').first().json.accion] ?? 0")
# investigar
vq('Palabras clave', "={{ JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'vidiq_keyword_research', arguments: { mode: 'research', keyword: String($('Inicio').first().json.semilla || $('Inicio').first().json.tema || '').slice(0, 150), limit: 15, userGoal: 'elegir el ángulo y las palabras clave de un video nuevo para un canal en español' } } }) }}")
vq('Videos que destacan', "={{ JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'vidiq_outliers', arguments: { keyword: String($('Inicio').first().json.tema || '').slice(0, 500), language: $('Inicio').first().json.idioma || 'es', contentType: $('Inicio').first().json.formato === 'short' ? 'short' : 'long', limit: 10, userGoal: 'ver qué videos del tema superan a su canal para inspirar el gancho y el título' } } }) }}")
code(f, 'Resumen de investigación', VQ_LEER + r"""
const kw = leer($('Palabras clave').first().json); const ov = leer($json);
if (!kw.ok && !ov.ok) return [{ json: { ok: false, error: kw.error || ov.error } }];
// Se pasa a Claude como contexto recortado: el texto ya viene resumido por vidIQ.
return [{ json: { ok: true, palabras_clave: kw.ok ? kw.texto.slice(0, 6000) : '', videos_destacados: ov.ok ? ov.texto.slice(0, 6000) : '',
  creditos: (kw.ok ? 5 : 0) + (ov.ok ? 5 : 0) } }];
""")
# títulos
code(f, 'Un ítem por título', r"""
const e = $('Inicio').first().json;
const t = (e.titulos || []).map(x => String(x || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
return t.length ? t.map(titulo => ({ json: { titulo: titulo.slice(0, 200), tipo: e.formato === 'short' ? 'short' : 'long' } })) : [{ json: { vacio: true } }];
""")
iff(f, '¿Hay títulos?', '$json.vacio !== true')
vq('Puntuar título', "={{ JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'vidiq_score_title', arguments: { title: $json.titulo, type: $json.tipo } } }) }}")
code(f, 'Mejor título', VQ_LEER + r"""
const titulos = $('Un ítem por título').all().map(i => i.json.titulo);
const notas = $input.all().map((i, k) => { const r = leer(i.json); const n = r.ok ? Number((r.texto.match(/(\d{1,3})\s*(?:\/\s*100|puntos|points|score)/i) || r.texto.match(/score[^0-9]{0,15}(\d{1,3})/i) || [])[1]) : NaN;
  return { titulo: titulos[k], puntaje: Number.isFinite(n) && n <= 100 ? n : null, error: r.ok ? '' : r.error }; });
const validas = notas.filter(n => n.puntaje !== null).sort((a, b) => b.puntaje - a.puntaje);
return [{ json: { ok: validas.length > 0, mejor: validas[0]?.titulo || titulos[0], puntaje: validas[0]?.puntaje ?? null, notas, creditos: notas.filter(n => !n.error).length * 5 } }];
""")
code(f, 'Sin títulos', "return [{ json: { ok: false, error: 'no hay títulos que puntuar' } }];")
# cuenta: perfil y últimas publicaciones de una cuenta (YouTube, TikTok o Instagram) para adoptarla
code(f, 'Llamadas de cuenta', r"""
const e = $('Inicio').first().json; const h = String(e.handle || '');
// Radar: lo que destaca esta semana en Reels y TikTok del nicho, los Shorts en español que despegan y los sonidos en alza.
if (e.accion === 'radar') { const q = String(e.nicho || '').slice(0, 450); const desde = new Date(Date.now() - 10 * 86400000);
  const R = [['vidiq_instagram_tiktok_outlier_search', { query: q, audienceQuery: 'Culture/Region: ' + (e.region || 'Perú y Latinoamérica hispanohablante') + '; Global: false; Demographics: ' + String(e.publico || 'adultos 18-45 de habla hispana').slice(0, 200) + ';',
      descriptionLanguage: ['es'], datePostedAfter: desde.toISOString(), resultsPerPlatform: 5 }],
    ['vidiq_outliers', { keyword: q.slice(0, 200), contentType: 'short', language: 'es', publishedWithin: 'thisMonth', limit: 8 }],
    ['vidiq_tiktok_trending_sound_search', { query: q.slice(0, 200), limit: 8 }]];
  return R.map(([nombre, args], i) => ({ json: { nombre, args: { ...args, userGoal: 'detectar tendencias y formatos que funcionan para un canal propio' }, id: 20 + i } })); }
const L = { youtube: [['vidiq_channel_stats', { channelId: h }], ['vidiq_channel_videos', { channelId: h, videoFormat: 'short' }], ['vidiq_channel_videos', { channelId: h, videoFormat: 'long', popular: true }]],
  tiktok: [['vidiq_tiktok_profile', { handle: h }], ['vidiq_tiktok_profile_videos', { handle: h }]],
  instagram: [['vidiq_ig_profile', { handle: h }], ['vidiq_ig_profile_reels', { handle: h }]] }[e.red] || [];
return L.map(([nombre, args], i) => ({ json: { nombre, args: { ...args, userGoal: 'analizar una cuenta propia para mejorar su contenido y su ritmo de publicación' }, id: 10 + i } }));
""")
vq('Consultar cuenta', "={{ JSON.stringify({ jsonrpc: '2.0', id: $json.id, method: 'tools/call', params: { name: $json.nombre, arguments: $json.args } }) }}")
code(f, 'Resumen de cuenta', VQ_LEER + r"""
const r = $input.all().map(i => leer(i.json));
if (!r.some(x => x.ok)) return [{ json: { ok: false, error: r.map(x => x.error).filter(Boolean)[0] || 'vidIQ no respondió' } }];
return [{ json: { ok: true, perfil: r[0]?.ok ? r[0].texto.slice(0, 4000) : '', publicaciones: r.slice(1).filter(x => x.ok).map(x => x.texto).join('\n\n').slice(0, 9000),
  textos: r.map(x => x.ok ? x.texto.slice(0, 9000) : ''), creditos: r.filter(x => x.ok).length * 5 } }];
""")
f.chain('Inicio', 'Iniciar vidIQ', 'vidIQ listo', 'Según acción')
f.link('Según acción', 'Palabras clave', 0)
f.chain('Palabras clave', 'Videos que destacan', 'Resumen de investigación')
f.link('Según acción', 'Un ítem por título', 1)
f.link('Un ítem por título', '¿Hay títulos?')
f.link('¿Hay títulos?', 'Puntuar título', 0)
f.link('¿Hay títulos?', 'Sin títulos', 1)
f.link('Puntuar título', 'Mejor título')
f.link('Según acción', 'Llamadas de cuenta', 2)
f.chain('Llamadas de cuenta', 'Consultar cuenta', 'Resumen de cuenta')
VIDIQ = f.dump()

# ======================================================================================
# M6 · Derivados: cortes verticales (TikTok, Reels, Shorts) de cada video largo y la miniatura.
# Los cortes reutilizan los mismos planos, voces y música del video (solo cuesta el render en Creatomate).
# ======================================================================================
f = Flow(W['deriv'], 'M6 · Derivados (cortes y miniatura)')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
iff(f, '¿Hace cortes?', "$('Leer ajustes').first().json.allowCortes === true && $('Inicio').first().json.plan.formato !== 'short' && ($('Inicio').first().json.plan.storyboard?.cortes || []).length > 0")
code(f, 'Composiciones de cortes', COMPONER + r"""
// Cada corte: los planos que eligió el storyboard, en vertical, con subtítulos; máximo 3 cortes de hasta 60 s.
const e = $('Inicio').first().json; const ids = new Set((e.plan.planos || []).map(p => p.id));
const cortes = (e.plan.storyboard?.cortes || []).slice(0, 3)
  .map((c, i) => ({ i, titulo: String(c.titulo || '').slice(0, 100), planos: (c.planos || []).filter(id => ids.has(id)) })).filter(c => c.planos.length);
const out = [];
for (const c of cortes) {
  const r = componer({ plan: e.plan, planos: e.planos, son: e.son, vertical: true, soloIds: c.planos, forzarSubtitulos: true });
  if (r.listos && r.total <= 61) out.push({ json: { corte: c.i + 1, titulo: c.titulo, duracion_s: r.total, source: r.source } });
}
return out.length ? out : [{ json: { ninguno: true } }];
""")
iff(f, '¿Hay cortes válidos?', '$json.ninguno !== true')
http(f, 'Renderizar corte', 'POST', 'https://api.creatomate.com/v2/renders', body='={{ { source: $json.source } }}', timeout=60000, cred=CRED_CREATOMATE)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
wait(f, 'Esperar cortes', 60)
http(f, 'Consultar cortes', 'GET', "={{ 'https://api.creatomate.com/v2/renders/' + ($json.id || $json[0]?.id || 'x') }}", timeout=30000, cred=CRED_CREATOMATE)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Estado de cortes', r"""
const pedidos = $('Composiciones de cortes').all().map(i => i.json);
const r = $input.all().map((i, k) => ({ ...pedidos[k], id: i.json.id || $('Renderizar corte').all()[k]?.json?.id, status: i.json.status, url: i.json.url || '' }));
const pendientes = r.some(x => !['succeeded', 'failed'].includes(x.status) && x.id);
return r.map(x => ({ json: { ...x, source: undefined, pendientes } }));
""")
iff(f, '¿Faltan cortes?', '$json.pendientes === true')
wait(f, 'Esperar más', 90)
http(f, 'Consultar otra vez', 'GET', "={{ 'https://api.creatomate.com/v2/renders/' + ($json.id || 'x') }}", timeout=30000, cred=CRED_CREATOMATE)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Cortes listos', r"""
// Junta los cortes terminados; los que fallaron o tardaron demasiado se omiten y se avisan.
const base = $('Estado de cortes').all().map(i => i.json);
const otra = $('Consultar otra vez').isExecuted ? $('Consultar otra vez').all().map(i => i.json) : [];
const final = base.map((c, k) => { const o = otra[k]; const st = o?.status || c.status; const url = o?.url || c.url;
  return { corte: c.corte, titulo: c.titulo, duracion_s: c.duracion_s, ok: st === 'succeeded' && !!url, url: st === 'succeeded' ? url : '', estado: st || 'sin respuesta' }; });
return [{ json: { cortes: final.filter(c => c.ok), fallidos: final.filter(c => !c.ok).map(c => `corte ${c.corte}: ${c.estado}`) } }];
""")
code(f, 'Sin cortes', "return [{ json: { cortes: [], fallidos: [] } }];")
# --- Miniatura -----------------------------------------------------------------------------
iff(f, '¿Hace miniatura?', "$('Leer ajustes').first().json.allowMiniaturas === true && $('Inicio').first().json.plan.formato !== 'short' && !!$('Inicio').first().json.plan.storyboard?.miniatura")
code(f, 'Pedido de miniatura', r"""
const e = $('Inicio').first().json; const mi = e.plan.storyboard.miniatura || {}; const b = e.plan.biblia || {};
// Sin texto en la imagen: el texto lo monta Creatomate (letra nítida y estilo del canal).
const prompt = [`Miniatura de YouTube, 16:9, ${mi.prompt_imagen || mi.concepto || e.plan.tema}.`, b.estilo_visual?.descripcion ? 'Estilo: ' + b.estilo_visual.descripcion + '.' : '',
  'Un solo sujeto claro, alto contraste, fondo simple, espacio libre a la izquierda para texto. Sin texto, sin letras, sin logos.'].filter(Boolean).join(' ');
const refs = (b.personajes || []).filter(p => (mi.personajes || []).includes(p.id)).flatMap(p => p.referencias_urls || []).slice(0, 3);
return [{ json: { prompt, refs, texto: String(mi.texto || '').toUpperCase().slice(0, 32) } }];
""")
http(f, 'Imagen de miniatura', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloTexto, tools: [{ type: 'image_generation', model: $('Leer ajustes').first().json.modeloImagen, size: '1536x1024' }], tool_choice: { type: 'image_generation' }, input: [{ role: 'user', content: [{ type: 'input_text', text: $json.prompt }, ...$json.refs.map(u => ({ type: 'input_image', image_url: u }))] }] } }}",
     timeout=180000, cred=CRED_OPENAI)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Archivo de miniatura', r"""
const out = ($json.output || []).find(o => o.type === 'image_generation_call');
if (!out?.result) return [{ json: { ok: false, error: 'sin imagen de miniatura' } }];
return [{ json: { ok: true }, binary: { imagen: { data: out.result, mimeType: 'image/png', fileName: 'miniatura-base.png' } } }];
""")
iff(f, '¿Hay imagen?', '$json.ok === true')
gapi(f, 'Subir base', 'POST', 'https://www.googleapis.com/upload/drive/v3/files', 'googleDriveOAuth2Api', binary_field='imagen', query={'uploadType': 'media'})
gapi(f, 'Nombrar base', 'PATCH', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}", 'googleDriveOAuth2Api',
     json_body='={{ { name: "miniatura-base.png" } }}', query={'addParents': "={{ $('Inicio').first().json.carpeta || $('Leer ajustes').first().json.driveCarpetaRaizId }}", 'removeParents': 'root'}, timeout=30000)
gapi(f, 'Compartir base', 'POST', "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Subir base').first().json.id + '/permissions' }}",
     'googleDriveOAuth2Api', json_body='={{ { role: "reader", type: "anyone" } }}', timeout=30000)
code(f, 'Composición de miniatura', r"""
// 1280x720 JPG: la imagen a pantalla completa y el texto corto grande, con contorno, en el estilo del canal.
const e = $('Inicio').first().json; const m = e.plan.biblia?.montaje || {}; const texto = $('Pedido de miniatura').first().json.texto;
const url = 'https://drive.google.com/uc?export=download&id=' + $('Subir base').first().json.id;
const els = [{ type: 'image', source: url, fit: 'cover' }];
if (texto) els.push({ type: 'text', text: texto, x: '27%', y: '50%', width: '48%', height: '70%', x_alignment: '0%', y_alignment: '50%',
  font_family: m.fuente || 'Montserrat', font_weight: '900', font_size_maximum: '18 vmin', fill_color: m.color_texto || '#FFFFFF',
  stroke_color: '#000000', stroke_width: '1.6 vmin', shadow_color: 'rgba(0,0,0,0.6)', shadow_blur: '2 vmin' });
return [{ json: { source: { output_format: 'jpg', width: 1280, height: 720, elements: els }, base_url: url } }];
""")
http(f, 'Renderizar miniatura', 'POST', 'https://api.creatomate.com/v2/renders', body='={{ { source: $json.source } }}', timeout=60000, cred=CRED_CREATOMATE)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
wait(f, 'Esperar miniatura', 20)
http(f, 'Consultar miniatura', 'GET', "={{ 'https://api.creatomate.com/v2/renders/' + ($('Renderizar miniatura').first().json.id || $('Renderizar miniatura').first().json[0]?.id || 'x') }}", timeout=30000, cred=CRED_CREATOMATE)
f.nodes[-1].update({'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
code(f, 'Resultado', r"""
// Lo que vuelve a Producción: cortes listos, miniatura (o la imagen base si Creatomate falló) y su costo.
const aj = $('Leer ajustes').first().json;
const c = $('Cortes listos').isExecuted ? $('Cortes listos').first().json : { cortes: [], fallidos: [] };
let miniatura_url = '', avisos = [...(c.fallidos || [])], costo_usd = 0;
if ($('Imagen de miniatura').isExecuted) {
  costo_usd += aj.costoMiniaturaUsd;
  const r = $('Consultar miniatura').isExecuted ? $('Consultar miniatura').first().json : {};
  miniatura_url = r.status === 'succeeded' && r.url ? r.url : ($('Composición de miniatura').isExecuted ? $('Composición de miniatura').first().json.base_url : '');
  if (!miniatura_url) avisos.push('no se pudo crear la miniatura');
  else if (r.status !== 'succeeded') avisos.push('la miniatura salió sin texto (Creatomate no terminó)');
}
return [{ json: { cortes: c.cortes || [], miniatura_url, costo_usd, avisos } }];
""")
f.chain('Inicio', 'Leer ajustes', '¿Hace cortes?')
f.link('¿Hace cortes?', 'Composiciones de cortes', 0)
f.link('¿Hace cortes?', 'Sin cortes', 1)
f.link('Composiciones de cortes', '¿Hay cortes válidos?')
f.link('¿Hay cortes válidos?', 'Renderizar corte', 0)
f.link('¿Hay cortes válidos?', 'Sin cortes', 1)
f.chain('Renderizar corte', 'Esperar cortes', 'Consultar cortes', 'Estado de cortes', '¿Faltan cortes?')
f.link('¿Faltan cortes?', 'Esperar más', 0)
f.link('¿Faltan cortes?', 'Cortes listos', 1)
f.chain('Esperar más', 'Consultar otra vez', 'Cortes listos')
f.link('Cortes listos', '¿Hace miniatura?')
f.link('Sin cortes', '¿Hace miniatura?')
f.link('¿Hace miniatura?', 'Pedido de miniatura', 0)
f.link('¿Hace miniatura?', 'Resultado', 1)
f.chain('Pedido de miniatura', 'Imagen de miniatura', 'Archivo de miniatura', '¿Hay imagen?')
f.link('¿Hay imagen?', 'Subir base', 0)
f.link('¿Hay imagen?', 'Resultado', 1)
f.chain('Subir base', 'Nombrar base', 'Compartir base', 'Composición de miniatura', 'Renderizar miniatura', 'Esperar miniatura', 'Consultar miniatura', 'Resultado')
DERIV = f.dump()

# ======================================================================================
# M8 · Publicación en redes con Upload-Post: YouTube, TikTok, Instagram (Reels) y Facebook (Reels/video).
# Su app ya está auditada en cada red, así que los posts salen públicos. Un perfil de Upload-Post por canal.
#   Short  → el mismo video vertical a todas las redes del canal.
#   Largo  → el video a YouTube (y Facebook si está en la lista); cada corte vertical a TikTok, Reels y Shorts.
# ======================================================================================
f = Flow(W['redes'], 'M8 · Publicación en redes')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
iff(f, '¿Puntuar títulos?', "$('Leer ajustes').first().json.allowVidiq === true && ($('Inicio').first().json.contexto?.publicacion?.youtube?.titulos || []).length > 1")
code(f, 'Pedido de títulos', TITULO_JS + "const e = $('Inicio').first().json; const t = (e.contexto.publicacion.youtube.titulos || []).map(x => revisarTitulo(x)).filter(r => r.caracteres <= TITULO.maximo).sort((a, b) => b.puntaje - a.puntaje).map(r => r.titulo); return [{ json: { accion: 'titulos', titulos: t.length ? t : e.contexto.publicacion.youtube.titulos, formato: e.formato } }];")
call(f, 'vidIQ: títulos', W['vidiq'])
f.add('Agenda del canal', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('publicaciones'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'canal_id', 'condition': 'eq', 'keyValue': "={{ $('Inicio').first().json.canal_id }}"}, {'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 30 * 86400000).toISOString() }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Plan de publicación', TITULO_JS + r"""
// Calendario: un envío por video y red, a la hora fuerte de cada red (hora local del público), sin chocar con lo
// ya programado del canal. Largo: mañana (margen para que YouTube lo indexe); cortes repartidos 1, 3 y 5 días después.
const e = $('Inicio').first().json; const aj = $('Leer ajustes').first().json; const c = e.contexto || {}; const pub = c.publicacion || {};
const cal = aj.calendario || {}; const zona = e.zona || cal.zona || 'America/Lima'; const H = cal.horas || {};
const redes = [...new Set(String(e.redes || 'youtube,tiktok,instagram,facebook').toLowerCase().split(/[\s,]+/))].filter(r => ['youtube', 'tiktok', 'instagram', 'facebook'].includes(r));
if (!e.perfil) return [{ json: { nada: true, motivo: 'el canal no tiene perfil de Upload-Post (usa «redes <canal> <perfil> <redes>»)' } }];
// --- horas locales sin librerías (Intl) ---
const partes = d => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(d).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
const diaLocal = d => { const p = partes(d); return `${p.year}-${p.month}-${p.day}`; };
const aUTC = (dia, hora) => { const [y, m, d] = dia.split('-').map(Number); const hh = Math.floor(hora), mm = Math.round((hora - hh) * 60); const meta = Date.UTC(y, m - 1, d, hh, mm); let t = meta;
  for (let i = 0; i < 3; i++) { const p = partes(new Date(t)); t += meta - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); } return new Date(t); };
const sumarDias = (dia, n) => { const [y, m, d] = dia.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const ahora = new Date(Date.now() + 15 * 60000);   // 15 min de margen para que Upload-Post lo reciba
// --- agenda existente del canal: cuántos envíos hay por red y día, y cuándo fue el último largo ---
const agenda = $('Agenda del canal').all().map(i => i.json).filter(r => r.request_id && r.estado !== 'error' && r.publicado_en);
const ocupado = {}; for (const r of agenda) for (const red of String(r.plataformas || '').split(',')) { const k = red + '|' + diaLocal(new Date(r.publicado_en)); ocupado[k] = (ocupado[k] || 0) + 1; }
const largos = agenda.filter(r => r.tipo === 'principal').map(r => Date.parse(r.publicado_en));
const minimoLargo = Math.max(0, ...largos) + (cal.diasEntreLargos || 2) * 86400000;
const maxDia = cal.maxPorRedDia || 2;
const hueco = (red, dia, hora, minimo = 0) => { let d = dia; // conservar también las horas de separación, no solo la fecha local
  for (let i = 0; i < 30; i++, d = sumarDias(d, 1)) { const t = aUTC(d, hora); if (t > ahora && t >= minimo && (ocupado[red + '|' + d] || 0) < maxDia) { ocupado[red + '|' + d] = (ocupado[red + '|' + d] || 0) + 1; return t; } }
  return null; };
// --- día del video principal: el que tú programaste, o el primero con 2 días de distancia del último largo ---
let diaBase = diaLocal(ahora);
if (Date.parse(e.publicar_en || '') > Date.now()) diaBase = diaLocal(new Date(e.publicar_en));
else if (e.formato !== 'short') { if (minimoLargo > Date.parse(diaBase + 'T12:00:00Z')) diaBase = diaLocal(new Date(minimoLargo)); }
const horaFija = Date.parse(e.publicar_en || '') > Date.now() ? (pp => Number(pp.hour) + Number(pp.minute) / 60)(partes(new Date(e.publicar_en))) : null;
// --- textos ---
const vq = $('vidIQ: títulos').isExecuted ? $('vidIQ: títulos').first().json : null; const yt = pub.youtube || {};
const porRevision = (yt.titulos || []).map(t => revisarTitulo(t)).sort((a, b) => b.puntaje - a.puntaje)[0]?.titulo;   // sin vidIQ: el mejor según yt-empaque
const tituloYt = String((vq?.ok && vq.mejor) || porRevision || e.tema || '').slice(0, 100);
const creditos = (c.creditos || []).join('\n');
const descYt = [yt.descripcion, creditos, 'Contenido creado con ayuda de IA.'].filter(Boolean).join('\n\n').slice(0, 4900);
const tags = (yt.tags || []).map(t => String(t).replace(/^#/, '')).filter(Boolean).slice(0, 15).join(',');
const hashtags = l => (l || []).map(h => '#' + String(h).replace(/^#/, '').replace(/\s+/g, '')).join(' ');
const texto = (red, def) => { const x = pub[red] || {}; return [x.texto || def, hashtags(x.hashtags)].filter(Boolean).join('\n\n').slice(0, 2100); };
const comun = { user: e.perfil, is_ai_generated: 'true', async_upload: 'true' };
const campos = (red, t, vertical, extra = {}) => ({ ...comun, title: t, ...({
  youtube: { youtube_title: vertical ? (t + ' #Shorts').slice(0, 100) : t, youtube_description: vertical ? [t, 'Sigue el canal para el próximo negocio desarmado con números.', creditos].filter(Boolean).join('\n\n').slice(0, 4900) : descYt,
    tags, categoryId: '27', defaultLanguage: aj.idioma, defaultAudioLanguage: aj.idioma, privacyStatus: aj.privacidadYoutube || 'public', selfDeclaredMadeForKids: 'false', containsSyntheticMedia: 'true' },
  tiktok: { tiktok_title: texto('tiktok', t), privacy_level: 'PUBLIC_TO_EVERYONE', is_aigc: 'true' },
  instagram: { instagram_title: texto('instagram', t), media_type: 'REELS', share_to_feed: 'true' },
  facebook: { facebook_title: String(pub.facebook?.titulo || t).slice(0, 250), facebook_description: texto('facebook', t), facebook_media_type: vertical ? 'REELS' : 'VIDEO' },
}[red]), ...extra });
const envios = []; const sinCupo = [];
const agendar = (tipo, video, red, dia, hora, t, vertical, extra) => {
  const cuando = hueco(red, dia, hora, !vertical && horaFija === null ? minimoLargo : 0); if (!cuando) { sinCupo.push(`${tipo} ${red}`); return; }
  envios.push({ tipo, red, video, cuando, campos: campos(red, t, vertical, extra) }); };
if (e.formato === 'short') {
  // Hora del especialista de cada red (6–23 h, hora del público) si la propuso; si no, la de Ajustes.
  const horaRed = red => { const h = Number(pub[red]?.hora); return Number.isFinite(h) && h >= 6 && h <= 23 ? h : null; };
  for (const red of redes) agendar('principal', c.render_url, red, diaBase, horaFija ?? horaRed(red) ?? (red === 'youtube' ? H.youtube_shorts ?? 16 : H[red] ?? 19), tituloYt, true);
} else {
  for (const red of redes.filter(r => ['youtube', 'facebook'].includes(r)))
    agendar('principal', c.render_url, red, diaBase, horaFija ?? H[red] ?? 11, tituloYt, false, red === 'youtube' && c.miniatura_url ? { thumbnail_url: c.miniatura_url } : {});
  // los cortes cuentan desde el día en que de verdad sale el largo (si su hora ya pasó hoy, sale mañana)
  const diaLargo = envios.length ? diaLocal(envios[0].cuando) : diaBase;
  (c.cortes || []).filter(k => k.url).forEach((k, i) => { const t = String(k.titulo || tituloYt).slice(0, 95);
    const dia = sumarDias(diaLargo, (cal.cortesDias || [1, 3, 5])[i] ?? (i + 1) * 2);
    for (const red of redes) agendar('corte ' + k.corte, k.url, red, dia, red === 'youtube' ? H.youtube_shorts ?? 16 : H[red] ?? 19, t, true); });
}
if (!envios.length) return [{ json: { nada: true, motivo: sinCupo.length ? 'sin cupo en el calendario para: ' + sinCupo.join(', ') : 'no hay nada que publicar (revisa las redes del canal y los cortes)' } }];
// Campos del formulario como pares [nombre, valor]. n8n arma el multipart (un cuerpo hecho a mano lo reempaqueta letra por letra).
// Hay CASILLAS fijas en «Subir a redes»; las sobrantes repiten `user` con el mismo valor (campo conocido, inofensivo).
const CASILLAS = 24;
return envios.map((v, i) => {
  const inmediato = v.cuando <= ahora;   // nunca ocurre: todo hueco es posterior a «ahora»; queda como resguardo
  const p = partes(v.cuando); const local = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00`;
  const pares = [['video', v.video], ['platform[]', v.red], ...Object.entries(v.campos).filter(([, x]) => x !== undefined && x !== null && x !== '').map(([k, x]) => [k, String(x)]),
    ...(inmediato ? [] : [['scheduled_date', local], ['timezone', zona]])];
  if (pares.length > CASILLAS) throw new Error(`demasiados campos para Upload-Post (${pares.length} > ${CASILLAS}); amplía CASILLAS en el generador`);
  while (pares.length < CASILLAS) pares.push(['user', e.perfil]);
  return { json: { tipo: v.tipo, plataformas: v.red, titulo: v.campos.title, url_video: v.video, pares,
    programado: inmediato ? '' : v.cuando.toISOString(), hora_local: inmediato ? 'ahora' : local.replace('T', ' ').slice(0, 16), sin_cupo: sinCupo } };
});
""")
iff(f, '¿Hay envíos?', '$json.nada !== true')
CASILLAS_UPLOADPOST = 24   # igual que CASILLAS en «Plan de publicación»
f.add('Subir a redes', 'n8n-nodes-base.httpRequest', 4.2,
      {'method': 'POST', 'url': 'https://api.upload-post.com/api/upload', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
       'sendBody': True, 'contentType': 'multipart-form-data', 'bodyParameters': {'parameters': [
           {'parameterType': 'formData', 'name': f'={{{{ $json.pares[{i}][0] }}}}', 'value': f'={{{{ $json.pares[{i}][1] }}}}'} for i in range(CASILLAS_UPLOADPOST)]},
       'options': {'timeout': 120000}},
      credentials=CRED_UPLOADPOST, onError='continueRegularOutput', retryOnFail=True, maxTries=2, waitBetweenTries=5000)
code(f, 'Filas de publicación', r"""
const e = $('Inicio').first().json; const pedidos = $('Plan de publicación').all().map(i => i.json);
return $input.all().map((i, k) => { const r = i.json; const p = pedidos[k];
  const id = r.request_id || r.job_id || r.data?.request_id || '';
  // Upload-Post da job_id a lo programado: su estado se consulta con ?job_id= (con request_id da 404 hasta la hora).
  return { json: { video_id: e.video_id, canal_id: e.canal_id, tipo: p.tipo, request_id: id, job_id: String(r.job_id || ''), plataformas: p.plataformas, titulo: String(p.titulo || '').slice(0, 200),
    url_video: p.url_video, estado: id ? (p.programado ? 'programado' : 'enviado') : 'error',
    resultado: JSON.stringify(id ? { status: r.status || r.message || '' } : { error: r.error?.message || r.message || r.error || 'sin request_id' }).slice(0, 800),
    publicado_en: p.programado || new Date().toISOString() } }; });
""")
dt_insert(f, 'Guardar publicaciones', 'publicaciones')
code(f, 'Video publicado', r"""
// «publicado» solo si algo salió ya; si todo quedó en el calendario, «programado» hasta que
// «F · Confirmar publicaciones» compruebe en Upload-Post que salió de verdad.
const filas = $('Filas de publicación').all().map(i => i.json); const ok = filas.filter(f => f.request_id);
const estado = !ok.length ? 'error_publicacion' : ok.some(f => f.estado === 'enviado') ? 'publicado' : 'programado';
return [{ json: { estado, etapa: estado === 'programado' ? 'programado' : 'publicado',
  publicado_en: ok[0]?.publicado_en || '', error: ok.length === filas.length ? '' : filas.filter(f => !f.request_id).map(f => f.tipo + ': ' + f.resultado).join('; ').slice(0, 500) } }];
""")
dt_update(f, 'Marcar publicado', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
wait(f, 'Esperar a las redes', 120)
code(f, 'Pedidos de estado', "const l = $('Filas de publicación').all().filter(i => i.json.request_id && i.json.estado === 'enviado').map(i => ({ json: i.json })); return l.length ? l : [{ json: { nada: true } }];")
iff(f, '¿Hay que consultar?', '$json.nada !== true')
http(f, 'Estado en redes', 'GET', "={{ 'https://api.upload-post.com/api/uploadposts/status?request_id=' + encodeURIComponent($json.request_id) }}", timeout=30000, cred=CRED_UPLOADPOST)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Resumen de publicación', r"""
// Un renglón por envío y red: publicado, en proceso o con error (lo que diga Upload-Post).
const filas = $('Filas de publicación').all().map(i => i.json); const pedidos = $('Plan de publicación').all().map(i => i.json);
const estados = $('Estado en redes').isExecuted ? $('Estado en redes').all().map(i => i.json) : [];
const enviados = filas.filter(f => f.request_id && f.estado === 'enviado');
const lineas = filas.map(f => {
  if (!f.request_id) return `✗ ${f.tipo}: ${JSON.parse(f.resultado || '{}').error || 'error'}`;
  if (f.estado === 'programado') return `🕒 ${f.tipo} → ${f.plataformas}: ${pedidos[filas.indexOf(f)]?.hora_local || f.publicado_en}`;
  const st = estados[enviados.indexOf(f)] || {}; const res = st.results || st.result || st.platforms || [];
  const det = Array.isArray(res) ? res.map(x => `${x.platform}: ${x.success === false ? 'error ' + String(x.error || x.message || '').slice(0, 80) : (x.url || x.post_url || 'ok')}`).join(' · ')
    : typeof res === 'object' ? Object.entries(res).map(([p, x]) => `${p}: ${x?.success === false ? 'error ' + String(x.error || '').slice(0, 80) : (x?.url || 'ok')}`).join(' · ') : '';
  return `✓ ${f.tipo} → ${f.plataformas}${st.status ? ' (' + st.status + ')' : ''}${det ? '\n   ' + det : ''}`; });
return [{ json: { texto: `Publicación de ${$('Inicio').first().json.video_id}:\n` + lineas.join('\n') } }];
""")
tg(f, 'Aviso: publicado', "={{ $('Leer ajustes').first().json.chatId }}", "={{ $json.texto.slice(0, 3900) }}")
tg(f, 'Aviso: nada que publicar', "={{ $('Leer ajustes').first().json.chatId }}", "={{ 'No publiqué ' + $('Inicio').first().json.video_id + ': ' + $json.motivo }}")
f.chain('Inicio', 'Leer ajustes', '¿Puntuar títulos?')
f.link('¿Puntuar títulos?', 'Pedido de títulos', 0)
f.link('¿Puntuar títulos?', 'Agenda del canal', 1)
f.chain('Pedido de títulos', 'vidIQ: títulos', 'Agenda del canal', 'Plan de publicación', '¿Hay envíos?')
f.link('¿Hay envíos?', 'Subir a redes', 0)
f.link('¿Hay envíos?', 'Aviso: nada que publicar', 1)
f.chain('Subir a redes', 'Filas de publicación', 'Guardar publicaciones')
f.link('Filas de publicación', 'Video publicado')
f.chain('Video publicado', 'Marcar publicado', 'Esperar a las redes', 'Pedidos de estado', '¿Hay que consultar?')
f.link('¿Hay que consultar?', 'Estado en redes', 0)
f.link('¿Hay que consultar?', 'Resumen de publicación', 1)
f.chain('Estado en redes', 'Resumen de publicación', 'Aviso: publicado')
REDES = f.dump()

# ======================================================================================
# F · Confirmar publicaciones (cada hora): lo programado o enviado cuya hora ya pasó se consulta en Upload-Post.
# Marca cada envío «publicado» (con su enlace) o «error», y el video «publicado» solo cuando todas sus redes salieron.
# ======================================================================================
f = Flow(W['confirmar'], 'F · Confirmar publicaciones')
f.add('Cada hora', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'hours', 'hoursInterval': 1, 'triggerAtMinute': 7}]}})
call(f, 'Leer ajustes', W['ajustes'])
f.add('Publicaciones recientes', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('publicaciones'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 14 * 86400000).toISOString() }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Por confirmar', r"""
// Solo lo que ya debió salir (10 min de margen) y aún no está confirmado.
const corte = Date.now() - 10 * 60000;
const l = $input.all().map(i => i.json).filter(p => p.request_id && ['programado', 'enviado'].includes(p.estado) && Date.parse(p.publicado_en || 0) <= corte);
return l.length ? l.map(p => ({ json: p })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay por confirmar?', '$json.nada !== true')
http(f, 'Consultar Upload-Post', 'GET', "={{ 'https://api.upload-post.com/api/uploadposts/status?' + ($json.job_id ? 'job_id=' + encodeURIComponent($json.job_id) : 'request_id=' + encodeURIComponent($json.request_id)) }}", timeout=30000, cred=CRED_UPLOADPOST)
f.nodes[-1].update({'onError': 'continueRegularOutput'})
code(f, 'Leer resultados', r"""
// Traduce la respuesta de Upload-Post: completo y sin fallos → publicado; fallido → error; lo demás sigue esperando.
const pedidos = $('Por confirmar').all().map(i => i.json);
const todas = $('Publicaciones recientes').all().map(i => i.json);
const cambios = [];
$input.all().forEach((it, k) => {
  const p = pedidos[k]; const r = it.json || {}; if (!p) return;
  const res = Array.isArray(r.results) ? r.results : [];
  const st = String(r.status || '').toLowerCase();
  // Solo se juzga lo terminado: mientras está «queued» Upload-Post ya trae success:false (aún no hay intento).
  if (!['completed', 'failed'].includes(st) || !res.length) return;   // pendiente o en proceso: se mira en una hora
  const fallo = st === 'failed' || res.some(x => x.success !== true);
  const listo = !fallo;
  const urls = res.map(x => x.post_url || x.url || '').filter(Boolean);
  const errores = res.filter(x => x.success !== true).map(x => `${x.platform}: ${String(x.error_message || x.error || x.message || 'error').slice(0, 120)}`);
  cambios.push({ request_id: p.request_id, video_id: p.video_id, plataformas: p.plataformas, tipo: p.tipo,
    estado: listo ? 'publicado' : 'error', url: urls[0] || '', youtube_id: (res.find(x => x.platform === 'youtube' && x.success === true) || {}).platform_post_id || '',
    resultado: JSON.stringify(listo ? { status: st, urls } : { status: st || 'failed', errores }).slice(0, 800) });
});
if (!cambios.length) return [{ json: { nada: true } }];
// Estado del video: publicado cuando todas sus publicaciones salieron; error si alguna falló.
const porVideo = {};
for (const v of new Set(cambios.map(c => c.video_id))) {
  const filas = todas.filter(t => t.video_id === v).map(t => cambios.find(c => c.request_id === t.request_id) || t);
  const yt = cambios.filter(c => c.video_id === v && /youtube/.test(c.plataformas)).map(c => c.youtube_id || (c.url.match(/(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/) || [])[1]).find(Boolean) || '';
  porVideo[v] = { video_id: v, youtube_id: yt,
    estado: filas.some(f => f.estado === 'error') ? 'error_publicacion' : filas.every(f => f.estado === 'publicado') ? 'publicado' : '' };
}
return cambios.map(c => ({ json: { ...c, video: porVideo[c.video_id] } }));
""")
iff(f, '¿Hubo cambios?', '$json.nada !== true')
code(f, 'Fila de publicación', "return $input.all().map(i => ({ json: { request_id: i.json.request_id, estado: i.json.estado, resultado: i.json.resultado } }));")
f.add('Actualizar publicación', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'update', 'dataTableId': rl('publicaciones'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'request_id', 'condition': 'eq', 'keyValue': "={{ $json.request_id }}"}]},
       'columns': AUTOMAP, 'options': {}})
code(f, 'Videos a cerrar', r"""
const vistos = new Set(); const l = [];
for (const i of $('Leer resultados').all()) { const v = i.json.video; if (!v || !v.estado || vistos.has(v.video_id)) continue; vistos.add(v.video_id);
  const fila = { video_id: v.video_id, estado: v.estado, etapa: v.estado === 'publicado' ? 'publicado' : 'publicacion' };
  if (v.youtube_id) fila.youtube_id = v.youtube_id; l.push({ json: fila }); }
return l.length ? l : [{ json: { nada: true } }];
""")
iff(f, '¿Cerrar video?', '$json.nada !== true')
f.add('Actualizar video', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'update', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'video_id', 'condition': 'eq', 'keyValue': "={{ $json.video_id }}"}]},
       'columns': AUTOMAP, 'options': {}})
code(f, 'Aviso corto', r"""
const l = $('Leer resultados').all().map(i => i.json).map(c => c.estado === 'publicado'
  ? `✅ ${c.video_id} → ${c.plataformas}${c.url ? '\n' + c.url : ''}` : `❌ ${c.video_id} → ${c.plataformas}: ${JSON.parse(c.resultado).errores?.join('; ') || 'falló'}`);
return [{ json: { texto: 'Publicación confirmada:\n' + l.join('\n') } }];
""")
tg(f, 'Avisar', "={{ $('Leer ajustes').first().json.chatId }}", '={{ $json.texto.slice(0, 3900) }}')
f.chain('Cada hora', 'Leer ajustes', 'Publicaciones recientes', 'Por confirmar', '¿Hay por confirmar?')
f.link('¿Hay por confirmar?', 'Consultar Upload-Post', 0)
f.chain('Consultar Upload-Post', 'Leer resultados', '¿Hubo cambios?')
f.link('¿Hubo cambios?', 'Fila de publicación', 0)
f.chain('Fila de publicación', 'Actualizar publicación')
f.link('¿Hubo cambios?', 'Videos a cerrar', 0)
f.chain('Videos a cerrar', '¿Cerrar video?')
f.link('¿Cerrar video?', 'Actualizar video', 0)
f.link('¿Hubo cambios?', 'Aviso corto', 0)
f.chain('Aviso corto', 'Avisar')
CONFIRMAR = f.dump()

# ======================================================================================
# F · Rutina diaria: videos atascados (cada día) y reporte semanal (lunes), sin que lo pidas.
# ======================================================================================
f = Flow('FabRutina0000001', 'F · Rutina diaria y reporte semanal')
f.add('Cada mañana', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 8, 'triggerAtMinute': 10}]}})
call(f, 'Leer ajustes', W['ajustes'])
f.add('Videos en curso', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('videos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 30 * 86400000).toISOString() }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Atascados', r"""
// Un video está atascado si sigue «en proceso» y su fila no cambió en 24 h (las aprobaciones pendientes también cuentan:
// te recuerda lo que espera tu respuesta).
const hace = Date.now() - 24 * 3600000;
const a = $input.all().map(i => i.json).filter(v => v.video_id && ['en_proceso', 'detenido', 'con_fallas', 'error_publicacion'].includes(v.estado)
  && Date.parse(v.updatedAt || v.createdAt || 0) < hace);
if (!a.length) return [{ json: { nada: true } }];
const l = a.slice(0, 20).map(v => `• ${v.video_id} (${v.canal_id}) en «${v.etapa}», ${v.estado}${v.error ? ': ' + String(v.error).slice(0, 80) : ''}`);
return [{ json: { texto: `Videos sin avanzar hace más de 24 h (${a.length}):\n` + l.join('\n') + (a.length > 20 ? '\n…' : '') + '\n\nUsa «estado» o pídeme corregir.' } }];
""")
iff(f, '¿Hay atascados?', '$json.nada !== true')
tg(f, 'Aviso: atascados', "={{ $('Leer ajustes').first().json.chatId }}", '={{ $json.texto.slice(0, 3900) }}')
iff(f, '¿Es lunes?', "new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Lima' }) === 'Mon'")
code(f, 'Pedido de reporte', "return [{ json: { tipo: 'reporte', dias: 7 } }];")
call(f, 'Reporte de 7 días', W['estado'])
tg(f, 'Enviar reporte semanal', "={{ $('Leer ajustes').first().json.chatId }}", "={{ ('Reporte semanal de la fábrica\\n' + $json.resumen).slice(0, 3900) }}")
f.chain('Cada mañana', 'Leer ajustes', 'Videos en curso', 'Atascados', '¿Hay atascados?')
f.link('¿Hay atascados?', 'Aviso: atascados', 0)
f.link('Atascados', '¿Es lunes?')
f.link('¿Es lunes?', 'Pedido de reporte', 0)
f.chain('Pedido de reporte', 'Reporte de 7 días', 'Enviar reporte semanal')

# Producción automática hacia las metas de cada canal (solo canales con metas.auto = true).
# Cuenta lo producido y lo gastado en 7 días; si falta y cabe en el tope, pide UN video con tema elegido por la fábrica.
# Frenos: tope semanal, un video en curso por canal a la vez, y retención media de los últimos 3 videos bajo la meta.
# Tus aprobaciones siguen siendo la puerta: nada se publica sin tu «Aprobar».
f.add('Canales activos', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('canales'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'activo'}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
f.add('Costos de la semana', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('costos'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'createdAt', 'condition': 'gte', 'keyValue': "={{ new Date(Date.now() - 7 * 86400000).toISOString() }}"}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Plan del día', r"""
const aj = $('Leer ajustes').first().json; const hace7 = Date.now() - 7 * 86400000;
const vids = $('Videos en curso').all().map(i => i.json).filter(v => v.video_id);
const canalDe = Object.fromEntries(vids.map(v => [v.video_id, v.canal_id]));
const gasto = {}; for (const c of $input.all().map(i => i.json)) if (c.video_id && canalDe[c.video_id]) gasto[canalDe[c.video_id]] = (gasto[canalDe[c.video_id]] || 0) + (Number(c.usd) || 0);
const canales = $('Canales activos').all().map(i => i.json).filter(c => c.canal_id);
const pedidos = [], notas = [];
for (const c of canales) {
  let m = {}; try { m = JSON.parse(c.metas || '{}'); } catch (x) { m = {}; }
  if (m.auto !== true) continue;
  const fmt = m.formato === 'largo' ? 'largo' : 'short';
  const deCanal = vids.filter(v => v.canal_id === c.canal_id);
  const semana = deCanal.filter(v => Date.parse(v.createdAt || 0) >= hace7 && !['cancelado', 'rechazado'].includes(v.estado)).length;
  const enCurso = deCanal.filter(v => v.estado === 'en_proceso').length;
  const g = Math.round((gasto[c.canal_id] || 0) * 100) / 100;
  const unidad = fmt === 'short' ? Number(aj.presupuestoShortUsd || 2.5) : Number(aj.presupuestoLargoUsd || 8);
  const ret = deCanal.filter(v => Number.isFinite(Number(v.retencion_media)) && v.retencion_media !== null && v.retencion_media !== '')
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)).slice(0, 3).map(v => Number(v.retencion_media));
  const retMedia = ret.length === 3 ? ret.reduce((a, b) => a + b, 0) / 3 : null;
  const meta = Number(m.videos_semana || 0), tope = Number(m.gasto_semana_usd || 0), retMin = Number(m.retencion_min || 0);
  let motivo = '';
  if (semana >= meta) motivo = `meta cumplida (${semana}/${meta})`;
  else if (enCurso > 0) motivo = `ya hay ${enCurso} en curso`;
  else if (g + unidad > tope) motivo = `tope semanal: US$${g} gastados de US$${tope}`;
  else if (retMedia !== null && retMedia < retMin) motivo = `freno de calidad: retención ${Math.round(retMedia * 100)} % < ${Math.round(retMin * 100)} % en los últimos 3`;
  if (motivo) { notas.push(`• ${c.canal_id}: ${motivo}`); continue; }
  pedidos.push({ evento: 'nuevo_video', canal_id: c.canal_id, tema: '', formato: fmt, automatico: true,
    indicaciones: `Producción automática hacia la meta semanal (${semana + 1}/${meta}). Elige el tema con más potencial según la biblia, lo aprendido y el radar de tendencias de hoy (si una idea del radar encaja con la biblia, úsala).` });
  notas.push(`• ${c.canal_id}: pido un ${fmt} (${semana + 1}/${meta} esta semana; US$${g} de US$${tope})`);
}
if (!notas.length) return [{ json: { nada: true } }];
return [{ json: { pedidos, texto: '🤖 Producción automática de hoy\n' + notas.join('\n') + (pedidos.length ? '\n\nTe llegará el guion para aprobar.' : '') } }];
""")
iff(f, '¿Hay plan?', '$json.nada !== true')
tg(f, 'Aviso: plan del día', "={{ $('Leer ajustes').first().json.chatId }}", '={{ $json.texto.slice(0, 3900) }}')
code(f, 'Un pedido por canal', "const p = $('Plan del día').first().json.pedidos || []; return p.length ? p.map(x => ({ json: x })) : [{ json: { nada: true } }];")
iff(f, '¿Pide video?', '$json.nada !== true')
call(f, 'Pedir video automático', W['orq'], wait=False, each=True)
f.link('Atascados', 'Canales activos')
f.chain('Canales activos', 'Costos de la semana', 'Plan del día', '¿Hay plan?')
f.link('¿Hay plan?', 'Aviso: plan del día', 0)
f.link('¿Hay plan?', 'Un pedido por canal', 0)
f.link('Un pedido por canal', '¿Pide video?')
f.link('¿Pide video?', 'Pedir video automático', 0)
RUTINA = f.dump()

# ======================================================================================
# F · Radar de tendencias: cada mañana, antes de la rutina, mira qué despega en el nicho de cada canal activo
# (Reels y TikTok que superan a su creador, Shorts en español, sonidos en alza) y un analista (GPT) lo convierte en
# ideas que la fábrica sí puede producir. Queda en el canal (columna «tendencias», vale 3 días): lo leen el guionista,
# los especialistas de cada red y la producción automática. Te llega el resumen por Telegram.
# ======================================================================================
f = Flow(W['radar'], 'F · Radar de tendencias')
f.add('Cada mañana (radar)', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 7, 'triggerAtMinute': 40}]}})
call(f, 'Leer ajustes', W['ajustes'])
iff(f, '¿Radar encendido?', "$('Leer ajustes').first().json.allowRadar === true && $('Leer ajustes').first().json.allowVidiq === true")
f.add('Canales (radar)', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('canales'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'activo'}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Pedidos de radar', r"""
const c = $input.all().map(i => i.json).filter(x => x.canal_id && x.nicho);
return c.length ? c.map(x => ({ json: { accion: 'radar', canal_id: x.canal_id, nombre: x.nombre || x.canal_id, nicho: String(x.nicho).slice(0, 450),
  redes: x.redes || 'youtube,tiktok' } })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay canales?', '$json.nada !== true')
call(f, 'vidIQ: radar', W['vidiq'], each=True)
code(f, 'Encargo del analista', r"""
// Une cada canal con lo que trajo vidIQ (mismo orden) y arma el encargo del analista de tendencias.
const ped = $('Pedidos de radar').all().map(i => i.json); const vq = $input.all().map(i => i.json);
return ped.map((p, i) => { const v = vq[i] || {}; const t = v.ok ? (v.textos || []) : [];
  return { json: { ...p, ok: !!v.ok, creditos: v.creditos || 0, prompt:
`Eres el analista de tendencias de una fábrica de videos con IA (imágenes y clips generados, voz en off, montaje automático; sin rostros reales, sin grabar personas, sin plantillas de CapCut).
Canal: ${p.nombre}. Nicho: ${p.nicho}. Publica en: ${p.redes}.
Con estos datos de esta semana, di qué está funcionando y propón ideas que ESTA fábrica pueda producir ya, distintas por red:
- TikTok: ritmo, ganchos en pantalla, sonidos en alza (el sonido solo se puede sugerir: se pone a mano al publicar).
- Instagram Reels: estética, bucle, texto de portada, guardados y compartidos.
- YouTube Shorts: retención, búsqueda, nada de contenido repetido ni plantillas (política de contenido inauténtico).
Descarta lo que dependa de música con derechos en YouTube, de caras de personas reales o de grabar en persona.
Responde JSON {"resumen": "2 frases", "formatos": [{"formato": "", "por_que": "", "ejemplo": "url"}], "ideas": [{"titulo": "", "red": "tiktok|instagram|youtube|todas", "gancho": "primera frase y texto en pantalla", "formato": "", "por_que": "dato concreto del radar", "caduca_dias": 7}], "sonidos": [{"nombre": "", "url": "", "uso": ""}]}
Máximo 5 ideas, 3 formatos y 3 sonidos. Usa solo datos de abajo; si no alcanzan, dilo en el resumen.

== Reels y TikTok que superan a su creador ==
${(t[0] || 'sin datos').slice(0, 9000)}

== Shorts en español que despegan ==
${(t[1] || 'sin datos').slice(0, 6000)}

== Sonidos de TikTok en alza ==
${(t[2] || 'sin datos').slice(0, 4000)}` } }; });
""")
http(f, 'Analista de tendencias', 'POST', 'https://api.openai.com/v1/responses',
     body="={{ { model: $('Leer ajustes').first().json.modeloCritico, text: { format: { type: 'json_object' } }, input: [{ role: 'user', content: [{ type: 'input_text', text: $json.prompt }] }] } }}",
     timeout=180000, cred=CRED_OPENAI)
f.nodes[-1].update({'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 5000})
code(f, 'Radar del canal', r"""
const enc = $('Encargo del analista').all().map(i => i.json); const hoy = new Date().toISOString();
return $input.all().map((i, k) => { const p = enc[k] || {}; let r = {};
  try { r = JSON.parse((i.json.output || []).flatMap(o => o.content || []).find(x => x.type === 'output_text')?.text || '{}'); } catch (x) { r = {}; }
  const ideas = (r.ideas || []).slice(0, 5); const ok = ideas.length > 0;
  return { json: { canal_id: p.canal_id, nombre: p.nombre, ok, creditos: p.creditos,
    tendencias: ok ? JSON.stringify({ fecha: hoy, resumen: String(r.resumen || '').slice(0, 600), formatos: (r.formatos || []).slice(0, 3), ideas, sonidos: (r.sonidos || []).slice(0, 3) }) : '' } }; });
""")
code(f, 'Solo tendencias', "return $input.all().filter(i => i.json.ok).map(i => ({ json: { canal_id: i.json.canal_id, tendencias: i.json.tendencias } }));")
dt_update(f, 'Guardar tendencias', 'canales', 'canal_id', '={{ $json.canal_id }}')
code(f, 'Mensaje de radar', r"""
const l = $('Radar del canal').all().map(i => i.json);
const t = l.map(c => { if (!c.ok) return `• ${c.nombre}: sin radar hoy (vidIQ o el analista no respondieron).`;
  const r = JSON.parse(c.tendencias);
  return `${c.nombre}\n${r.resumen}\n` + r.ideas.map((x, i) => `${i + 1}. [${x.red}] ${x.titulo}\n   ${x.gancho}`).join('\n')
    + (r.sonidos.length ? '\nSonidos en alza en TikTok (para publicar a mano; la publicación automática no los agrega): ' + r.sonidos.map(s => s.nombre).join(' · ') : ''); }).join('\n\n');
return [{ json: { texto: ('📡 Radar de tendencias\n\n' + t + '\n\nLa fábrica las usará en los próximos guiones. Para pedir una: «haz un video de la idea 2 de Margen Real».').slice(0, 3900) } }];
""")
tg(f, 'Aviso: radar', "={{ $('Leer ajustes').first().json.chatId }}", '={{ $json.texto }}')
# A pedido (herramienta «tendencias» del agente): ver el radar guardado o correrlo ya.
trigger(f)
iff(f, '¿Solo ver?', "$('Inicio').first().json.accion !== 'correr'")
f.add('Canales (ver radar)', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('canales'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'activo'}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Radar guardado', r"""
const p = $('Inicio').first().json; const c = $input.all().map(i => i.json).filter(x => x.canal_id && (!p.canal_id || x.canal_id === p.canal_id));
const t = c.map(x => { let r = null; try { r = JSON.parse(x.tendencias || 'null'); } catch (e) { r = null; }
  if (!r) return `${x.nombre || x.canal_id}: todavía sin radar.`;
  const dias = Math.floor((Date.now() - Date.parse(r.fecha)) / 86400000);
  return `${x.nombre || x.canal_id} (canal_id ${x.canal_id}, radar de hace ${dias} d)\n${r.resumen}\n` + (r.ideas || []).map((i, k) => `${k + 1}. [${i.red}] ${i.titulo} — ${i.gancho} (formato: ${i.formato})`).join('\n')
    + ((r.sonidos || []).length ? '\nSonidos TikTok: ' + r.sonidos.map(s => s.nombre + (s.url ? ' ' + s.url : '')).join(' · ') : ''); });
return [{ json: { respuesta: t.join('\n\n') || 'No hay canales activos.' } }];
""")
f.link('Inicio', '¿Solo ver?')
f.link('¿Solo ver?', 'Canales (ver radar)', 0)
f.link('Canales (ver radar)', 'Radar guardado')
f.link('¿Solo ver?', 'Leer ajustes', 1)
f.chain('Cada mañana (radar)', 'Leer ajustes', '¿Radar encendido?')
f.link('¿Radar encendido?', 'Canales (radar)', 0)
f.chain('Canales (radar)', 'Pedidos de radar', '¿Hay canales?')
f.link('¿Hay canales?', 'vidIQ: radar', 0)
f.chain('vidIQ: radar', 'Encargo del analista', 'Analista de tendencias', 'Radar del canal', 'Solo tendencias', 'Guardar tendencias')
f.link('Radar del canal', 'Mensaje de radar')
f.link('Mensaje de radar', 'Aviso: radar')
RADAR = f.dump()

# ======================================================================================
# F · Vigilante de errores: cualquier flujo que falle te avisa por Telegram (flujo, nodo, error y enlace).
# ======================================================================================
f = Flow(W['errores'], 'F · Vigilante de errores')
f.add('Error en un flujo', 'n8n-nodes-base.errorTrigger', 1, {})
code(f, 'Mensaje de error', r"""
// Aviso claro en español: qué se detuvo, en qué paso, por qué (traducido) y un enlace corto al detalle.
const e = $json; const ex = e.execution || {}; const wf = e.workflow || {};
const original = String(ex.error?.message || e.trigger?.error?.message || 'error sin mensaje').replace(/\s+/g, ' ').trim();
const nodo = ex.lastNodeExecuted || ex.error?.node?.name || e.trigger?.error?.node?.name || '¿?';
const motivos = [
  [/too many requests|rate.?limit|\b429\b|resource.?exhausted/i, 'el servicio pidió ir más despacio (demasiadas solicitudes seguidas).'],
  [/timed? ?out|timeout|ETIMEDOUT/i, 'el servicio tardó demasiado en responder.'],
  [/\b401\b|unauthori[sz]ed|invalid api key|incorrect api key|authentication/i, 'una clave fue rechazada: revisa la credencial de ese servicio.'],
  [/\b402\b|insufficient|quota|billing|credits?/i, 'no hay saldo o créditos suficientes en el servicio.'],
  [/ENOTFOUND|ECONNREFUSED|ECONNRESET|socket hang up|network/i, 'no hubo conexión con el servicio.'],
  [/\b5\d\d\b|internal server error|bad gateway|service unavailable/i, 'el servicio externo tuvo una falla de su lado.'],
  [/not supported|bad request|\b400\b/i, 'el servicio rechazó el pedido (formato o parámetros).'],
];
const motivo = (motivos.find(([r]) => r.test(original)) || [null, null])[1];
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nombre = String(wf.name || wf.id || 'un flujo').replace(/^(F|FX|M\d+(–M\d+)?) · /, '');
const texto = `⚠️ <b>Se detuvo: ${esc(nombre)}</b>\nPaso: ${esc(nodo)}\nMotivo: ${esc(motivo || original.slice(0, 300))}`
  + (motivo ? `\n<i>${esc(original.slice(0, 160))}</i>` : '') + (ex.retryOf ? '\n(era un reintento)' : '')
  + (ex.url ? `\n<a href="${esc(ex.url)}">Ver el detalle</a>` : '');
return [{ json: { texto } }];
""")
f.add('Avisar error', 'n8n-nodes-base.telegram', 1.2,
      {'resource': 'message', 'operation': 'sendMessage', 'chatId': '8667738444', 'text': '={{ $json.texto.slice(0, 3900) }}',
       'additionalFields': {'disable_web_page_preview': True, 'appendAttribution': False, 'parse_mode': 'HTML'}}, credentials=CRED_TG)
f.chain('Error en un flujo', 'Mensaje de error', 'Avisar error')
ERRORES = f.dump()

# ======================================================================================
# Escala: ritmo (lotes) y reintentos en las llamadas que salen en masa.
# Con muchos canales a la vez, cada nodo por-ítem respeta los límites de cada API en lugar de dispararlo todo junto.
# (tamaño de lote, pausa en ms, reintentos). Reintentos solo donde repetir no duplica gasto ni publicaciones.
# ======================================================================================
# ======================================================================================
# FX · Pendientes: decisiones que esperan al operador, con su enlace (para el chat web y Telegram)
# ======================================================================================
f = Flow(W['pendientes'], 'FX · Pendientes')
trigger(f)
f.add('Pendientes', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('aprobaciones'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'pendiente'}]},
       'returnAll': True}, alwaysOutputData=True)
code(f, 'Lista', r"""
const filas = $input.all().map(i => i.json).filter(r => r.url && r.estado === 'pendiente')
  .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
if (!filas.length) return [{ json: { texto: 'No hay nada esperando tu decisión.' } }];
const nombre = { canal: 'Canal propuesto', guion: 'Guion', storyboard: 'Storyboard', final: 'Video final', gasto: 'Permiso de gasto' };
const lineas = filas.map((r, i) => `${i + 1}. ${nombre[r.etapa] || r.etapa}${r.video_id ? ' · ' + r.video_id : ''}${r.canal_id ? ' (' + r.canal_id + ')' : ''}\n   ${String(r.resumen || '').split('\n')[0].slice(0, 140)}\n   Decidir: ${r.url}`);
return [{ json: { texto: `Esperan tu decisión (${filas.length}):\n\n` + lineas.join('\n\n') } }];
""")
f.chain('Inicio', 'Pendientes', 'Lista')
PEND = f.dump()

# ======================================================================================
# FX · Reenviar pendientes: vuelve a mandar cada aprobación pendiente con su mismo enlace si sigue viva.
# Si su ejecución ya no espera (se reintentó, se detuvo), la anula y la rehace igual con un enlace nuevo.
# El permiso de gasto vive dentro de la producción: si murió, no se puede rehacer aquí y se avisa.
# ======================================================================================
f = Flow(W['reenviar'], 'FX · Reenviar pendientes')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
f.add('Pendientes', 'n8n-nodes-base.dataTable', 1.1,
      {'resource': 'row', 'operation': 'get', 'dataTableId': rl('aprobaciones'), 'matchType': 'allConditions',
       'filters': {'conditions': [{'keyName': 'estado', 'condition': 'eq', 'keyValue': 'pendiente'}]}, 'returnAll': True},
      alwaysOutputData=True, executeOnce=True)
code(f, 'Elegir', r"""
const vid = String($('Inicio').first().json.video_id || '').trim();
const l = $input.all().map(i => i.json).filter(r => r.url && r.estado === 'pendiente' && (!vid || r.video_id === vid));
return l.length ? l.map(r => ({ json: { ...r, prueba: r.url.replace(/^https?:\/\/[^/]+/, 'http://127.0.0.1:5678') } })) : [{ json: { nada: true } }];
""")
iff(f, '¿Hay pendientes?', '$json.nada !== true')
f.add('Probar enlace', 'n8n-nodes-base.httpRequest', 4.2,
      {'method': 'GET', 'url': '={{ $json.prueba }}', 'options': {'timeout': 20000, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
      onError='continueRegularOutput')
code(f, 'Diagnóstico', r"""
// Vivo = el formulario todavía se puede llenar (200 con <form>). Respondido, detenido o firma rota (401) = muerto.
const filas = $('Elegir').all().map(i => i.json);
return $input.all().map((it, k) => { const r = filas[k]; const cuerpo = String(it.json.data ?? it.json.body ?? '');
  const vivo = Number(it.json.statusCode) === 200 && /<form/i.test(cuerpo);
  const rehacer = !vivo && !!r.pedido;
  return { json: { ...r, vivo, rehacer, salida: vivo ? 0 : rehacer ? 1 : 2 } }; });
""")
switch(f, 'Según diagnóstico', 3)
f.add('Reenviar tarjeta', 'n8n-nodes-base.telegram', 1.2,
      {'resource': 'message', 'operation': 'sendMessage', 'chatId': "={{ $('Leer ajustes').first().json.chatId }}",
       'text': tg_texto("={{ '🔁 ' + ($json.aviso || $json.resumen || 'Aprobación pendiente') }}"), 'replyMarkup': 'inlineKeyboard',
       'inlineKeyboard': {'rows': [{'row': {'buttons': [{'text': '📝 Revisar y decidir', 'additionalFields': {'url': '={{ $json.url }}'}}]}}]},
       'additionalFields': dict(TG_OPC)},
      credentials=CRED_TG, onError='continueRegularOutput')
code(f, 'Anular', "return $input.all().map(i => ({ json: { aprobacion_id: i.json.aprobacion_id, estado: 'anulado', decidido_en: new Date().toISOString(), cambios: 'enlace muerto: rehecha con «reenviar»' } }));")
dt_update(f, 'Anular en la tabla', 'aprobaciones', 'aprobacion_id', '={{ $json.aprobacion_id }}')
code1(f, 'Pedido original', "return { json: JSON.parse($json.pedido) };")
call(f, 'Rehacer aprobación', W['aprob'], wait=False, each=True)
code(f, 'Resultado', r"""
if (!$('Diagnóstico').isExecuted) return [{ json: { texto: 'No hay aprobaciones pendientes' + ($('Inicio').first().json.video_id ? ' de ' + $('Inicio').first().json.video_id : '') + '.' } }];
const d = $('Diagnóstico').all().map(i => i.json); const nombre = r => `${r.etapa}${r.video_id ? ' · ' + r.video_id : ''}`;
const l = [];
const vivos = d.filter(r => r.vivo), rehechos = d.filter(r => r.rehacer), perdidos = d.filter(r => !r.vivo && !r.rehacer);
if (vivos.length) l.push('Reenviadas con su mismo enlace: ' + vivos.map(r => `${nombre(r)} (${r.url})`).join('; '));
if (rehechos.length) l.push('Enlace muerto, rehechas con enlace nuevo (llega en un momento): ' + rehechos.map(nombre).join(', '));
if (perdidos.length) l.push('No se pueden rehacer (su proceso se detuvo; pide «corregir» o crea el video de nuevo): ' + perdidos.map(nombre).join(', '));
return [{ json: { texto: l.join('\n') } }];
""")
f.chain('Inicio', 'Leer ajustes', 'Pendientes', 'Elegir', '¿Hay pendientes?')
f.link('¿Hay pendientes?', 'Probar enlace', 0)
f.link('¿Hay pendientes?', 'Resultado', 1)
f.chain('Probar enlace', 'Diagnóstico', 'Según diagnóstico')
f.link('Según diagnóstico', 'Reenviar tarjeta', 0)
f.link('Según diagnóstico', 'Anular', 1)
f.link('Según diagnóstico', 'Resultado', 2)
f.chain('Anular', 'Anular en la tabla')
f.link('Según diagnóstico', 'Pedido original', 1)
f.chain('Pedido original', 'Rehacer aprobación')
f.link('Reenviar tarjeta', 'Resultado')
f.link('Rehacer aprobación', 'Resultado')
REENVIAR = f.dump()

# ======================================================================================
# F · Chat de la fábrica: el mismo agente de Telegram, desde la computadora (página de chat de n8n con usuario y clave)
# ======================================================================================
f = Flow(W['chat'], 'F · Chat de la fábrica (computadora)')
f.add('Chat', '@n8n/n8n-nodes-langchain.chatTrigger', 1.4,
      {'public': True, 'mode': 'hostedChat', 'authentication': 'basicAuth',
       'initialMessages': 'Hola, soy el operador de la fábrica. Pídeme un video, el estado, un reporte o «¿qué hay pendiente?» para aprobar desde aquí.',
       'options': {'title': 'Fábrica de videos', 'subtitle': 'Control desde la computadora · lo mismo que Telegram',
                   'inputPlaceholder': 'Escribe una orden…', 'responseMode': 'lastNode', 'loadPreviousSession': 'notSupported'}},
      credentials=CRED_OPERADOR, webhookId='fabrica-chat-web-0001')
code(f, 'A agente', "return [{ json: { texto: String($json.chatInput || '').slice(0, 4000), chatId: 'web-' + String($json.sessionId || 'computadora').slice(0, 60) } }];")
call(f, 'Agente', W['agente'])
code(f, 'Respuesta', "return [{ json: { output: String($json.respuesta || 'Listo.') } }];")
f.chain('Chat', 'A agente', 'Agente', 'Respuesta')
CHAT = f.dump()


RITMO = {
    'FabProduccion001': {'Buscar en Pexels': (5, 1000, 3), 'Buscar en Pixabay': (5, 1200, 3), 'Generar imagen': (4, 1500, 2),
                         'Animar (Gemini Omni)': (2, 3000, 2), 'Subir a Drive': (5, 500, 3), 'Nombrar en Drive': (5, 300, 3),
                         'Compartir enlace': (5, 300, 3), 'Revisar plano': (4, 1000, 2), 'Revisar archivo': (4, 1000, 2), 'Consultar render': (1, 0, 3),
                         'Carpeta del canal: buscar': (1, 0, 3), 'Encargo: nombrar': (3, 300, 3)},
    'FabSonido0000001': {'Voz (Gemini TTS)': (1, 6500, 5),   # Gemini TTS respondió «too many requests» con 16 voces a 5/s; ~9 por minuto 'Subir voz a Drive': (5, 500, 3), 'Nombrar voz': (5, 300, 3),
                         'Compartir voz': (5, 300, 3), 'Buscar efecto': (3, 800, 3), 'Pedir efecto': (3, 800, 3)},
    'FabDerivados0001': {'Renderizar corte': (3, 1000, 0), 'Consultar cortes': (3, 300, 3), 'Consultar otra vez': (3, 300, 3),
                         'Nombrar base': (1, 0, 3), 'Compartir base': (1, 0, 3)},
    'FabReferencias01': {'Generar principal': (4, 1500, 2), 'Generar vista': (4, 1500, 2), 'Subir principal': (5, 500, 3),
                         'Subir vista': (5, 500, 3), 'Nombrar principal': (5, 300, 3), 'Nombrar vista': (5, 300, 3),
                         'Compartir principal': (5, 300, 3), 'Compartir vista': (5, 300, 3)},
    'FabRedes00000001': {'Subir a redes': (3, 1500, 2), 'Estado en redes': (5, 500, 3)},
    'FabAprendizaje01': {'Retención': (5, 1000, 3), 'Métricas en redes': (5, 1000, 3)},
    'FabVidiq00000001': {'Puntuar título': (2, 500, 2)},
    'FabYouTube000001': {'Canal en YouTube': (1, 0, 3), 'Qué canal es': (1, 0, 2)},
}
for wf in [AJUSTES, CLAUDE, RETORNO, APROB, ORQ, PROD, SONIDO, PUB, APRENDE, ESTADO, REFS, YT, VIDIQ, DERIV, REDES, AGENTE]:
    for n in wf['nodes']:
        if n['type'].endswith('httpRequest'):
            n['parameters'].setdefault('options', {}).setdefault('timeout', 60000)   # ninguna llamada queda colgada
        r = RITMO.get(wf['id'], {}).get(n['name'])
        if not r:
            continue
        lote, pausa, intentos = r
        assert n['type'].endswith('httpRequest'), n['name']
        if lote > 1 or pausa:
            n['parameters'].setdefault('options', {})['batching'] = {'batch': {'batchSize': lote, 'batchInterval': pausa}}
        if intentos:
            n.update({'retryOnFail': True, 'maxTries': max(n.get('maxTries', 0), intentos), 'waitBetweenTries': max(n.get('waitBetweenTries', 0), 3000)})
faltan = [(w, x) for w, d in RITMO.items() for x in d if x not in {n['name'] for wf in [PROD, SONIDO, DERIV, REFS, REDES, APRENDE, VIDIQ, YT] if wf['id'] == w for n in wf['nodes']}]
assert not faltan, faltan

# ======================================================================================
# FX · API de Cooper. Contrato privado; ninguna llamada al editor/API pública de n8n.
# ======================================================================================
CONTRATO_COOPER = json.load(open(os.path.join(RAIZ, 'cooper/src/contratos/cooper-v1.json'), encoding='utf-8'))
W.update({'cooper': 'FabCooperAPI0001', 'progreso': 'FabCooperProgr01', 'costo': 'FabCooperCosto01'})

def cooper_js(nombre):
    with open(os.path.join(RAIZ, 'tools/cooper', nombre + '.js'), encoding='utf-8') as fh:
        return 'const CONTRATO = ' + json.dumps(CONTRATO_COOPER, ensure_ascii=False) + ';\n' + fh.read()

def reabrir(wf):
    f = Flow(wf['id'], wf['name'])
    f.nodes, f.conn = wf['nodes'], wf['connections']
    return f

def antes(f, destino, primero, ultimo):
    for src, kinds in list(f.conn.items()):
        if src == ultimo:
            continue
        for edges in kinds.get('main', []):
            for edge in edges:
                if edge['node'] == destino:
                    edge['node'] = primero
    f.link(ultimo, destino)

def despues(f, origen, primero, ultimo):
    salidas = f.conn.pop(origen, {'main': [[]]})
    f.conn[ultimo] = salidas
    f.link(origen, primero)

def firmar_cooper(f, nombre, cuerpo):
    code(f, nombre, r"""
const secret = String($env.COOPER_WEBHOOK_SECRET || '');
if (secret.length < 32) throw new Error('Falta COOPER_WEBHOOK_SECRET');
const cuerpo = JSON.stringify(%s), timestamp = String(Date.now());
const firma = require('crypto').createHmac('sha256', secret).update(timestamp + '.' + cuerpo).digest('hex');
return [{ json: { cuerpo, timestamp, firma: 'sha256=' + firma } }];
""" % cuerpo)

def enviar_cooper(f, nombre):
    http(f, nombre, 'POST', "={{ $env.COOPER_WEBHOOK_URL }}", auth=False, timeout=10000,
         headers={'Content-Type': 'application/json', 'x-cooper-timestamp': '={{ $json.timestamp }}', 'x-cooper-signature': '={{ $json.firma }}'})
    f.nodes[-1]['parameters'].update({'sendBody': True, 'contentType': 'raw', 'rawContentType': 'application/json', 'body': '={{ $json.cuerpo }}'})
    f.nodes[-1].update({'retryOnFail': True, 'maxTries': 5, 'waitBetweenTries': 2000})

def lista_cooper(f, nombre, tabla, filtros=None):
    f.add(nombre, 'n8n-nodes-base.dataTable', 1.1, {'resource': 'row', 'operation': 'get', 'dataTableId': rl(tabla),
          'matchType': 'allConditions', 'filters': {'conditions': filtros or []}, 'returnAll': True}, alwaysOutputData=True, executeOnce=True)

f = Flow(W['cooper'], 'FX · API de Cooper')
f.add('Solicitud de Cooper', 'n8n-nodes-base.webhook', 2,
      {'httpMethod': 'POST', 'path': 'cooper/v1', 'responseMode': 'responseNode', 'options': {}}, webhookId=nid())
code(f, 'Autenticar', cooper_js('autenticar'))
iff(f, '¿Autorizado?', '$json.status === 200')
iff(f, '¿Consultar recibo?', "!['estado','reporte','pendientes','tendencias','gastos'].includes($('Autenticar').first().json.solicitud.evento)")
firmar_cooper(f, 'Firmar consulta de orden', "({ version:'cooper-v1', tipo:'orden', id_evento:$('Autenticar').first().json.solicitud.id_evento, ejecucion:String($execution.id), fase:'consultar', solicitud:$('Autenticar').first().json.solicitud })")
enviar_cooper(f, 'Consultar orden')
switch(f, 'Recibo anterior', 3, "({ nueva:0, confirmada:1, pendiente:2 })[$json.estado] ?? 2")
for nombre, tabla in [('Canales autorizados','canales'), ('Videos autorizados','videos')]:
    lista_cooper(f, nombre, tabla, [{'keyName': 'dueno_email', 'condition': "={{ $('Autenticar').first().json.admin ? 'isNotEmpty' : 'eq' }}",
                                  'keyValue': "={{ $('Autenticar').first().json.dueno_email }}"}])
# Las decisiones se proyectan después de comprobar el video; jamás se devuelven enlaces/formularios internos.
lista_cooper(f, 'Aprobaciones', 'aprobaciones', [{'keyName':'estado','condition':'eq','keyValue':'pendiente'}, {'keyName':'video_id','condition':'eq','keyValue':"={{ $('Autenticar').first().json.solicitud.datos.id || '__ninguno__' }}"}])
code(f, 'Resolver', PRESENTACION_JS + open(os.path.join(RAIZ,'tools/cooper/observabilidad.js'), encoding='utf-8').read() + cooper_js('resolver'))
switch(f, 'Tipo de petición', 3, "({ responder:0, gastos:1, orden:2 })[$json.accion]")
lista_cooper(f, 'Costos administrativos', 'costos')
code(f, 'Agregar gastos', cooper_js('gastos'))
firmar_cooper(f, 'Firmar reserva', "({ version:'cooper-v1', tipo:'orden', id_evento:$('Autenticar').first().json.solicitud.id_evento, ejecucion:String($execution.id), fase:'reservar', solicitud:$('Autenticar').first().json.solicitud })")
enviar_cooper(f, 'Reservar orden')
switch(f, 'Estado de reserva', 3, "({ reservada:0, confirmada:1, pendiente:2 })[$json.estado] ?? 2")
code(f, 'Evento del Orquestador', "return [{ json: $('Resolver').first().json.evento }];")
call(f, 'Entregar al Orquestador', W['orq'], wait=False)
firmar_cooper(f, 'Firmar confirmación', "({ version:'cooper-v1', tipo:'orden', id_evento:$('Autenticar').first().json.solicitud.id_evento, ejecucion:String($execution.id), fase:'confirmar', solicitud:$('Autenticar').first().json.solicitud })")
enviar_cooper(f, 'Confirmar orden')
code(f, 'Aceptado', "return [{ json: { status:200, respuesta:{ aceptado:true } } }];")
code(f, 'En proceso', "return [{ json: { status:409, respuesta:{ error:'Orden pendiente de confirmación' } } }];")
f.add('Responder', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith':'json','responseBody':'={{ $json.respuesta }}','options':{'responseCode':'={{ $json.status }}'}})
f.chain('Solicitud de Cooper','Autenticar','¿Autorizado?')
f.link('¿Autorizado?','¿Consultar recibo?',0); f.link('¿Autorizado?','Responder',1)
f.link('¿Consultar recibo?','Firmar consulta de orden',0); f.link('¿Consultar recibo?','Canales autorizados',1)
f.chain('Firmar consulta de orden','Consultar orden','Recibo anterior')
f.link('Recibo anterior','Canales autorizados',0); f.link('Recibo anterior','Aceptado',1); f.link('Recibo anterior','En proceso',2)
f.chain('Canales autorizados','Videos autorizados','Aprobaciones','Resolver','Tipo de petición')
f.link('Tipo de petición','Responder',0); f.link('Tipo de petición','Costos administrativos',1); f.link('Tipo de petición','Firmar reserva',2)
f.chain('Costos administrativos','Agregar gastos','Responder')
f.chain('Firmar reserva','Reservar orden','Estado de reserva')
f.link('Estado de reserva','Evento del Orquestador',0); f.link('Estado de reserva','Aceptado',1); f.link('Estado de reserva','En proceso',2)
f.chain('Evento del Orquestador','Entregar al Orquestador','Firmar confirmación','Confirmar orden','Aceptado','Responder')
f.link('En proceso','Responder')
COOPER = f.dump()
# El webhook transporta cabeceras privadas: no conservar input/output de ejecuciones.
COOPER['settings'].update({'saveDataErrorExecution':'none','saveDataSuccessExecution':'none','saveExecutionProgress':False})

# Un costo por paso, con dueño obtenido de la tabla (no del modelo ni del navegador).
f = Flow(W['costo'], 'FX · Registrar costo por dueño')
trigger(f)
dt_get(f, 'Video del costo','videos','video_id', "={{ $('Inicio').first().json.video_id }}")
dt_get(f, 'Canal del costo','canales','canal_id', "={{ $('Video del costo').first().json.canal_id || String($('Inicio').first().json.video_id || '').replace(/^canal:/, '') }}")
code(f, 'Costo atribuido', r"""
const c = $('Inicio').first().json, v = $('Video del costo').first().json, canal = $('Canal del costo').first().json;
const dueno = v.dueno_email || canal.dueno_email || (c.video_id === 'canal:' ? String($env.COOPER_ADMIN_EMAIL || '') : '');
if (!dueno || (c.video_id !== 'canal:' && !canal.dueno_email)) throw new Error('Costo sin dueño: completar la migración antes de producir');
const usd = Number(c.usd); if (!Number.isFinite(usd) || usd < 0) throw new Error('Costo inválido');
return [{ json: { video_id: c.video_id, concepto: c.concepto, servicio: c.servicio, usd,
  dueno_email: dueno, estimado: c.estimado !== false,
  paso_id: c.paso_id || String($execution.id) } }];
""")
dt_insert(f, 'Guardar costo atribuido','costos')
f.chain('Inicio','Video del costo','Canal del costo','Costo atribuido','Guardar costo atribuido')
COSTO_COOPER = f.dump()
# Convertir todos los insert existentes de costos en llamadas a la atribución común.
for wf in [ORQ, PROD, REFS, RADAR, VIDIQ, DERIV, SONIDO, APRENDE]:
    for n in wf['nodes']:
        if n['type'].endswith('.dataTable') and n['parameters'].get('operation') == 'insert' and n['parameters']['dataTableId']['value'] == T['costos']:
            tmp = Flow('temp','temp'); call(tmp,n['name'],W['costo'],each=True)
            n.update({'type':tmp.nodes[0]['type'],'typeVersion':tmp.nodes[0]['typeVersion'],'parameters':tmp.nodes[0]['parameters']})

# Emisor de progreso. Recibe la fila completa después de persistir la etapa.
f = Flow(W['progreso'], 'FX · Progreso de Cooper')
trigger(f)
iff(f, '¿Tiene dueño?', "!!$json.dueno_email && !!$json.video_id && !$json.eliminado")
code(f, 'Progreso público', 'const ETAPAS = ' + json.dumps(CONTRATO_COOPER['etapas']) + ';\n' + r"""
const v = $('Inicio').first().json;
return [{ json: { version:'cooper-v1', tipo:'progreso', id_evento: v.cooper_evento_id || ('video:' + v.video_id + ':' + v.updatedAt),
  video: { id:v.video_id, dueno_email:v.dueno_email, canal_id:v.canal_id, titulo:String(v.tema || ''),
    modo_noticia:v.modo_noticia === true, stage:ETAPAS[v.etapa] ?? 0, script:String(v.guion_cooper || '').slice(0,30000), actualizado_en:Number(v.cooper_actualizado_en) || Date.parse(v.updatedAt) } } }];
""")
firmar_cooper(f,'Firmar progreso',"$('Progreso público').first().json")
enviar_cooper(f,'Avisar a Cooper')
code(f,'Conservar fila',"return [{ json: $('Inicio').first().json }];")
f.chain('Inicio','¿Tiene dueño?'); f.link('¿Tiene dueño?','Progreso público',0); f.link('¿Tiene dueño?','Conservar fila',1)
f.chain('Progreso público','Firmar progreso','Avisar a Cooper','Conservar fila')
PROGRESO_COOPER = f.dump()

# Registrar una etapa antes de un paso, conservando su entrada para no cambiar el contrato interno.
def etapa_cooper(wf, destino, etapa, video_expr="$('Inicio').first().json.video_id", guion=None):
    f = reabrir(wf); p = 'Cooper · ' + destino
    code(f,p+' entrada','return $input.all();')
    fields = "{ etapa:'" + etapa + "'" + (", guion_cooper: String(" + guion + ").slice(0,30000)" if guion else '') + " }"
    code(f,p+' etapa', 'return [{ json: ' + fields + ' }];')
    dt_update(f,p+' guardar','videos','video_id','={{ ' + video_expr + ' }}')
    # Si la tabla no encuentra fila, conservar el flujo legado. La etapa sigue sin inventarse.
    f.nodes[-1]['alwaysOutputData'] = True
    code(f,p+' seguir',"return $('" + p + " entrada').all();")
    f.chain(p+' entrada',p+' etapa',p+' guardar',p+' seguir')
    antes(f,destino,p+' entrada',p+' seguir')

etapa_cooper(ORQ,'Verificar cifras','verificacion')
etapa_cooper(ORQ,'Aprobar guion','aprobacion_guion',guion="$('Inicio').first().json.resultado?.guion || ''")
etapa_cooper(ORQ,'Claude: corregir','guion')
etapa_cooper(ORQ,'Claude: corregir (crítico)','guion')
etapa_cooper(PROD,'Sonido y emoción','sonido')
etapa_cooper(PROD,'Composición Creatomate','montaje')
etapa_cooper(PUB,'Aprobación final','aprobacion_final')

# Cooper guarda decisiones de guion/final sin abrir un segundo formulario que pueda aprobar dos veces.
f = reabrir(APROB)
dt_get(f,'Cooper · dueño','videos','video_id',"={{ $('Inicio').first().json.video_id || '' }}")
iff(f,'¿Decide Cooper?',"!!$json.dueno_email && ['guion','final'].includes($('Inicio').first().json.etapa)")
# La preparación/registro originales se conservan, solo se evita esperar formulario para estas dos puertas.
antes(f,'Aprobación · preparar','Cooper · dueño','Cooper · dueño')
despues(f,'Aprobación · registrar','¿Decide Cooper?','¿Decide Cooper?')
# Evaluar sobre la fila original, no sobre el registro de aprobación.
next(n for n in f.nodes if n['name']=='¿Decide Cooper?')['parameters']['conditions']['conditions'][0]['leftValue'] = "={{ !!$('Cooper · dueño').first().json.dueno_email && ['guion','final'].includes($('Inicio').first().json.etapa) }}"
f.conn['¿Decide Cooper?'] = {'main':[[],[{'node':'Aprobación · avisar','type':'main','index':0}]]}

# No convertir una decisión de Cooper en un formulario reenviado por el flujo legado.
for n in APROB['nodes']:
    if n['name'] == 'Aprobación · preparar':
        n['parameters']['jsCode'] = n['parameters']['jsCode'].replace("url: $execution.resumeFormUrl", "url: ($('Cooper · dueño').isExecuted && $('Cooper · dueño').first().json.dueno_email && ['guion','final'].includes($('Inicio').first().json.etapa)) ? '' : $execution.resumeFormUrl")

# El identificador de Cooper y el dueño sobreviven al trabajo asíncrono de investigación y a su aprobación.
def cambiar(wf,nombre,viejo,nuevo):
    n = next(n for n in wf['nodes'] if n['name']==nombre)
    assert viejo in n['parameters']['jsCode'], (nombre,viejo)
    n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(viejo,nuevo)
cambiar(ORQ,'Pedir nichos',"canal_id:'', video_id:''","canal_id:e.canal_id || '', dueno_email:e.dueno_email || '', video_id:''")
f = reabrir(CLAUDE)
dt_get(f, 'Video del trabajo', 'videos', 'video_id', "={{ $('Preparar trabajo').first().json.fila.video_id || '' }}")
dt_get(f, 'Canal del trabajo', 'canales', 'canal_id', "={{ $('Video del trabajo').first().json.canal_id || $('Preparar trabajo').first().json.fila.canal_id || '' }}")
code(f, 'Atribuir trabajo', r"""
const fila = $('Preparar trabajo').first().json.fila;
const video = $('Video del trabajo').first().json, canal = $('Canal del trabajo').first().json;
const dueno = video.dueno_email || canal.dueno_email || (!fila.video_id && !fila.canal_id ? String($env.COOPER_ADMIN_EMAIL || '') : '');
if (!dueno || fila.video_id && !video.dueno_email || (fila.canal_id || video.canal_id) && !canal.dueno_email ||
    video.dueno_email && canal.dueno_email !== video.dueno_email) throw new Error('Trabajo sin dueño válido: completar la migración');
return [{json:{...fila, canal_id:video.canal_id || fila.canal_id, dueno_email:dueno}}];
""")
f.chain('Video del trabajo', 'Canal del trabajo', 'Atribuir trabajo')
antes(f, 'Registrar trabajo', 'Video del trabajo', 'Atribuir trabajo')
cambiar(RETORNO,'Evento',"video_id: t.video_id || ''","dueno_email: t.dueno_email || '', video_id: t.video_id || ''")
cambiar(ORQ,'Mensaje de canal',"etapa: 'canal', mensaje:","dueno_email: $('Inicio').first().json.dueno_email || '', canal_id: $('Inicio').first().json.canal_id || '', etapa: 'canal', mensaje:")
cambiar(ORQ,'Nuevo canal',"const canal_id = (c.nombre_propuesto", "const canal_id = $json.canal_id || (c.nombre_propuesto")
cambiar(ORQ,'Nuevo canal','json: { canal_id, nombre:',"json: { dueno_email: $json.dueno_email || '', canal_id, nombre:")
cambiar(ORQ,'Nuevo video',"const video_id = 'v-'", "const video_id = e.video_id || 'v-'")
cambiar(ORQ,'Nuevo video','fila: { presentacion:',"fila: { dueno_email: canal.dueno_email || '', presentacion:")
cambiar(ORQ,'Pedir adopción',"canal_id: '', video_id: ''", "canal_id: $('Inicio').first().json.canal_id || '', dueno_email: $('Inicio').first().json.dueno_email || '', video_id: ''")
# Los canales nuevos de Cooper quedan reservados mientras se investiga (sin habilitar producción).
f = reabrir(ORQ)
code(f,'Cooper · reservar canal',"const e=$('Inicio').first().json; return e.cooper ? [{ json:{ canal_id:e.canal_id, dueno_email:e.dueno_email, nombre:e.nombre || e.canal_id, nicho:e.criterios || '', estado:'investigando' } }] : [{json:{}}];")
iff(f,'¿Canal de Cooper?',"$('Inicio').first().json.cooper === true")
dt_insert(f,'Cooper · guardar reserva','canales')
code(f,'Cooper · pedido original',"return [{ json: $('Inicio').first().json }];")
antes(f,'Pedir nichos','¿Canal de Cooper?','Cooper · pedido original')
f.link('¿Canal de Cooper?','Cooper · reservar canal',0); f.link('¿Canal de Cooper?','Cooper · pedido original',1)
f.chain('Cooper · reservar canal','Cooper · guardar reserva','Cooper · pedido original')
# La aprobación actualiza la reserva en vez de insertar otra identidad.
n = next(n for n in ORQ['nodes'] if n['name']=='Guardar canal')
n['parameters'].update({'operation':'upsert','matchType':'allConditions','filters':{'conditions':[{'keyName':'canal_id','condition':'eq','keyValue':'={{ $json.canal_id }}'}]}})
# Cerrar la decisión y avanzar la etapa antes de cualquier publicación/producción.
for nombre, etapa in [('Canal del video','storyboard'),('Video (publicar)','programado')]:
    etapa_cooper(ORQ,nombre,etapa)
f = reabrir(ORQ)
for destino in ['Canal del video','Video (publicar)']:
    # La decisión solo tiene ID cuando viene de Cooper. Los formularios legados ya se cierran solos.
    p = 'Cooper · cerrar ' + destino
    iff(f,p+' si',"!!$('Inicio').first().json.aprobacion_id")
    code(f,p+' fila',"return [{json:{estado:'decidida',decidido_en:new Date().toISOString()}}];")
    dt_update(f,p+' guardar','aprobaciones','aprobacion_id',"={{ $('Inicio').first().json.aprobacion_id }}")
    code(f,p+' seguir',"return [{json:$('Inicio').first().json}];")
    antes(f,destino,p+' si',p+' seguir'); f.link(p+' si',p+' fila',0); f.link(p+' si',p+' seguir',1)
    f.chain(p+' fila',p+' guardar',p+' seguir')

# Eliminación lógica: retener trazabilidad y gasto; impedir consultas y nuevas acciones.
f = reabrir(ORQ)
ruta = next(n for n in f.nodes if n['name']=='Ruta')
ruta['parameters']['jsCode'] = ruta['parameters']['jsCode'].replace(json.dumps(RUTAS),json.dumps(RUTAS[:-1]+['eliminar','otro']))
next(n for n in f.nodes if n['name']=='Según evento')['parameters']['numberOutputs'] += 1
f.conn['Según evento']['main'].append(f.conn['Según evento']['main'][22]); f.conn['Según evento']['main'][22] = []
code(f,'Cooper · eliminar',"return [{json:{eliminado:true}}];")
iff(f,'¿Eliminar canal?',"$('Inicio').first().json.tipo === 'canal'")
dt_update(f,'Cooper · eliminar canal','canales','canal_id',"={{ $('Inicio').first().json.id }}")
dt_update(f,'Cooper · eliminar videos del canal','videos','canal_id',"={{ $('Inicio').first().json.id }}")
dt_update(f,'Cooper · eliminar video','videos','video_id',"={{ $('Inicio').first().json.id }}")
# Cada actualización recibe solo columnas admitidas.
code(f,'Cooper · marca cascada',"return [{json:{eliminado:true}}];")
f.link('Según evento','Cooper · eliminar',22); f.chain('Cooper · eliminar','¿Eliminar canal?')
f.link('¿Eliminar canal?','Cooper · eliminar canal',0); f.link('¿Eliminar canal?','Cooper · eliminar video',1)
f.chain('Cooper · eliminar canal','Cooper · marca cascada','Cooper · eliminar videos del canal')

# Extensión de presentación, antes de los sellos y de la atribución de costos.
exec(compile(open(os.path.join(RAIZ, 'tools/cooper/presentacion_flujos.py'), encoding='utf-8').read(), 'presentacion_flujos.py', 'exec'))

# Registro al terminar cada llamada, incluso si un paso posterior falla. El total del video
# sigue siendo una estimación visual; no vuelve a insertarse como un segundo gasto.
for wf, nombres in [(PROD,['Guardar costos','Guardar costo de derivados']), (REFS,['Guardar costo de referencias'])]:
    for n in wf['nodes']:
        if n['name'] in nombres:
            n.update({'type':'n8n-nodes-base.code','typeVersion':2,'parameters':{'jsCode':'return $input.all();'}})

PASOS_COSTO = [
    (AVATAR,'Crear avatar','avatar','HeyGen',"$('Inicio').first().json.voz.duracion_s * aj.costoAvatarSegUsd"),
    (SONIDO,'Voz (HeyGen)','voz','HeyGen',"$('Textos de voz').itemMatching(k).json.costo_voz_usd"),
    (SONIDO,'Voz (ElevenLabs)','voz','ElevenLabs',"$('Textos de voz').itemMatching(k).json.costo_voz_usd"),
    (PROD,'Generar imagen','imágenes','OpenAI',"aj.costoImagenUsd"),
    (PROD,'Revisar plano','revisión visual','OpenAI',"aj.costoRevisionUsd"),
    (PROD,'Revisar archivo','revisión de archivo','OpenAI',"aj.costoRevisionUsd"),
    (PROD,'Animar (Gemini Omni)','clips','Gemini Omni',"Number($('Un ítem por plano').itemMatching(k).json.plano?.duracion_clip_s || 8) * aj.costoClipSegUsd"),
    (PROD,'Renderizar','montaje','Creatomate (créditos)','0'),
    (SONIDO,'Voz (Gemini TTS)','voz','Gemini TTS','aj.costoVozUsdPorPlano'),
    (SONIDO,'Pedir descarga','música','Epidemic Sound (suscripción)','0'),
    (SONIDO,'Pedir efecto','efectos','Epidemic Sound (suscripción)','0'),
    (REFS,'Generar principal','referencia principal','OpenAI','aj.costoImagenUsd'),
    (REFS,'Generar vista','referencia vista','OpenAI','aj.costoImagenUsd'),
    (DERIV,'Imagen de miniatura','miniatura','OpenAI','aj.costoMiniaturaUsd'),
    (DERIV,'Renderizar miniatura','montaje de miniatura','Creatomate (créditos)','0'),
    (DERIV,'Renderizar corte','montaje de corte','Creatomate (créditos)','0'),
    (ORQ,'Crítico de nichos','crítico de nichos','OpenAI','aj.costoCriticoUsd'),
    (RADAR,'Analista de tendencias','radar','OpenAI','aj.costoRadarUsd'),
    (CLAUDE,'Respuesta','texto','Claude (plan)','0'),
]
for wf, origen, concepto, servicio, usd in PASOS_COSTO:
    f = reabrir(wf); p = 'Cooper · costo ' + origen
    # El radar lleva varios canales; conservar el emparejamiento por índice.
    vid = "('canal:' + $('Encargo del analista').all()[k].json.canal_id)" if wf['id']==W['radar'] else "(e.video_id || ('canal:' + e.canal_id))"
    code(f,p,"const e=$('Inicio').isExecuted ? $('Inicio').first().json : {}; const aj=$('Leer ajustes').first().json; return $input.all().map((i,k)=>({json:{ video_id:" + vid + ", concepto:" + JS(concepto) + ", servicio:" + JS(servicio) + ", usd:" + usd + ", estimado:true, paso_id:String($execution.id)+':'+" + JS(origen) + "+':'+$runIndex+':'+k }}));")
    call(f,p+' registrar',W['costo'],each=True)
    code(f,p+' seguir',"return $('" + origen + "').all().map((i,k) => ({...i, pairedItem:{item:k}}));")
    f.chain(p,p+' registrar',p+' seguir')
    # Solo salida de éxito; las salidas de error del HTTP mantienen su destino original.
    outs=f.conn.setdefault(origen,{'main':[[]]})['main']
    f.conn[p+' seguir']={'main':[outs[0]]}; outs[0]=[{'node':p,'type':'main','index':0}]
# Upsert por paso, durable frente al reintento de la escritura del mismo gasto.
n = next(n for n in COSTO_COOPER['nodes'] if n['name']=='Guardar costo atribuido')
n['parameters'].update({'operation':'upsert','matchType':'allConditions','filters':{'conditions':[{'keyName':'paso_id','condition':'eq','keyValue':'={{ $json.paso_id }}'}]}})

# También las filas heredadas de verificación/crítico reciben el ID del paso emisor.
for wf in [ORQ, PROD, REFS, RADAR, DERIV, SONIDO, CLAUDE, AVATAR]:
    f = reabrir(wf)
    for n in list(f.nodes):
        if n['type'].endswith('.executeWorkflow') and n['parameters']['workflowId']['value'] == W['costo']:
            nombre = 'Cooper · identificar ' + n['name']
            code(f,nombre,"return $input.all().map((i,k) => ({json:{...i.json, paso_id:i.json.paso_id || (String($execution.id)+':' + " + JS(n['name']) + " + ':' + $runIndex + ':' + k)}, pairedItem:{item:k}}));")
            antes(f,n['name'],nombre,nombre)

# Tiempo máximo por flujo (segundos; tu n8n permite hasta 3600) y vigilante de errores en todos.
TIEMPO = {'FabAvatar0000001': 1800, 'FabProduccion001': 3600, 'FabDerivados0001': 3600, 'FabSonido0000001': 1800, 'FabReferencias01': 1800,
          'FabRedes00000001': 1800, 'FabAprendizaje01': 1800, 'FabOrquestador01': 900, 'FabPublicacion01': 600, 'FabNoticia000001': 600, 'FabRadar00000001': 3600}
# Expresiones de n8n: un salto de línea real dentro de un texto entre comillas no es JavaScript válido
# (el crítico del guion fallaba en silencio por eso). Se escapan todos los que estén dentro de comillas.
def escapar_saltos(ex):
    out, q, esc = [], None, False
    for ch in ex:
        if q:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == q: q = None
            elif ch == '\n' and q in "'\"": out.append('\\n'); continue
        elif ch in "'\"`": q = ch
        out.append(ch)
    return ''.join(out)
def recorrer(v):
    if isinstance(v, dict): return {k: recorrer(x) for k, x in v.items()}
    if isinstance(v, list): return [recorrer(x) for x in v]
    if isinstance(v, str) and v.startswith('={{'): return escapar_saltos(v)
    return v
# Fase 6: texto por Codex y modo noticia (extensiones locales, sin despliegue).
for extension in ['texto_flujos.py', 'noticia_flujos.py', 'observabilidad_flujos.py', 'cobertura_flujos.py']:
    exec(compile(open(os.path.join(RAIZ, 'tools/cooper', extension), encoding='utf-8').read(), extension, 'exec'))

# Todas las escrituras de videos llevan sello durable y un callback con el mismo ID al reintentar.
for wf in [ORQ, PROD, PUB, REDES, CONFIRMAR, VALIDAR_PRESENTACION]:
    f = reabrir(wf)
    targets = [n for n in f.nodes if n['type'].endswith('.dataTable') and n['parameters'].get('operation') in ['insert','update'] and n['parameters']['dataTableId']['value'] == T['videos']]
    for n in targets:
        p = 'Cooper · sello ' + n['name']
        code(f,p,"return $input.all().map((i,k) => ({json:{...i.json, cooper_actualizado_en:Date.now(), cooper_evento_id:String($execution.id)+':' + " + JS(n['name']) + " + ':' + $runIndex + ':' + k }}));")
        antes(f,n['name'],p,p)
        call(f,p+' aviso',W['progreso'],each=True)
        despues(f,n['name'],p+' aviso',p+' aviso')
# Fuera del FX, las consultas legadas son del operador. Las filas eliminadas no se reactivan.
for wf in [ORQ, PROD, PUB, RADAR, RUTINA, REFS, REDES, YT]:
    for n in wf['nodes']:
        p=n['parameters']
        if n['type'].endswith('.dataTable') and p.get('operation') in ['get','update'] and p['dataTableId']['value'] in [T['videos'],T['canales']]:
            p.setdefault('filters',{}).setdefault('conditions',[]).append({'keyName':'eliminado','condition':'neq','keyValue':True})


for wf in [AJUSTES, CLAUDE, RETORNO, APROB, ORQ, PROD, SONIDO, PUB, APRENDE, ESTADO, REFS, YT, VIDIQ, DERIV, REDES, CONFIRMAR, RUTINA, RADAR, ERRORES, AGENTE, PEND, REENVIAR, CHAT, COOPER, COSTO_COOPER, PROGRESO_COOPER, VALIDAR_PRESENTACION, AVATAR, TEXTO, NOTICIA]:
    for n in wf['nodes']:
        n['parameters'] = recorrer(n['parameters'])

for wf in [AJUSTES, CLAUDE, RETORNO, APROB, ORQ, PROD, SONIDO, PUB, APRENDE, ESTADO, REFS, YT, VIDIQ, DERIV, REDES, CONFIRMAR, RUTINA, RADAR, AGENTE, PEND, REENVIAR, CHAT, COOPER, COSTO_COOPER, PROGRESO_COOPER, VALIDAR_PRESENTACION, AVATAR, TEXTO, NOTICIA]:
    wf['settings'].update({'executionTimeout': TIEMPO.get(wf['id'], 300), 'errorWorkflow': W['errores'],
                           'saveDataErrorExecution': 'none' if wf['id'] in [W['cooper'],W['texto']] else 'all', 'saveDataSuccessExecution': 'none' if wf['id'] in [W['cooper'],W['texto']] else 'all'})


ALL = [AJUSTES, CLAUDE, RETORNO, APROB, ORQ, PROD, SONIDO, PUB, APRENDE, ESTADO, REFS, YT, VIDIQ, DERIV, REDES, CONFIRMAR, RUTINA, RADAR, ERRORES, AGENTE, PEND, REENVIAR, CHAT, COOPER, COSTO_COOPER, PROGRESO_COOPER, VALIDAR_PRESENTACION, AVATAR, TEXTO, NOTICIA]

def conservar_identificadores(wf, anterior):
    prev = {n['name']: n for n in anterior.get('nodes', [])}
    def ids(v, old, ruta):
        if isinstance(v, dict):
            for k, x in v.items():
                o = old.get(k) if isinstance(old, dict) else None
                if k == 'id' and isinstance(x, str) and len(x) == 36:
                    v[k] = o or str(uuid.uuid5(uuid.NAMESPACE_URL, ruta + '/' + k))
                else:
                    ids(x, o, ruta + '/' + k)
        elif isinstance(v, list):
            for i, x in enumerate(v):
                ids(x, old[i] if isinstance(old, list) and i < len(old) else None, ruta + '/' + str(i))
    for n in wf['nodes']:
        old = prev.get(n['name'], {})
        ruta = wf['id'] + '/' + n['name']
        n['id'] = old.get('id') or str(uuid.uuid5(uuid.NAMESPACE_URL, ruta))
        if 'webhookId' in n:
            n['webhookId'] = old.get('webhookId') or str(uuid.uuid5(uuid.NAMESPACE_URL, ruta + '/webhook'))
        ids(n['parameters'], old.get('parameters'), ruta)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for wf in ALL:
        fn = os.path.join(OUT, wf['id'] + '.json')
        anterior = json.load(open(fn)) if os.path.exists(fn) else {}
        conservar_identificadores(wf, anterior)
        with open(fn, 'w') as fh:
            json.dump(wf, fh, ensure_ascii=False, indent=2)
    print('\n'.join(f"{w['id']}  {w['name']}  ({len(w['nodes'])} nodos)" for w in ALL))
