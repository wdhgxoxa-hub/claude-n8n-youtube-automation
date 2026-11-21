"""Extensión de los flujos existentes. Se ejecuta desde generar_flujos_v2.py."""
W.update({'presentacion': 'FabPresentacion1', 'avatar': 'FabAvatar0000001'})

# Revalidar contra Cooper antes de gastar, tras esperas y antes de publicar.
f = Flow(W['presentacion'], 'FX · Validar presentación')
trigger(f)
dt_get(f, 'Video de presentación', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Consulta de presentación', PRESENTACION_JS + r"""
const e = $('Inicio').first().json, v = $('Video de presentación').first().json, aj = $('Leer ajustes').first().json;
const presentacion = validarPresentacion(JSON.parse(v.presentacion || 'null'));
if (!v.video_id && e.presentacion) throw new Error('Falta el video persistido');
if (!presentacion || !presentacion.avatar && !presentacion.voz) return [{json:{consultar:false}}];
if (!v.cooper_orden_id || !v.dueno_email) throw new Error('Presentación sin orden autorizada');
const bloqueo = e.bloqueo || (presentacion.avatar && !aj.allowAvatar ? 'avatar_apagado' : !aj.allowVoz ? 'voz_apagada' :
  ['medios','montaje'].includes(e.control) && (!aj.allowMontaje || !aj.allowDrive) ? 'produccion_pausada' : '');
return [{json:{consultar:true, consulta:{version:'cooper-v1', tipo:'presentacion', orden_id:v.cooper_orden_id,
  video_id:v.video_id, dueno_email:v.dueno_email, presentacion, bloqueo}}}];
""")
iff(f, '¿Consultar consentimiento?', '$json.consultar === true')
firmar_cooper(f, 'Firmar consulta', "$('Consulta de presentación').first().json.consulta")
enviar_cooper(f, 'Consultar Cooper')
iff(f, '¿Presentación permitida?', '$json.permitido === true')
code(f, 'Conservar entrada', "return [{json:$('Inicio').first().json}];")
code(f, 'Estado detenido', "const r=$('Consultar Cooper').first().json; return [{json:{estado:r.estado === 'cancelada' ? 'cancelado' : 'detenido', error:r.aviso}}];")
dt_update(f, 'Guardar detención', 'videos', 'video_id', "={{ $('Inicio').first().json.video_id }}")
code(f, 'Detener presentación', "throw new Error($('Consultar Cooper').first().json.aviso || 'Presentación detenida');")
f.chain('Inicio','Video de presentación','Leer ajustes','Consulta de presentación','¿Consultar consentimiento?')
f.link('¿Consultar consentimiento?','Firmar consulta',0); f.link('¿Consultar consentimiento?','Conservar entrada',1)
f.chain('Firmar consulta','Consultar Cooper','¿Presentación permitida?')
f.link('¿Presentación permitida?','Conservar entrada',0); f.link('¿Presentación permitida?','Estado detenido',1)
f.chain('Estado detenido','Guardar detención','Detener presentación')
VALIDAR_PRESENTACION = f.dump()

def guardia_presentacion(wf, destino, control='medios', extra='', video="$('Inicio').first().json.video_id"):
    f = reabrir(wf); p = 'Presentación · ' + destino
    code(f,p+' entrada','return $input.all();')
    code(f,p+' consulta',"return $input.all().map((i,k)=>({json:{video_id:" + video + ", control:" + JS(control) + extra + "}, pairedItem:{item:k}}));")
    call(f,p+' validar',W['presentacion'],each=True)
    code(f,p+' seguir',"return $('"+p+" entrada').all().map((i,k)=>({...i,pairedItem:{item:k}}));")
    f.chain(p+' entrada',p+' consulta',p+' validar',p+' seguir')
    antes(f,destino,p+' entrada',p+' seguir')

# Voz elegida: una única ruta por ítem. Clonadas jamás se reinterpretan como Gemini.
f = reabrir(SONIDO)
switch(f, 'Proveedor de voz', 3, "({gemini:0,heygen:1,elevenlabs:2})[$json.proveedor]")
f.conn['Textos de voz']={'main':[[{'node':'Proveedor de voz','type':'main','index':0}]]}
f.link('Proveedor de voz','Voz (Gemini TTS)',0)
http(f,'Voz (HeyGen)','POST','https://api.heygen.com/v3/models/audio/tts',
     body="={{ {voice_id:$json.voz,text:$json.texto.replace(/<[^>]+>/g, ''),language:'es'} }}",cred=CRED_HEYGEN,timeout=180000)
code1(f,'Voz HeyGen lista',r"""
const p=$('Textos de voz').item.json, d=$json.data;
if (!d || !/^https:\/\//.test(d.audio_url) || !Number.isFinite(d.duration) || d.duration <= 0) throw new Error('HeyGen no devolvió audio válido');
return {json:{plano_id:p.plano_id,url:d.audio_url,duracion_s:d.duration,costo_voz_usd:p.costo_voz_usd,
  palabras_por_minuto:Math.round(p.texto.split(/\s+/).length/d.duration*60)}};
""")
http(f,'Voz (ElevenLabs)','POST',"={{ 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent($json.voz) + '/with-timestamps?output_format=pcm_24000' }}",
     body="={{ {text:$json.texto.replace(/<[^>]+>/g, ''),model_id:'eleven_multilingual_v2'} }}",cred=CRED_ELEVEN,timeout=180000)
code1(f,'PCM ElevenLabs',r"""
if (typeof $json.audio_base64 !== 'string' || !$json.audio_base64) throw new Error('ElevenLabs no devolvió audio');
return {json:{steps:[{type:'model_output',content:[{type:'audio',mime_type:'audio/l16;rate=24000',data:$json.audio_base64}]}]}};
""")
f.link('Proveedor de voz','Voz (HeyGen)',1); f.chain('Voz (HeyGen)','Voz HeyGen lista','Juntar voces')
f.link('Proveedor de voz','Voz (ElevenLabs)',2); f.chain('Voz (ElevenLabs)','PCM ElevenLabs','WAV')
# Aggregate no espera dos ramas diferentes: reunir por ID y exigir todas las narraciones.
n=next(n for n in f.nodes if n['name']=='Juntar voces')
n.update({'type':'n8n-nodes-base.code','typeVersion':2,'parameters':{'jsCode':r"""
const ids=$('Textos de voz').all().map(i=>i.json.plano_id), voces=new Map();
for (const name of ['Voz lista','Voz HeyGen lista']) {
  if (!$(name).isExecuted) continue;
  for(let k=0;k<500;k++) { let items; try {items=$(name).all(0,k);} catch {break;} if (!items?.length) break;
    for (const i of items) voces.set(i.json.plano_id,i.json); }
}
if (!ids.length || ids.some(id=>!voces.has(id))) return [];
return [{json:{voces:ids.map(id=>voces.get(id))}}];
"""}})
cambiar(SONIDO,'Voz lista','plano_id: w.plano_id,','plano_id: w.plano_id, costo_voz_usd:w.costo_voz_usd,')
# No repetir síntesis paga automáticamente tras respuestas inciertas.
next(n for n in f.nodes if n['name']=='Voz (Gemini TTS)').pop('retryOnFail',None)

# Render por look, sincronizado con la misma voz que se monta. Una ejecución por plano.
f = Flow(W['avatar'], 'FX · Renderizar avatar')
trigger(f)
call(f,'Leer ajustes',W['ajustes'])
code(f,'Pedido de avatar',PRESENTACION_JS + r"""
const e=$('Inicio').first().json, aj=$('Leer ajustes').first().json, p=validarPresentacion(e.presentacion);
if (!aj.allowAvatar || !p?.avatar || e.plano?.tipo !== 'avatar' || !/^https:\/\//.test(e.voz?.url) || !(e.voz.duracion_s>0)) throw new Error('Avatar sin autorización o audio');
return [{json:{type:'avatar',avatar_id:p.avatar.id,audio_url:e.voz.url,resolution:'1080p',aspect_ratio:e.formato === 'short' ? '9:16' : '16:9'}}];
""")
http(f,'Crear avatar','POST','https://api.heygen.com/v3/videos',body='={{ $json }}',cred=CRED_HEYGEN,
     headers={'Idempotency-Key':"={{ 'cooper-avatar-' + $execution.id }}"},timeout=180000)
code(f,'Trabajo avatar',r"""
const id=$json.data?.video_id;
if (typeof id !== 'string' || !/^[\w-]{1,160}$/.test(id)) throw new Error('HeyGen no devolvió el trabajo');
return [{json:{id}}];
""")
wait(f,'Esperar avatar',15)
http(f,'Consultar avatar','GET',"={{ 'https://api.heygen.com/v3/videos/' + encodeURIComponent($('Trabajo avatar').first().json.id) }}",cred=CRED_HEYGEN,timeout=30000)
code(f,'Estado avatar',r"""
const d=$json.data;
if (!d || !['waiting','pending','processing','completed','failed'].includes(d.status)) throw new Error('Estado de avatar inválido');
if (d.status === 'failed') throw new Error('El render de avatar falló');
if ($runIndex >= 80) throw new Error('Avatar pendiente: conciliar antes de repetir');
if (d.status === 'completed' && (!/^https:\/\//.test(d.video_url) || !(d.duration>0))) throw new Error('Avatar sin video válido');
return [{json:d}];
""")
iff(f,'¿Avatar listo?', "$json.status === 'completed'")
code(f,'Avatar listo',r"""
const e=$('Inicio').first().json, d=$('Estado avatar').last().json;
if (d.duration + 0.25 < e.voz.duracion_s) throw new Error('Avatar más corto que su narración');
return [{json:{video_id:e.video_id,plano_id:e.plano.id,plano:e.plano,url:d.video_url,duracion_s:d.duration,remoto_id:d.id,
  costo_avatar_usd:e.voz.duracion_s * $('Leer ajustes').first().json.costoAvatarSegUsd,intento:1,nota_revision:''}}];
""")
code(f,'Fila avatar',"const p=$('Avatar listo').first().json; return [{json:{video_id:p.video_id,plano_id:p.plano_id,tipo:'avatar',usa_avatar:true,presentacion:JSON.stringify(p.plano.presentacion),archivo_url:p.url,estado:'listo',costo_usd:p.costo_avatar_usd,intentos:1,nota_revision:''}}];")
dt_insert(f,'Guardar avatar','planos')
f.nodes[-1]['parameters'].update({'operation':'upsert','matchType':'allConditions','filters':{'conditions':[{'keyName':'video_id','condition':'eq','keyValue':'={{ $json.video_id }}'},{'keyName':'plano_id','condition':'eq','keyValue':'={{ $json.plano_id }}'}]}})
code(f,'Devolver avatar',"return [{json:$('Avatar listo').first().json}];")
f.chain('Inicio','Leer ajustes','Pedido de avatar','Crear avatar','Trabajo avatar','Esperar avatar','Consultar avatar','Estado avatar','¿Avatar listo?')
f.link('¿Avatar listo?','Avatar listo',0); f.link('¿Avatar listo?','Esperar avatar',1)
f.chain('Avatar listo','Fila avatar','Guardar avatar','Devolver avatar')
AVATAR = f.dump()

# En producción se prepara el marcador de plano antes de sonido; solo después se renderiza.
f = reabrir(PROD)
code(f,'Preparar avatares',r"""
const e=$('Plan de producción').first().json, son=$('Sonido y emoción').first().json, aj=$('Leer ajustes').first().json;
const planos=e.planos.filter(p=>p.tipo === 'avatar');
const voces=new Map(son.voces.map(v=>[v.plano_id,v]));
if (planos.some(p=>!voces.get(p.id)?.url)) throw new Error('Falta voz para el avatar');
const costoAvatar=planos.reduce((a,p)=>a+voces.get(p.id).duracion_s*aj.costoAvatarSegUsd,0);
const costoVoz=son.voces.reduce((a,v)=>a+(v.costo_voz_usd ?? aj.costoVozUsdPorPlano),0);
const costo=$('Gasto de planos').first().json.usd+costoVoz+costoAvatar;
return [{json:{bloqueo:costo>e.presupuesto ? 'presupuesto' : '', hay:planos.length>0,
  pedidos:planos.map(p=>({video_id:e.video_id,plano:p,presentacion:e.presentacion,formato:e.formato,voz:voces.get(p.id)}))}}];
""")
iff(f,'¿Hay avatares?', '$json.hay === true')
code(f,'Pedidos de avatar',"return $('Preparar avatares').first().json.pedidos.map(p=>({json:p}));")
call(f,'Renderizar avatares',W['avatar'],each=True)
code(f,'Presentación lista',r"""
const son=$('Sonido y emoción').first().json;
const listos=$('Renderizar avatares').isExecuted ? $('Renderizar avatares').all().map(i=>i.json) : [];
const originales=$('Juntar planos').first().json.planos;
const planos=originales.map(p=>p.plano.tipo === 'avatar' ? listos.find(a=>a.plano_id===p.plano_id) : p);
if (planos.some(p=>!p?.url)) throw new Error('Faltan planos para el montaje');
return [{json:{...son,planos}}];
""")
antes(f,'Composición Creatomate','Preparar avatares','Presentación lista')
f.chain('Preparar avatares','¿Hay avatares?');f.link('¿Hay avatares?','Pedidos de avatar',0);f.link('¿Hay avatares?','Presentación lista',1)
f.chain('Pedidos de avatar','Renderizar avatares','Presentación lista')
cambiar(PROD,'Encargo de derivados',"planos: $('Juntar planos').first().json.planos", "planos: $('Presentación lista').first().json.planos")
cambiar(PROD,'Encargo de calidad',"const l = $('Juntar planos').first().json.planos", "const l = $('Presentación lista').first().json.planos")
cambiar(PROD,'Encargo de calidad',"['clip', 'archivo'].includes", "['clip', 'archivo', 'avatar'].includes")
cambiar(PROD,'Costos del video',"['voz', 'Gemini TTS', (son.voces || []).length * aj.costoVozUsdPorPlano]", "['voz', 'Voz elegida', (son.voces || []).reduce((a,v)=>a+(v.costo_voz_usd ?? aj.costoVozUsdPorPlano),0)],\n  ['avatar', 'HeyGen', ($('Presentación lista').isExecuted ? $('Presentación lista').first().json.planos : []).reduce((a,p)=>a+(p.costo_avatar_usd || 0),0)]")

# Todas las rutas nuevas pasan por la consulta firmada. Las esperas también revalidan.
guardia_presentacion(PROD,'¿Todo encendido?',extra=", bloqueo:$('Plan de producción').first().json.bloqueo")
guardia_presentacion(PROD,'¿Hay avatares?',extra=", bloqueo:$('Preparar avatares').first().json.bloqueo")
for wf,destinos,control in [(PROD,['Generar imagen','Animar (Gemini Omni)'],'medios'),
    (PROD,['Renderizar','Encargo de calidad','Derivados'],'montaje'),
    (SONIDO,['Textos de voz','Voz (Gemini TTS)','Voz (HeyGen)','Voz (ElevenLabs)'],'voz'),
    (AVATAR,['Pedido de avatar','Crear avatar','Consultar avatar','Avatar listo'],'avatar'),
    (ORQ,['Pedir storyboard','Pedir storyboard corregido','Encargo de producción','Video (publicar)'],'cola'),
    (PUB,['Aprobación final'],'cola')]:
    for destino in destinos: guardia_presentacion(wf,destino,control)
# Evitar publicación demorada tras una revocación (también subidas/derivados en cola).
for wf,destino in [(ORQ,'Subir a YouTube'),(REDES,'Subir a redes')]:
    assert any(n['name']==destino for n in wf['nodes']), destino
    guardia_presentacion(wf,destino,'cola')
for destino in ['Renderizar miniatura','Renderizar corte']:
    guardia_presentacion(DERIV,destino,'montaje',video="$('Inicio').first().json.plan.video_id")

cambiar(PROD,'Costos del video',"usd > 0 || i >= 4","usd > 0 || [\'música\',\'efectos\',\'montaje\'].includes(c)")
