"""Ciclo aprendizaje con evidencia persistida y lectura obligatoria, sin nuevas columnas."""
APRENDIZAJE_JS = open(os.path.join(RAIZ, 'tools/cooper/aprendizaje.js'), encoding='utf-8').read()
f = reabrir(APRENDE)
APRENDE['name'] = 'M7 · Aprendizaje (24 h, 72 h y 7 días)'
next(n for n in f.nodes if n['name']=='Cada día')['parameters'] = {'rule':{'interval':[{'field':'hours','hoursInterval':1}]}}
# Evitar que el análisis corra antes de las métricas; los caminos convergen una sola vez.
for origen, destino in [('Retención','Pedir lecciones'), ('¿Algún canal conectado?','Cooper · métricas YouTube'), ('Métricas en redes','Videos publicados')]:
    for edges in f.conn.get(origen,{}).get('main',[]):
        edges[:] = [e for e in edges if e['node'] != destino]
code(f,'Reponer pedidos de métricas',"return $('Pedidos de retención').all();")
f.chain('Retención','Reponer pedidos de métricas','Cooper · métricas YouTube')
f.link('Cooper · guardar métricas YouTube','Pedir lecciones')
f.link('Cooper · guardar métricas de redes','Videos publicados')
for nombre, tabla in [('Trabajos para aprender','trabajos'),('Videos para aprender','videos'),('Planos para aprender','planos')]:
    lista_cooper(f,nombre,tabla)
antes(f,'Pedir lecciones','Trabajos para aprender','Planos para aprender')
f.chain('Trabajos para aprender','Videos para aprender','Planos para aprender')
# Una medición por día y otra al cruzar cada hito; no se consulta antes de 24 horas.
for nombre, es_red in [('Toca medir',False),('Toca medir en redes',True)]:
    n=next(n for n in f.nodes if n['name']==nombre)
    fuente = "p.request_id && ['publicado','error'].includes(p.estado)" if es_red else "p.youtube_id"
    historial = "Object.values(parseAprendizaje(p.metricas_historial)).flat()" if es_red else "parseAprendizaje(p.metricas_youtube,[])"
    n['parameters']['jsCode'] = APRENDIZAJE_JS + r"""
const hoy=Date.now(), dia=86400000;
const toca=$input.all().map(i=>i.json).filter(p=>FUENTE && ventanaAprendizaje(p.publicado_en,hoy)).filter(p=>{
 const historial=HISTORIAL, ventana=ventanaAprendizaje(p.publicado_en,hoy);
 const sinHito=!historial.some(m=>m.ventana===ventana), espera=sinHito?3600000:dia;
 return !p.metricas_consultadas_en || hoy-Date.parse(p.metricas_consultadas_en)>=espera;
}).sort((a,b)=>String(a.metricas_consultadas_en || '').localeCompare(String(b.metricas_consultadas_en || ''))).slice(0,100);
return toca.length?toca.map(p=>({json:{...p,ventana:ventanaAprendizaje(p.publicado_en,hoy),dias:Math.floor((hoy-Date.parse(p.publicado_en))/dia),desde:p.publicado_en.slice(0,10)}})):[{json:{nada:true}}];
""".replace('FUENTE',fuente).replace('HISTORIAL',historial)
n=next(n for n in f.nodes if n['name']=='Cooper · métricas YouTube')
next(p for p in n['parameters']['queryParameters']['parameters'] if p['name']=='metrics')['value']='views,likes,comments,averageViewPercentage,subscribersGained'
cambiar(APRENDE,'Cooper · historial YouTube', 'const dato=campos?', "const ventana=ventanaAprendizaje(v.publicado_en),horas=ventana==='7d'?168:ventana==='72h'?72:24; const dato=campos?")
cambiar(APRENDE,'Cooper · historial YouTube', '{fecha,vistas:', "{fecha,ventana,demora_horas:Math.max(0,Math.round((Date.now()-Date.parse(v.publicado_en))/3600000-horas)),seguidoresGanados:numeroCooper(campos.subscribersGained),vistas:")
n=next(n for n in f.nodes if n['name']=='Cooper · historial YouTube')
n['parameters']['jsCode']=APRENDIZAJE_JS+n['parameters']['jsCode']
# La petición solo sale si hay evidencia nueva y evita duplicar un hito ya enviado/listo.
n=next(n for n in f.nodes if n['name']=='Pedir lecciones')
n['parameters']['jsCode']=APRENDIZAJE_JS+r"""
const filas = n => $(n).isExecuted ? $(n).all().map(i=>i.json) : [];
const trabajos=filas('Trabajos para aprender'), planos=filas('Planos para aprender'), videos=filas('Videos para aprender').length?filas('Videos para aprender'):filas('Videos publicados');
const evidencias=[];
for (const h of filas('Cooper · historial YouTube')) {
 const v=videos.find(v=>v.video_id===h.video_id); if(!v) continue;
 const m=parseAprendizaje(h.metricas_youtube,[]).at(-1); if(!m?.ventana || m.fecha!==h.metricas_consultadas_en) continue;
 evidencias.push({video_id:v.video_id,canal_id:v.canal_id,red:'youtube',ventana:m.ventana,fecha:m.fecha,demora_horas:m.demora_horas,metricas:metricasAprendizaje(m),creativo:contextoAprendizaje(v,trabajos,planos),retencion:filas('Retención')[filas('Pedidos de retención').findIndex(p=>p.video_id===v.video_id)]?.rows || []});
}
for(const h of filas('Cooper · historial de redes')) {
 const p=filas('Toca medir en redes').find(p=>p.request_id===h.request_id), v=videos.find(v=>v.video_id===p?.video_id && v.canal_id===p?.canal_id);
 if(!p || !v) continue;
 for(const [red,historial] of Object.entries(parseAprendizaje(h.metricas_historial))) {
  const m=historial.at(-1); if(!m?.ventana || m.fecha!==h.metricas_consultadas_en) continue;
  evidencias.push({video_id:v.video_id,canal_id:v.canal_id,red,ventana:m.ventana,fecha:m.fecha,demora_horas:m.demora_horas,metricas:metricasAprendizaje(m),creativo:{...contextoAprendizaje(v,trabajos,planos),titulo:String(p.titulo || v.tema || '').slice(0,500)},retencion:m.curvaRetencion || []});
 }
}
const clave=e=>[e.video_id,e.red,e.ventana].join(':');
const procesadas=new Set(trabajos.filter(t=>t.modo==='aprender' && ['enviado','listo','ok'].includes(t.estado)).flatMap(t=>(parseAprendizaje(t.resultado)._aprendizaje?.evidencias || []).map(e=>t.canal_id+':'+clave(e))));
const porCanal={};
for(const e of evidencias) if(Object.values(e.metricas).some(v=>v!==null) && !procesadas.has(e.canal_id+':'+clave(e))) (porCanal[e.canal_id] ||= []).push(e);
return Object.entries(porCanal).map(([canal_id,evidencias])=>({json:{modo:'aprender',canal_id,video_id:'',datos:{canal_id,evidencias:acotarEvidenciasAprendizaje(evidencias,trabajos.filter(t=>t.canal_id===canal_id && t.modo==='aprender' && ['listo','ok'].includes(t.estado)).flatMap(t=>parseAprendizaje(t.resultado)._aprendizaje?.evidencias || []).slice(-10)),instrucciones:'Explica como hipótesis, nunca como causalidad demostrada. Cruza métricas con guion, planos, título y miniatura disponibles. Devuelve por lección regla, causa, correccion y origenes [{video_id,red,ventana,metrica}]. Si falta contexto dilo; no inventes cifras ni correcciones realizadas. Solo patrón con 3 videos independientes.'}}}));
"""
# También las reescrituras leen el repositorio por canal: una corrección no pierde las lecciones.
f=reabrir(CLAUDE)
lista_cooper(f,'Aprendizajes al escribir','trabajos',[{'keyName':'canal_id','condition':'eq','keyValue':"={{ $('Inicio').first().json.canal_id || '__sin_canal__' }}"},{'keyName':'modo','condition':'eq','keyValue':'aprender'}])
antes(f,'Preparar trabajo','Aprendizajes al escribir','Aprendizajes al escribir')
n=next(n for n in f.nodes if n['name']=='Preparar trabajo')
n['parameters']['jsCode']=APRENDIZAJE_JS+n['parameters']['jsCode']
cambiar(CLAUDE,'Preparar trabajo',"const pedido = $('Inicio').first().json;",r"""
const original=$('Inicio').first().json, pedido={...original,datos:{...original.datos}};
if(['guion','corregir_guion'].includes(pedido.modo)) {
 const lecciones=$('Aprendizajes al escribir').isExecuted?leccionesParaGuion($('Aprendizajes al escribir').all().map(i=>i.json),pedido.canal_id):(pedido.datos.aprendizaje?.lecciones || []);
 pedido.datos.aprendizaje={lecciones,obligatorio:true,instrucciones:'Lee todas las lecciones y devuelve aprendizajes_aplicados [{id,cambio,motivo_no_aplica}]. Hipótesis no equivalen a hechos; conserva las reglas humanas.'};
 pedido.datos.biblia={...pedido.datos.biblia,lecciones_automaticas:lecciones};
}
""")
# Guardar evidencia antes de despachar; se conserva durante el retorno para auditar y deduplicar.
cambiar(CLAUDE,'Preparar trabajo', "resultado: ''", "resultado: JSON.stringify({ ...(pedido.modo==='aprender'?{_aprendizaje:{evidencias:pedido.datos?.evidencias || []}}:{}), ...(['guion','corregir_guion'].includes(pedido.modo)?{_lecciones_requeridas:pedido.datos?.aprendizaje?.lecciones?.map(l=>l.id) || []}:{}) })")
f=reabrir(RETORNO)
n=next(n for n in f.nodes if n['name']=='Fila actualizada')
n['parameters']['jsCode']=APRENDIZAJE_JS+r"""
const v=$('Validar').first().json, t=$('Buscar trabajo').first().json, anterior=parseAprendizaje(t.resultado);
if(v.modo && v.modo!==t.modo) throw new Error('El resultado no corresponde al modo del trabajo');
let resultado=v.resultado;
if(v.estado==='ok' && t.modo==='aprender') resultado=validarAprendizaje(resultado,anterior._aprendizaje,t.job_id);
if(v.estado==='ok' && ['guion','corregir_guion'].includes(t.modo)) {
 const requeridas=anterior._lecciones_requeridas || [], aplicadas=Array.isArray(resultado?.aprendizajes_aplicados)?resultado.aprendizajes_aplicados:[];
 if(requeridas.some(id=>!aplicadas.some(a=>a.id===id && (String(a.cambio || '').trim() || String(a.motivo_no_aplica || '').trim())))) throw new Error('El guion debe explicar cada aprendizaje requerido antes de pasar a revisión');
}
return [{json:{estado:v.estado==='ok'?'listo':'error',resultado:JSON.stringify({...anterior,resultado,avisos:v.avisos})}}];
"""
cambiar(RETORNO,'Evento', 'resultado: v.resultado', "resultado: JSON.parse($('Fila actualizada').first().json.resultado).resultado")
# Tabla de lecciones por canal: lectura obligatoria en cada encargo y biblia enriquecida sin sobrescribir ajustes humanos.
f=reabrir(ORQ)
lista_cooper(f,'Lecciones antes del guion','trabajos',[{'keyName':'canal_id','condition':'eq','keyValue':"={{ $('Buscar canal').first().json.canal_id }}"},{'keyName':'modo','condition':'eq','keyValue':'aprender'}])
antes(f,'Nuevo video','Lecciones antes del guion','Lecciones antes del guion')
cambiar(ORQ,'Nuevo video', '$input.all().map(i => i.json)', "$('Temas recientes del canal').all().map(i => i.json)")
n=next(n for n in f.nodes if n['name']=='Nuevo video')
n['parameters']['jsCode']=APRENDIZAJE_JS+n['parameters']['jsCode']
cambiar(ORQ,'Nuevo video', "const elegir =", "const lecciones=leccionesParaGuion($('Lecciones antes del guion').all().map(i=>i.json),canal.canal_id); biblia.lecciones_automaticas=lecciones;\nconst elegir =")
cambiar(ORQ,'Nuevo video', 'nicho: canal.nicho', "aprendizaje:{lecciones,obligatorio:true,instrucciones:'Lee todas las lecciones. Devuelve aprendizajes_aplicados [{id,cambio,motivo_no_aplica}]; las hipótesis son experimentos, no hechos. No copies datos de otras cuentas.'}, nicho: canal.nicho")
# Evitar conservar los tokens OAuth y la evidencia creativa en registros de ejecución de analytics.
APRENDE['settings'].update({'saveDataSuccessExecution':'none','saveDataErrorExecution':'none','saveExecutionProgress':False})
