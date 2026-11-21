"""Operación íntegra de Cooper. Solo genera; sin acceso a una instancia."""
CATALOGO = json.load(open(os.path.join(RAIZ,'cooper/src/contratos/ajustes-fabrica.json'),encoding='utf-8'))
CAMPOS_BIBLIA = json.load(open(os.path.join(RAIZ,'cooper/src/contratos/biblia-campos.json'),encoding='utf-8'))
COB_JS = 'const CAMPOS_BIBLIA = '+JS(CAMPOS_BIBLIA)+';\n'+'const CATALOGO_AJUSTES = '+JS(CATALOGO)+';\n'+open(os.path.join(RAIZ,'tools/cooper/cobertura.js'),encoding='utf-8').read()
# Ajustes efectivos: conservar el nodo base y aplicar únicamente campos administrativos permitidos.
f=reabrir(AJUSTES)
lista_cooper(f,'Cambios administrativos','eventos',[{'keyName':'tipo','condition':'eq','keyValue':'ajustes_cooper'}])
code(f,'Ajustes efectivos',COB_JS+r"""
const base=JSON.parse(JSON.stringify($('Ajustes').first().json));
for(const fila of $input.all().map(i=>i.json).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))||Number(a.id)-Number(b.id))){
 let d;try{d=JSON.parse(fila.detalle);}catch{continue;}
 if(validarValoresAjustes(d.valores))for(const [k,v]of Object.entries(d.valores))ponerAjuste(base,k,v);
}
return [{json:base}];
""")
f.chain('Ajustes','Cambios administrativos','Ajustes efectivos')
# Lecturas con proyección cerrada, tras autenticación y antes de reservar acciones.
f=reabrir(COOPER)
next(n for n in f.nodes if n['name']=='¿Consultar recibo?')['parameters']['conditions']['conditions'][0]['leftValue']="={{ !CONTRATO_CONSULTAS.includes($('Autenticar').first().json.solicitud.evento) }}".replace('CONTRATO_CONSULTAS',JS(CONTRATO_COOPER['consultas']))
next(n for n in f.nodes if n['name']=='¿Consultar resultados de Cooper?')['parameters']['conditions']['conditions'][0]['leftValue']="={{ ['estado','operacion','ajustes','control_fabrica'].includes($('Autenticar').first().json.solicitud.evento) }}"
next(n for n in f.nodes if n['name']=='Lecciones de Cooper')['parameters']['filters']['conditions']=[]
call(f,'Ajustes de Cooper',W['ajustes'])
f.nodes[-1]['executeOnce']=True
antes(f,'Resolver','Ajustes de Cooper','Ajustes de Cooper')
n=next(n for n in f.nodes if n['name']=='Resolver')
n['parameters']['jsCode']=COB_JS+n['parameters']['jsCode'].replace('/* RESOLVER_COBERTURA */',open(os.path.join(RAIZ,'tools/cooper/resolver_cobertura.js'),encoding='utf-8').read())
# La decisión reanuda el formulario persistido de n8n. Su URL nunca sale del servidor.
# Contrato n8n Form utils: getBodyData().data, claves field-0/field-1.
switch(f,'Destino de control',7,"({ajustes:1,decision:2,consultar:3,radar:4,renovar:5,conectar:6})[$json.accion] ?? 0")
f.conn['Evento del Orquestador']={'main':[[{'node':'Destino de control','type':'main','index':0}]]}
f.link('Destino de control','Entregar al Orquestador',0)
code(f,'Fila de ajustes administrativos',"return [{json:$('Resolver').first().json.evento.fila}];")
dt_insert(f,'Guardar ajustes administrativos','eventos')
f.link('Destino de control','Fila de ajustes administrativos',1)
f.chain('Fila de ajustes administrativos','Guardar ajustes administrativos','Firmar confirmación')
http(f,'Responder decisión de Cooper','POST',"={{ $('Resolver').first().json.evento.url }}",auth=False,timeout=20000)
f.nodes[-1]['parameters'].update({'sendBody':True,'contentType':'multipart-form-data','bodyParameters':{'parameters':[{'name':'field-0','value':"={{ $('Resolver').first().json.evento.datos.data['field-0'] }}"},{'name':'field-1','value':"={{ $('Resolver').first().json.evento.datos.data['field-1'] }}"}]},'options':{'timeout':20000,'response':{'response':{'responseFormat':'text'}}}})
# Sin retry: un timeout puede haber reanudado la ejecución. El recibo queda pendiente.
f.nodes[-1]['parameters']['options']['redirect']={'redirect':{'followRedirects':False}}
f.link('Destino de control','Responder decisión de Cooper',2)
f.chain('Responder decisión de Cooper','Firmar confirmación')
call(f,'Consultar publicaciones de Cooper',CONFIRMAR['id'],wait=True)
f.link('Destino de control','Consultar publicaciones de Cooper',3)
f.chain('Consultar publicaciones de Cooper','Firmar confirmación')
code(f,'Pedido de radar de Cooper',"return [{json:{...$json,accion:'correr'}}];")
call(f,'Correr radar de Cooper',RADAR['id'],wait=False)
f.link('Destino de control','Pedido de radar de Cooper',4)
f.chain('Pedido de radar de Cooper','Correr radar de Cooper','Firmar confirmación')
call(f,'Renovar decisión de Cooper',REENVIAR['id'],wait=False)
f.link('Destino de control','Renovar decisión de Cooper',5)
f.chain('Renovar decisión de Cooper','Firmar confirmación')
cambiar(RADAR,'Pedidos de radar',"const c =", "const pedidoCooper=$('Inicio').isExecuted?$('Inicio').first().json:{};\nconst c =")
cambiar(RADAR,'Pedidos de radar',"x.canal_id && x.nicho", "x.canal_id && x.nicho && (!pedidoCooper.canal_id||x.canal_id===pedidoCooper.canal_id)")
cambiar(REENVIAR,'Elegir',"r.url && r.estado", "(!$('Inicio').first().json.aprobacion_id||r.aprobacion_id===$('Inicio').first().json.aprobacion_id) && r.url && r.estado")
lista_cooper(f,'Conexiones de Cooper','youtube')
antes(f,'Resolver','Conexiones de Cooper','Conexiones de Cooper')
code(f,'Preparar conexión de Cooper',"return [{json:{...$json,accion:'enlace'}}];")
call(f,'Pedir conexión de Cooper',YT['id'],wait=True)
f.link('Destino de control','Preparar conexión de Cooper',6)
f.chain('Preparar conexión de Cooper','Pedir conexión de Cooper','Firmar confirmación')
# Permitir consultar una publicación concreta sin lanzar de nuevo la subida.
f=reabrir(CONFIRMAR)
trigger(f,'Consulta de Cooper')
f.link('Consulta de Cooper','Leer ajustes')
n=next(n for n in f.nodes if n['name']=='Por confirmar')
s=n['parameters']['jsCode'];s=s.replace("const l =", "const filtroCooper=$('Consulta de Cooper').isExecuted ? $('Consulta de Cooper').first().json.video_id : '';\nconst l =",1)
s=s.replace("return l.length ?", "const elegidas=filtroCooper?l.filter(p=>p.video_id===filtroCooper):l;\nreturn elegidas.length ?").replace("l.map(p => ({ json: p }))","elegidas.map(p => ({ json: p }))")
n['parameters']['jsCode']=s
# Upload-Post no equivale a publicado si quedó en bandeja/borrador o se omitió una cuenta.
cambiar(CONFIRMAR,'Leer resultados',"const fallo = st === 'failed' || res.some(x => x.success !== true);", "const fallo = st === 'failed' || res.some(x => x.success !== true || x.skipped === true || x.fallback_to_inbox === true);")
cambiar(CONFIRMAR,'Leer resultados',"publicado:x.success === true", "publicado:x.success === true && !x.skipped && !x.fallback_to_inbox,estado:x.fallback_to_inbox?'borrador':x.skipped?'omitido':x.success===true?'publicado':'error',borrador:x.fallback_to_inbox===true,omitido:x.skipped===true")
# Dejar una decisión legible por canal, incluidos los canales con automatización apagada.
cambiar(RUTINA,'Plan del día',"const pedidos = [], notas = [];", "const pedidos = [], notas = [], decisiones = [];")
cambiar(RUTINA,'Plan del día',"if (m.auto !== true) continue;", "if (m.auto !== true) { decisiones.push({canal_id:c.canal_id,decision:'En pausa',motivo:'La producción automática está apagada.',frenos:['Automatización apagada']}); continue; }")
cambiar(RUTINA,'Plan del día',"if (motivo) { notas.push", "if (motivo) { decisiones.push({canal_id:c.canal_id,decision:'No producir',motivo:semana>=meta?'La meta semanal ya se cumplió.':enCurso>0?'Hay un video en curso.':g+unidad>tope?'Se alcanzó un límite de producción.':'La retención está por debajo de la meta.',frenos:[semana>=meta?'Meta semanal':enCurso>0?'Producción en curso':g+unidad>tope?'Límite de fábrica':'Calidad']}); notas.push")
cambiar(RUTINA,'Plan del día',"pedidos.push({ evento:","decisiones.push({canal_id:c.canal_id,decision:'Pedir video',motivo:'Falta completar la meta semanal; se elegirá un tema usando la biblia, el aprendizaje y el radar.',frenos:[]});\n  pedidos.push({ evento:")
cambiar(RUTINA,'Plan del día',"if (!notas.length) return [{ json: { nada: true } }];", "if (!notas.length) return [{ json: { nada: true, decisiones } }];")
cambiar(RUTINA,'Plan del día',"json: { pedidos, texto:","json: { pedidos, decisiones, texto:")
f=reabrir(RUTINA)
code(f,'Cooper · decisiones del día',"return ($('Plan del día').first().json.decisiones||[]).map(d=>({json:{tipo:'rutina_cooper',evento:String($execution.id)+':'+d.canal_id,canal_id:d.canal_id,video_id:'',detalle:JSON.stringify(d)}}));")
dt_insert(f,'Cooper · guardar decisiones del día','eventos')
f.chain('Plan del día','Cooper · decisiones del día','Cooper · guardar decisiones del día')
# Registrar avisos efectivamente aceptados por Telegram. Los globales son solo administrativos.
for wf in [ORQ,APROB,PROD,PUB,SONIDO,REFS,REDES,CONFIRMAR,RUTINA,RADAR,ERRORES,REENVIAR,YT,AGENTE,NOTICIA,RETORNO,CLAUDE]:
 f=reabrir(wf)
 for n in list(f.nodes):
  if not n['type'].endswith('.telegram') or n['parameters'].get('operation')!='sendMessage':continue
  p='Cooper · aviso '+n['name']
  code(f,p,r"""
let inicio={};try{if($('Inicio').isExecuted)inicio=$('Inicio').first().json;}catch{}
return $input.all().map((i,k)=>{const r=i.json.result||i.json;return {json:{tipo:'aviso_cooper',evento:String($execution.id)+':'+NOMBRE+':'+$runIndex+':'+k,canal_id:inicio.canal_id||inicio.plan?.canal_id||'',video_id:inicio.video_id||inicio.plan?.video_id||'',detalle:JSON.stringify({tipo:NOMBRE,estado:r.message_id?'enviado':r.error?'fallido':'incierto',resumen:'Aviso: '+NOMBRE})}};});
""".replace('NOMBRE',JS(n['name'])))
  dt_insert(f,p+' guardar','eventos')
  f.chain(n['name'],p,p+' guardar')
# Consulta explícita incluye fallos antiguos; el cron conserva su ventana de 14 días.
f=reabrir(CONFIRMAR)
n=next(n for n in f.nodes if n['name']=='Publicaciones recientes')
n['parameters']['filters']['conditions']=[{'keyName':"={{ $('Consulta de Cooper').isExecuted ? 'video_id' : 'createdAt' }}",'condition':"={{ $('Consulta de Cooper').isExecuted ? 'eq' : 'gte' }}",'keyValue':"={{ $('Consulta de Cooper').isExecuted ? $('Consulta de Cooper').first().json.video_id : new Date(Date.now()-14*86400000).toISOString() }}"}]
cambiar(CONFIRMAR,'Por confirmar',"['programado', 'enviado'].includes(p.estado) && Date.parse(p.publicado_en || 0) <= corte", "(filtroCooper ? p.video_id===filtroCooper : ['programado', 'enviado'].includes(p.estado) && Date.parse(p.publicado_en || 0) <= corte)")
# La ejecución interrumpida identifica su video y deja una causa pública recuperable.
f=reabrir(ERRORES)
code(f,'Cooper · marcar interrupción',OBS_JS+COB_JS+r"""
const ex=$('Error en un flujo').first().json;
const [motivo]=motivoOperacion(ex.execution?.error?.message || ex.trigger?.error?.message || '');
return $('Cooper · ejecución fallida').all().map(i=>i.json).filter(x=>x.video_id).map(x=>({json:{video_id:x.video_id,estado:ex.workflow?.id===ID_REDES?'error_publicacion':'con_fallas',error:motivo}}));
""".replace('ID_REDES',JS(W['redes'])))
dt_update(f,'Cooper · guardar interrupción','videos','video_id','={{ $json.video_id }}')
f.nodes[-1]['parameters']['filters']['conditions'].extend([{'keyName':'estado','condition':'neq','keyValue':'cancelado'},{'keyName':'eliminado','condition':'neq','keyValue':True}])
f.chain('Cooper · ejecución fallida','Cooper · marcar interrupción','Cooper · guardar interrupción')

# Vincular el encargo automático con la decisión que lo originó.
cambiar(RUTINA,'Plan del día',"decision:'Pedir video',motivo:","video_id:'v-auto-'+String($execution.id)+'-'+c.canal_id,decision:'Pedir video',motivo:")
cambiar(RUTINA,'Plan del día',"pedidos.push({ evento: 'nuevo_video', canal_id: c.canal_id", "pedidos.push({ evento: 'nuevo_video', video_id:'v-auto-'+String($execution.id)+'-'+c.canal_id, canal_id: c.canal_id")
cambiar(RUTINA,'Cooper · decisiones del día',"video_id:'',detalle:","video_id:d.video_id||'',detalle:")
# La fuente pertenece a cada idea, nunca se atribuye a ella la de otro ejemplo.
cambiar(RADAR,'Encargo del analista','"caduca_dias": 7','"fuente": "nombre de la fuente consultada", "fuente_url": "URL exacta de los datos suministrados, o vacío si falta", "caduca_dias": 7')

# Las puertas web no tienen formulario; cerrar también al pedir cambios.
f=reabrir(ORQ)
for destino in ['Canal (corrección)','Cambio final a corrección']:
 p='Cooper · cerrar cambios '+destino
 iff(f,p+' si',"!!$('Inicio').first().json.aprobacion_id")
 code(f,p+' fila',"return [{json:{estado:'cambios',cambios:String($('Inicio').first().json.cambios||'').slice(0,4000),decidido_en:new Date().toISOString()}}];")
 dt_update(f,p+' guardar','aprobaciones','aprobacion_id',"={{ $('Inicio').first().json.aprobacion_id }}")
 code(f,p+' seguir',"return [{json:$('Inicio').first().json}];")
 antes(f,destino,p+' si',p+' seguir');f.link(p+' si',p+' fila',0);f.link(p+' si',p+' seguir',1)
 f.chain(p+' fila',p+' guardar',p+' seguir')

# También atribuir fallos de preparación de canales y subflujos auxiliares.
for wf in [ORQ,PROD,SONIDO,PUB,REDES,NOTICIA]:
 f=reabrir(wf)
 cambiar(wf,'Cooper · atribuir ejecución',"return video_id?", "return video_id||e.canal_id?")
 cambiar(wf,'Cooper · atribuir ejecución',"json:{video_id,canal_id:", "json:{video_id:video_id||'',canal_id:")
 n=next(n for n in f.nodes if n['name']=='¿Atribuir ejecución a video?')
 n['parameters']['conditions']['conditions'][0]['leftValue']="={{ !!($('Inicio').first().json.video_id || $('Inicio').first().json.plan?.video_id || $('Inicio').first().json.canal_id) }}"
for wf in [REFS,DERIV,CLAUDE,YT,VIDIQ,RETORNO]:
 f=reabrir(wf)
 if not any(n['name']=='Inicio' for n in f.nodes):continue
 code(f,'Cooper · atribuir auxiliar',"const e=$('Inicio').first().json;return [{json:{tipo:'ejecucion_cooper',evento:String($execution.id),canal_id:e.canal_id||'',video_id:e.video_id||e.plan?.video_id||'',detalle:'{}'}}];")
 dt_insert(f,'Cooper · guardar auxiliar','eventos')
 code(f,'Cooper · seguir auxiliar',"return $('Inicio').all();")
 despues(f, 'Inicio','Cooper · atribuir auxiliar','Cooper · seguir auxiliar')
 f.chain('Cooper · atribuir auxiliar','Cooper · guardar auxiliar','Cooper · seguir auxiliar')
f=reabrir(ERRORES)
n=next(n for n in f.nodes if n['name']=='Cooper · fallo público')
n['parameters']['jsCode']=OBS_JS+COB_JS+r"""
const e=$('Error en un flujo').first().json;
const filas=$input.all().map(i=>i.json).filter(v=>v.video_id||v.canal_id);
if(!filas.length)filas.push({});
const [resumen,sugerencia]=motivoOperacion(e.execution?.error?.message||e.trigger?.error?.message||'');
return filas.map(v=>({json:{video_id:v.video_id||'',canal_id:v.canal_id||'',tipo:'incidencia_cooper',evento:String(e.execution?.id||$execution.id)+':error',detalle:JSON.stringify({tipo:'ejecucion',resumen,sugerencia,proceso:textoOperacion(e.workflow?.name||'Preparación de la fábrica')})}}));
"""

# Un cierre condicional impide dos avances si web/chat u operadores compiten.
for n in ORQ['nodes']:
 if n['name'].startswith('Cooper · cerrar ') and n['name'].endswith(' guardar'):
  n['parameters']['filters']['conditions'].append({'keyName':'estado','condition':'eq','keyValue':'pendiente'})
