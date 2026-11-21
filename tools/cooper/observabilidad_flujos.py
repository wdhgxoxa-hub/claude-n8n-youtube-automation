"""Medios, métricas e incidencias para Cooper. Generación offline; no despliega."""
OBS_JS = open(os.path.join(RAIZ, 'tools/cooper/observabilidad.js'), encoding='utf-8').read()
# Leer tablas públicas solo tras autenticar; la proyección cruza cada fila con videos/canales autorizados.
f = reabrir(COOPER)
for nombre, tabla in [('Piezas de Cooper','planos'), ('Publicaciones de Cooper','publicaciones'), ('Historial de Cooper','eventos'), ('Decisiones de Cooper','aprobaciones'), ('Lecciones de Cooper','trabajos')]:
    filtros = [{'keyName':'modo','condition':'eq','keyValue':'aprender'}] if tabla == 'trabajos' else []
    lista_cooper(f,nombre,tabla,filtros)
iff(f,'¿Consultar resultados de Cooper?',"$('Autenticar').first().json.solicitud.evento === 'estado'")
antes(f,'Resolver','¿Consultar resultados de Cooper?','Lecciones de Cooper')
f.link('¿Consultar resultados de Cooper?','Piezas de Cooper',0)
f.link('¿Consultar resultados de Cooper?','Resolver',1)
f.chain('Piezas de Cooper','Publicaciones de Cooper','Historial de Cooper','Decisiones de Cooper','Lecciones de Cooper')
# Persistir las URLs de sonido y de los planos elegidos, sin prompts ni evidencias de identidad.
f = reabrir(PROD)
code(f,'Cooper · piezas terminadas',r"""
const son=$('Sonido y emoción').first().json;
const orden=$('Plan de producción').first().json.planos.map(p=>p.id);
// La composición devuelve un conteo; los archivos definitivos (incluido avatar) vienen de sonido.
const planos=(son.planos || $('Juntar planos').first().json.planos || [])
 .filter(p=>orden.includes(p.plano_id)).sort((a,b)=>orden.indexOf(a.plano_id)-orden.indexOf(b.plano_id));
const voces=son.voces || [];
return [{json:{cooper_escenas:JSON.stringify(planos.map((p,i)=>({id:String(p.plano_id || p.plano?.id || i),orden:i,
 imagen:!['clip','archivo','avatar'].includes(p.plano?.tipo || p.tipo)?p.url || '':'',
 clip:['clip','archivo','avatar'].includes(p.plano?.tipo || p.tipo)?p.url || '':'',
 voz:voces.find(v=>v.plano_id===(p.plano_id || p.plano?.id))?.url || ''})))}}];
""")
dt_update(f,'Cooper · guardar piezas','videos','video_id',"={{ $('Plan de producción').first().json.video_id }}")
f.chain('Composición Creatomate','Cooper · piezas terminadas','Cooper · guardar piezas')
# Confirmación conserva una fila por red incluso cuando otra red del mismo envío falla.
cambiar(CONFIRMAR,'Leer resultados',"resultado: JSON.stringify(listo ? { status: st, urls } : { status: st || 'failed', errores }).slice(0, 800)",
 "resultado: JSON.stringify({ status: st, urls, errores, publicaciones: res.map(x=>({red:String(x.platform || ''),url:x.post_url || x.url || '',publicado:x.success === true})) })")
# Medición diaria acotada y justa: primero publicaciones que llevan más tiempo sin intentar actualizarse.
f = reabrir(APRENDE)
for nombre in ['Publicaciones','Videos publicados']:
    n=next(n for n in f.nodes if n['name']==nombre)
    n['parameters']['filters']['conditions'] = [] if nombre == 'Publicaciones' else [{'keyName':'estado','condition':'eq','keyValue':'publicado'}]
for nombre in ['Toca medir','Toca medir en redes']:
    n=next(n for n in f.nodes if n['name']==nombre)
    if nombre == 'Toca medir':
        n['parameters']['jsCode'] = r"""
const hoy=Date.now(), dia=86400000;
const toca=$input.all().map(i=>i.json).filter(v=>v.youtube_id && v.publicado_en && (!v.metricas_consultadas_en || hoy-Date.parse(v.metricas_consultadas_en)>=dia))
 .sort((a,b)=>String(a.metricas_consultadas_en || '').localeCompare(String(b.metricas_consultadas_en || ''))).slice(0,100);
return toca.length?toca.map(v=>({json:{...v,dias:Math.floor((hoy-Date.parse(v.publicado_en))/dia),desde:v.publicado_en.slice(0,10)}})):[{json:{nada:true}}];
"""
    else:
        n['parameters']['jsCode'] = r"""
const hoy=Date.now(),dia=86400000;
const toca=$input.all().map(i=>i.json).filter(p=>p.request_id && p.publicado_en && ['publicado','error'].includes(p.estado) && (!p.metricas_consultadas_en || hoy-Date.parse(p.metricas_consultadas_en)>=dia))
 .sort((a,b)=>String(a.metricas_consultadas_en || '').localeCompare(String(b.metricas_consultadas_en || ''))).slice(0,100)
 .map(p=>({...p,dias:Math.floor((hoy-Date.parse(p.publicado_en))/dia)}));
return toca.length?toca.map(p=>({json:p})):[{json:{nada:true}}];
"""
code(f,'Cooper · historial de redes',OBS_JS+r"""
const pedidos=$('Toca medir en redes').all().map(i=>i.json);
return $input.all().map((i,k)=>({json:{request_id:pedidos[k].request_id,metricas_historial:historialRedesCooper(pedidos[k],i.json,Date.now()),metricas_consultadas_en:new Date().toISOString()}}));
""")
dt_update(f,'Cooper · guardar métricas de redes','publicaciones','request_id','={{ $json.request_id }}')
f.chain('Métricas en redes','Cooper · historial de redes','Cooper · guardar métricas de redes')
f.add('Cooper · métricas YouTube','n8n-nodes-base.httpRequest',4.2,{
 'method':'GET','url':'https://youtubeanalytics.googleapis.com/v2/reports','sendHeaders':True,
 'headerParameters':{'parameters':[{'name':'Authorization','value':"={{ 'Bearer ' + $json.token }}"}]},
 'sendQuery':True,'queryParameters':{'parameters':[
 {'name':'ids','value':'channel==MINE'},{'name':'metrics','value':'views,likes,comments,averageViewPercentage'},
 {'name':'filters','value':"={{ 'video==' + $json.youtube_id }}"}, {'name':'startDate','value':'={{ $json.desde }}'},
 {'name':'endDate','value':"={{ $now.toFormat('yyyy-MM-dd') }}"}]},'options':{'timeout':30000,'batching':{'batch':{'batchSize':1,'batchInterval':3100}}}},onError='continueRegularOutput')
code(f,'Cooper · historial YouTube',OBS_JS+r"""
const pedidos=$('Pedidos de retención').all().map(i=>i.json),fecha=new Date().toISOString();
return $input.all().map((i,k)=>{const v=pedidos[k],r=i.json,prev=jsonCooper(v.metricas_youtube,[]);
 const nombres=(r.columnHeaders || []).map(c=>c.name), fila=r.rows?.[0];
 const campos=fila?Object.fromEntries(nombres.map((n,j)=>[n,fila[j]])):null;
 const ret=numeroCooper(campos?.averageViewPercentage);
 const dato=campos?{fecha,vistas:numeroCooper(campos.views),meGusta:numeroCooper(campos.likes),comentarios:numeroCooper(campos.comments),retencion:ret===null?null:Math.min(1,ret/100)}:null;
 return {json:{video_id:v.video_id,metricas_consultadas_en:fecha,metricas_youtube:JSON.stringify(dato?[...prev.filter(x=>x.fecha?.slice(0,10)!==fecha.slice(0,10)),dato].slice(-90):prev)}};
});
""")
dt_update(f,'Cooper · guardar métricas YouTube','videos','video_id','={{ $json.video_id }}')
f.link('¿Algún canal conectado?','Cooper · métricas YouTube',0)
f.chain('Cooper · métricas YouTube','Cooper · historial YouTube','Cooper · guardar métricas YouTube')
# Mantener el análisis con Claude a los días 2 y 7; la captura diaria no añade llamadas de IA.
cambiar(APRENDE,'Pedir lecciones',"for (const v of vids)","for (const v of vids.filter(v=>v.dias === 2 || v.dias === 7))")
cambiar(APRENDE,'Pedir lecciones',"for (const r of redes)","for (const r of redes.filter(v=>v.dias === 2 || v.dias === 7))")
n=next(n for n in APRENDE['nodes'] if n['name']=='Métricas en redes')
n['parameters'].setdefault('options',{})['batching']={'batch':{'batchSize':1,'batchInterval':3100}}
# Historial de revisión con resolución explícita, sin copiar mensajes internos ni importes.
f=reabrir(ORQ)
code(f,'Cooper · resultado de revisión',r"""
const e=$('Inicio').first().json,v=$('Veredicto del crítico').first().json;
if (!e.video_id || v.por_cifras) return [];
return [{json:{video_id:e.video_id,canal_id:e.canal_id || '',evento:String($execution.id)+':revision',
 tipo:v.pasa && v.leido?'correccion_cooper':'incidencia_cooper',detalle:JSON.stringify(v.pasa && v.leido?{tipos:['critico'],cambio:'El guion revisado superó la revisión de gancho, claridad y exactitud.'}:{tipo:'critico',resumen:v.leido?'La revisión del guion pidió reforzar el gancho, la claridad o la exactitud.':'No se pudo completar la revisión automática del guion.'})}}];
""")
dt_insert(f,'Cooper · guardar revisión','eventos')
f.chain('Veredicto del crítico','Cooper · resultado de revisión','Cooper · guardar revisión')
f=reabrir(PUB)
code(f,'Cooper · incidencia de calidad',"const e=$('Inicio').first().json; return [{json:{video_id:e.video_id,canal_id:e.canal_id || '',evento:String($execution.id)+':calidad',tipo:'incidencia_cooper',detalle:JSON.stringify({tipo:'calidad',resumen:'El montaje no superó el control de calidad; necesita una nueva revisión.'})}}];")
dt_insert(f,'Cooper · guardar fallo de calidad','eventos')
f.chain('Video rechazado por calidad','Cooper · incidencia de calidad','Cooper · guardar fallo de calidad')
# Atribución de ejecuciones mediante un registro mínimo; el trigger de error no incluye datos del pedido.
for wf in [ORQ,PROD,SONIDO,PUB,REDES,NOTICIA]:
    f=reabrir(wf)
    code(f,'Cooper · atribuir ejecución',"const e=$('Inicio').first().json; const video_id=e.video_id || e.plan?.video_id; return video_id?[{json:{video_id,canal_id:e.canal_id || e.plan?.canal_id || '',tipo:'ejecucion_cooper',evento:String($execution.id),detalle:'{}'}}]:[];")
    dt_insert(f,'Cooper · guardar atribución','eventos')
    iff(f,'¿Atribuir ejecución a video?',"!!($('Inicio').first().json.video_id || $('Inicio').first().json.plan?.video_id)")
    code(f,'Cooper · continuar ejecución',"return $('Inicio').all();")
    despues(f,'Inicio','¿Atribuir ejecución a video?','Cooper · continuar ejecución')
    f.link('¿Atribuir ejecución a video?','Cooper · atribuir ejecución',0)
    f.link('¿Atribuir ejecución a video?','Cooper · continuar ejecución',1)
    f.chain('Cooper · atribuir ejecución','Cooper · guardar atribución','Cooper · continuar ejecución')
f=reabrir(ERRORES)
lista_cooper(f,'Cooper · ejecución fallida','eventos',[{'keyName':'tipo','condition':'eq','keyValue':'ejecucion_cooper'},{'keyName':'evento','condition':'eq','keyValue':"={{ String($('Error en un flujo').first().json.execution?.id || '__sin_id__') }}"}])
code(f,'Cooper · fallo público',r"""
const e=$('Error en un flujo').first().json;
return $input.all().map(i=>i.json).filter(v=>v.video_id).map(v=>({json:{video_id:v.video_id,canal_id:v.canal_id || '',tipo:'incidencia_cooper',evento:String(e.execution?.id)+':error',detalle:JSON.stringify({tipo:'ejecucion',resumen:'La ejecución se interrumpió y necesita revisión antes de continuar.'})}}));
""")
dt_insert(f,'Cooper · guardar fallo público','eventos')
f.chain('Error en un flujo','Cooper · ejecución fallida','Cooper · fallo público','Cooper · guardar fallo público')

# Las correcciones pedidas desde Cooper llegan por el mismo evento del Orquestador.
f=reabrir(ORQ)
code(f,'Cooper · cambio solicitado',OBS_JS+r"""
const e=$('Inicio').first().json;
return e.evento==='corregir' && e.video_id?[{json:{video_id:e.video_id,canal_id:e.canal_id || '',tipo:'incidencia_cooper',evento:String($execution.id)+':cambio',detalle:JSON.stringify({tipo:'correccion',resumen:textoCooper(e.instruccion || 'Se solicitaron cambios en este video.')})}}]:[];
""")
dt_insert(f,'Cooper · guardar cambio solicitado','eventos')
f.chain('Cooper · continuar ejecución','Cooper · cambio solicitado','Cooper · guardar cambio solicitado')
code(f,'Cooper · revisión aprobada',r"""
const e=$('Inicio').first().json;
return e.evento==='aprobado' && e.video_id?[{json:{video_id:e.video_id,canal_id:e.canal_id || '',tipo:'correccion_cooper',evento:String($execution.id)+':aprobacion',detalle:JSON.stringify({tipos:['correccion'],cambio:'La nueva versión recibió aprobación humana después de revisar los cambios.'})}}]:[];
""")
dt_insert(f,'Cooper · guardar revisión aprobada','eventos')
f.chain('Cooper · continuar ejecución','Cooper · revisión aprobada','Cooper · guardar revisión aprobada')
f=reabrir(PUB)
code(f,'Cooper · calidad superada',"const e=$('Inicio').first().json; return [{json:{video_id:e.video_id,canal_id:e.canal_id || '',tipo:'correccion_cooper',evento:String($execution.id)+':calidad_ok',detalle:JSON.stringify({tipos:['calidad'],cambio:'El nuevo montaje superó el control de calidad de imagen, sonido y duración.'})}}];")
dt_insert(f,'Cooper · guardar calidad superada','eventos')
f.link('¿Pasa calidad?','Cooper · calidad superada',0)
f.chain('Cooper · calidad superada','Cooper · guardar calidad superada')

f=reabrir(ORQ)
code(f,'Cooper · resultado de verificación',r"""
const e=$('Inicio').first().json,v=$('Cifras verificadas').first().json;
if (!e.video_id || !$('Verificar cifras').isExecuted) return [];
const ok=v.leido && !v.corregir;
return [{json:{video_id:e.video_id,canal_id:e.canal_id || '',evento:String($execution.id)+':verificacion',tipo:ok?'correccion_cooper':'incidencia_cooper',detalle:JSON.stringify(ok?{tipos:['verificador'],cambio:'Se contrastaron las cifras del guion revisado y no se pidieron más cambios.'}:{tipo:'verificador',resumen:v.leido?'Se pidieron cambios en cifras o fuentes del guion.':'No se pudo completar la verificación de cifras.'})}}];
""")
dt_insert(f,'Cooper · guardar verificación','eventos')
f.chain('Cifras verificadas','Cooper · resultado de verificación','Cooper · guardar verificación')
