"""Modo noticia: descubrimiento, evidencia, guion y guardias de medios/publicación."""
NOTICIA_JS = open(os.path.join(RAIZ,'tools/cooper/noticia.js'), encoding='utf-8').read()
W['noticia'] = 'FabNoticia000001'
f = Flow(W['noticia'], 'F · Noticia del día verificada')
trigger(f)
call(f, 'Leer ajustes', W['ajustes'])
code(f, 'Encargo de noticia', r"""
const e=$('Inicio').first().json, aj=$('Leer ajustes').first().json;
if (!e.canal_id || !e.nicho) throw new Error('Noticia sin canal o nicho');
return [{json:{tarea:'radar_noticia',costo_estimado_usd:aj.costoRadarUsd,body:{model:aj.modeloCritico,
  tools:[{type:'web_search'}],max_tool_calls:8,input:[{role:'user',content:[{type:'input_text',text:
  'Busca la noticia más relevante DEL DÍA del nicho ' + String(e.nicho).slice(0,450) + '. Ahora: ' + new Date().toISOString() + ', zona America/Lima. ' +
  'Solo hechos de fuentes primarias identificables. Nunca inventes datos ni uses imágenes de medios. Devuelve SOLO JSON {"noticia":{"titulo":"","fecha":"ISO con zona de la publicación de hoy","hechos":[{"id":"h1","dato":"afirmación completa","fuentes":[{"url":"https://...","titulo":"título de fuente","fecha":"ISO"}]}]}}. Si no hay noticia contrastable hoy devuelve {"noticia":null}. Hasta 12 hechos. Las URLs deben haberse consultado en esta búsqueda.'}]}]}}}];
""")
call(f, 'Radar de noticia', W['texto'])
code(f, 'Noticia candidata', TEXTO_JS + NOTICIA_JS + r"""
const r=$('Radar de noticia').first().json;
const n=leerTexto(r)?.noticia;
return [{json:{noticia:validarNoticia(n && {...n,fuentes_consultadas:r.fuentes_consultadas})}}];
""")
code(f, 'Encargo de verificación', r"""
const n=$('Noticia candidata').first().json.noticia, aj=$('Leer ajustes').first().json;
return [{json:{tarea:'verificador_noticia',costo_estimado_usd:aj.costoVerificacionUsd,body:{model:aj.modeloCritico,
  tools:[{type:'web_search'}],max_tool_calls:12,input:[{role:'user',content:[{type:'input_text',text:
  'Verifica independientemente CADA hecho de esta noticia en fuentes primarias actuales. Abre las fuentes y busca contradicciones. ' +
  'No cambies id ni dato. Devuelve SOLO JSON {"verificado":true,"hechos":[{"id":"h1","dato":"mismo dato","estado":"ok|sin_fuente|contradictorio","fuentes":[{"url":"https://...","titulo":"","fecha":"ISO"}]}],"resumen":""}. ' +
  'verificado solo true si TODOS se sostienen, sin dudas ni contradicciones. Las URLs deben haberse consultado. Fecha actual: ' + new Date().toISOString() + '\n' + JSON.stringify(n)}]}]}}}];
""")
call(f, 'Verificador de noticia', W['texto'])
code(f, 'Noticia verificada', TEXTO_JS + NOTICIA_JS + r"""
const r=$('Verificador de noticia').first().json;
return [{json:{canal_id:$('Inicio').first().json.canal_id,noticia:validarVerificacion($('Noticia candidata').first().json.noticia,leerTexto(r),r)}}];
""")
f.chain('Inicio','Leer ajustes','Encargo de noticia','Radar de noticia','Noticia candidata','Encargo de verificación','Verificador de noticia','Noticia verificada')
NOTICIA = f.dump()

def costo_noticia(wf, origen, concepto, video):
    f=reabrir(wf); p='Costo · ' + origen
    code(f,p,"const r=$('"+origen+"').first().json; const u=r.texto_uso; return [{json:{...u,video_id:"+video+",concepto:"+JS(concepto)+",servicio:u.ruta === 'codex' ? 'Codex (plan ChatGPT)' : 'OpenAI API',paso_id:String($execution.id)+':"+origen+"'}}];")
    call(f,p+' registrar',W['costo'])
    code(f,p+' seguir',"return $('"+origen+"').all();")
    f.chain(p,p+' registrar',p+' seguir'); despues(f,origen,p,p+' seguir')

for origen in ['Radar de noticia','Verificador de noticia']:
    costo_noticia(NOTICIA,origen,origen.lower(),"$('Inicio').first().json.video_id || ('canal:' + $('Inicio').first().json.canal_id)")

# Activación por canal mediante el evento existente ajustar_biblia.
f=reabrir(ORQ)
iff(f,'¿Configurar noticia?',"$('Inicio').first().json.campo === 'modo_noticia'")
code(f,'Modo noticia del canal',"const e=$('Inicio').first().json; let v=e.valor; try {v=JSON.parse(v);} catch {} if (typeof v !== 'boolean') throw new Error('Modo noticia debe ser booleano'); return [{json:{modo_noticia:v}}];")
dt_update(f,'Guardar modo noticia','canales','canal_id',"={{ $('Inicio').first().json.canal_id }}")
antes(f,'Biblia (ajuste)','¿Configurar noticia?','¿Configurar noticia?')
f.conn['¿Configurar noticia?']={'main':[[{'node':'Modo noticia del canal','type':'main','index':0}],[{'node':'Biblia (ajuste)','type':'main','index':0}]]}
f.chain('Modo noticia del canal','Guardar modo noticia')

# Congela la modalidad al crear el video. Un cambio de canal no rebaja una noticia en curso.
cambiar(ORQ,'Nuevo video',"const elegir = !String(e.tema || '').trim();", "const modo_noticia = typeof e.modo_noticia === 'boolean' ? e.modo_noticia : canal.modo_noticia === true;\nconst elegir = !String(e.tema || '').trim();")
cambiar(ORQ,'Nuevo video',"fila: { dueno_email:","fila: { modo_noticia, noticia:'', noticia_guion_hash:'', dueno_email:")
cambiar(ORQ,'Nuevo video',"noticia_guion_hash:''", "noticia_guion_hash:'', noticia_storyboard_hash:''")
cambiar(ORQ,'Nuevo video',"formato, etapa: 'guion'", "formato, etapa: modo_noticia ? 'radar' : 'guion'")
cambiar(ORQ,'Nuevo video',"datos: { presentacion:","datos: { modo_noticia, presentacion:")
f=reabrir(ORQ)
iff(f,'¿Video noticia?',"$('Nuevo video').first().json.fila.modo_noticia === true")
antes(f,'¿Investigar con vidIQ?','¿Video noticia?','¿Video noticia?')
f.conn['¿Video noticia?']={'main':[[{'node':'Pedido de noticia','type':'main','index':0}],[{'node':'¿Investigar con vidIQ?','type':'main','index':0}]]}
code(f,'Pedido de noticia',"const p=$('Nuevo video').first().json.pedido; return [{json:{canal_id:p.canal_id,video_id:p.video_id,nicho:p.datos.nicho}}];")
call(f,'Buscar noticia verificada',W['noticia'])
code(f,'Dossier del video',"return [{json:{noticia:JSON.stringify($json.noticia),etapa:'guion',tema:$json.noticia.titulo}}];")
dt_update(f,'Guardar noticia del video','videos','video_id',"={{ $('Nuevo video').first().json.fila.video_id }}")
f.chain('Pedido de noticia','Buscar noticia verificada','Dossier del video','Guardar noticia del video','Pedir guion')
cambiar(ORQ,'Pedir guion',"const vq =", "if (p.datos.modo_noticia) { const n=$('Buscar noticia verificada').first().json.noticia; return [{json:{...p,datos:{...p.datos,tema:n.titulo,elegir_tema:false,noticia:n,indicaciones:'Cuenta solo los hechos verificados, cita sus fuentes y fecha. No añadas cifras ni afirmaciones nuevas. Propón únicamente mapas, cifras y esquemas propios generados, nunca imágenes de medios.'}}}]; }\nconst vq =")

# Cada resultado de guion, incluso correcciones y crítico apagado, se verifica antes de seguir.
f=reabrir(ORQ)
iff(f,'¿Verificar guion noticia?',"$('Video (crítico)').first().json.modo_noticia === true")
antes(f,'¿Criticar guion?','¿Verificar guion noticia?','¿Verificar guion noticia?')
f.conn['¿Verificar guion noticia?']={'main':[[{'node':'Encargo de guion noticia','type':'main','index':0}],[{'node':'¿Criticar guion?','type':'main','index':0}]]}
code(f,'Encargo de guion noticia',NOTICIA_JS + r"""
const v=$('Video (crítico)').first().json, n=JSON.parse(v.noticia || 'null'), aj=$('Leer ajustes').first().json;
exigirNoticia(n);
return [{json:{tarea:'verificador_noticia',costo_estimado_usd:aj.costoVerificacionUsd,body:{model:aj.modeloCritico,tools:[{type:'web_search'}],max_tool_calls:12,
  input:[{role:'user',content:[{type:'input_text',text:'Audita todo el guion, título y ganchos contra los hechos y vuelve a consultar las fuentes. Si agrega afirmaciones o cifras no verificadas, contradice hechos o usa imágenes de medios, verificado=false y guion_cubierto=false. ' +
  'Devuelve SOLO JSON {"verificado":true,"guion_cubierto":true,"hechos":[{"id":"mismo id","dato":"mismo dato","estado":"ok|sin_fuente|contradictorio","fuentes":[{"url":"https://...","titulo":"","fecha":"ISO"}]}],"resumen":""}. ' +
  'Todos los hechos deben aparecer. Cita URLs realmente consultadas. Ahora: '+new Date().toISOString()+'\n'+JSON.stringify({noticia:n,guion:$('Inicio').first().json.resultado})}]}]}}}];
""")
call(f,'Verificar guion noticia',W['texto'])
code(f,'Certificar guion noticia',TEXTO_JS + NOTICIA_JS + r"""
const r=$('Verificar guion noticia').first().json, result=leerTexto(r), v=$('Video (crítico)').first().json;
const n=validarVerificacion(JSON.parse(v.noticia || 'null'), result, r);
if (result.guion_cubierto !== true) throw new Error('Noticia detenida: guion con afirmaciones sin verificar');
return [{json:{noticia:JSON.stringify(n),noticia_guion_hash:huellaGuion($('Inicio').first().json.resultado)}}];
""")
dt_update(f,'Guardar verificación del guion','videos','video_id',"={{ $('Inicio').first().json.video_id }}")
f.chain('Encargo de guion noticia','Verificar guion noticia','Certificar guion noticia','Guardar verificación del guion','¿Criticar guion?')
costo_noticia(ORQ,'Verificar guion noticia','verificación del guion noticia',"$('Inicio').first().json.video_id")

# También el texto narrado y las cifras del storyboard se contrastan antes de aprobarlo.
f=reabrir(ORQ)
dt_get(f,'Video de storyboard noticia','videos','video_id',"={{ $('Inicio').first().json.video_id }}")
iff(f,'¿Verificar storyboard noticia?',"$('Video de storyboard noticia').first().json.modo_noticia === true")
code(f,'Encargo de storyboard noticia',NOTICIA_JS + r"""
const v=$('Video de storyboard noticia').first().json, n=JSON.parse(v.noticia || 'null'), aj=$('Leer ajustes').first().json;
exigirGuion(v,null); exigirVisuales($('Inicio').first().json.resultado);
return [{json:{tarea:'verificador_noticia',costo_estimado_usd:aj.costoVerificacionUsd,body:{model:aj.modeloCritico,tools:[{type:'web_search'}],max_tool_calls:12,
input:[{role:'user',content:[{type:'input_text',text:'Contrasta TODA la narración, textos en pantalla, cifras, mapas, prompts y miniatura del storyboard con estos hechos. Consulta de nuevo las fuentes. No admitas datos añadidos o contradicciones. ' +
'Devuelve SOLO JSON {"verificado":true,"guion_cubierto":true,"hechos":[{"id":"mismo id","dato":"mismo dato","estado":"ok|sin_fuente|contradictorio","fuentes":[{"url":"https://...","titulo":"","fecha":"ISO"}]}],"resumen":""}. guion_cubierto=true solo si todo el storyboard está respaldado. Ahora: '+new Date().toISOString()+'\n'+JSON.stringify({noticia:n,storyboard:$('Inicio').first().json.resultado})}]}]}}}];
""")
call(f,'Verificar storyboard noticia',W['texto'])
code(f,'Certificar storyboard noticia',TEXTO_JS + NOTICIA_JS + r"""
const r=$('Verificar storyboard noticia').first().json, result=leerTexto(r), v=$('Video de storyboard noticia').first().json;
const n=validarVerificacion(JSON.parse(v.noticia || 'null'),result,r);
if (result.guion_cubierto !== true) throw new Error('Noticia detenida: storyboard sin respaldo completo');
return [{json:{noticia:JSON.stringify(n),noticia_storyboard_hash:huellaGuion($('Inicio').first().json.resultado)}}];
""")
dt_update(f,'Guardar verificación del storyboard','videos','video_id',"={{ $('Inicio').first().json.video_id }}")
code(f,'Restaurar storyboard noticia',"return [{json:$('Inicio').first().json}];")
antes(f,'Mensaje de storyboard','Video de storyboard noticia','Restaurar storyboard noticia')
f.chain('Video de storyboard noticia','¿Verificar storyboard noticia?')
f.link('¿Verificar storyboard noticia?','Encargo de storyboard noticia',0)
f.link('¿Verificar storyboard noticia?','Restaurar storyboard noticia',1)
f.chain('Encargo de storyboard noticia','Verificar storyboard noticia','Certificar storyboard noticia','Guardar verificación del storyboard','Restaurar storyboard noticia')
costo_noticia(ORQ,'Verificar storyboard noticia','verificación del storyboard noticia',"$('Inicio').first().json.video_id")

# Una corrección invalida el certificado previo antes de llamar al redactor.
for destino, campos in [('Claude: corregir',"noticia_guion_hash:'',noticia_storyboard_hash:''"),
                        ('Claude: corregir (crítico)',"noticia_guion_hash:'',noticia_storyboard_hash:''"),
                        ('Claude: storyboard corregido',"noticia_storyboard_hash:''"),
                        ('Encargo de guion noticia',"noticia_guion_hash:'',noticia_storyboard_hash:''"),
                        ('Encargo de storyboard noticia',"noticia_storyboard_hash:''")]:
    if not any(n['name']==destino for n in ORQ['nodes']):
        raise ValueError('Destino de invalidación desconocido: '+destino)
    f=reabrir(ORQ); p='Invalidar · '+destino
    code(f,p+' entrada','return $input.all();')
    code(f,p+' campos','return [{json:{'+campos+'}}];')
    dt_update(f,p+' guardar','videos','video_id',"={{ $('Inicio').first().json.video_id }}")
    code(f,p+' seguir',"return $('"+p+" entrada').all();")
    f.chain(p+' entrada',p+' campos',p+' guardar',p+' seguir'); antes(f,destino,p+' entrada',p+' seguir')

# La aprobación de guion comprueba la huella persistida; no confía en flags del evento.
n=next(n for n in ORQ['nodes'] if n['name']=='Pedir storyboard')
n['parameters']['jsCode']=NOTICIA_JS + "\nexigirGuion($('Video').first().json, $('Inicio').first().json.contexto);\n" + n['parameters']['jsCode']
cambiar(ORQ,'Pedir storyboard',"datos: { guion: e.contexto", "datos: { modo_noticia: $('Video').first().json.modo_noticia === true, noticia: JSON.parse($('Video').first().json.noticia || 'null'), noticia_instrucciones: 'Si modo_noticia: cada plano tipo imagen o clip, origen_visual generado, recurso_didactico mapa|cifra|esquema, hecho_ids de los hechos verificados; solo imágenes didácticas propias sin URLs, fotos de medios ni avatares. No inventes cifras.', guion: e.contexto")
n=next(n for n in ORQ['nodes'] if n['name']=='Encargo de producción')
n['parameters']['jsCode']=NOTICIA_JS + '\n' + n['parameters']['jsCode']
cambiar(ORQ,'Encargo de producción',"return [{ json: { video_id:","exigirGuion(v,guion); exigirStoryboard(v,e.contexto);\nreturn [{ json: { modo_noticia:v.modo_noticia === true, noticia:JSON.parse(v.noticia || 'null'), noticia_guion_hash:v.noticia_guion_hash || '', video_id:")
cambiar(ORQ,'Encargo de producción',"storyboard: e.contexto, guion, biblia, notas:","storyboard: e.contexto, guion, biblia: v.modo_noticia ? {...biblia,personajes:[],escenarios:[]} : biblia, notas:")
n=next(n for n in PROD['nodes'] if n['name']=='Plan de producción')
n['parameters']['jsCode']=NOTICIA_JS + '\n' + n['parameters']['jsCode']
cambiar(PROD,'Plan de producción',"const presentacion =", "if (e.modo_noticia) { exigirNoticia(e.noticia); exigirVisuales(e.storyboard); if (e.noticia_guion_hash !== huellaGuion(e.guion) || e.presentacion?.avatar) throw new Error('Noticia sin guion verificado o con avatar incompatible'); }\nconst presentacion =")

# Defensa en la entrada real de producción y en ambas salidas de publicación.
def guardia_noticia(wf,destino,guion=None):
    f=reabrir(wf); p='Noticia · '+destino
    code(f,p+' entrada','return $input.all();')
    dt_get(f,p+' video','videos','video_id',"={{ $('Inicio').first().json.video_id }}")
    extra="if (v.modo_noticia) { exigirStoryboard(v,$('Inicio').first().json.storyboard); if ($('Inicio').first().json.modo_noticia !== true) throw new Error('Modalidad de noticia incompatible'); }" if guion else "if (v.modo_noticia && !v.noticia_storyboard_hash) throw new Error('Noticia sin storyboard verificado');"
    code(f,p+' validar',NOTICIA_JS + "\nconst v=$('"+p+" video').first().json; if (!v.video_id) throw new Error('Video no encontrado'); exigirGuion(v,"+(guion or 'null')+"); "+extra+" return $('"+p+" entrada').all();")
    f.chain(p+' entrada',p+' video',p+' validar'); antes(f,destino,p+' entrada',p+' validar')
guardia_noticia(PROD,'Plan de producción',"$('Inicio').first().json.guion")
guardia_noticia(ORQ,'Canal (publicar)')
guardia_noticia(REDES,'Subir a redes')

# Radar diario de noticias independiente de los créditos de vidIQ, acotado por canal solicitado.
f=reabrir(RADAR)
iff(f,'¿Radar de noticias activo?',"$('Leer ajustes').first().json.allowRadar === true")
lista_cooper(f,'Canales de noticias','canales',[{'keyName':'modo_noticia','condition':'eq','keyValue':True}])
code(f,'Pedidos de noticias',"const e=$('Inicio').isExecuted ? $('Inicio').first().json : {}; return $input.all().filter(i=>i.json.canal_id && i.json.estado === 'activo' && !i.json.eliminado && (!e.canal_id || e.canal_id === i.json.canal_id));")
call(f,'Noticias del día',W['noticia'],each=True)
code(f,'Noticias para guardar',"return $input.all().map(i=>({json:{canal_id:i.json.canal_id,noticia_hoy:JSON.stringify(i.json.noticia)}}));")
dt_update(f,'Guardar noticias del día','canales','canal_id','={{ $json.canal_id }}')
f.link('Leer ajustes','¿Radar de noticias activo?'); f.link('¿Radar de noticias activo?','Canales de noticias',0)
f.chain('Canales de noticias','Pedidos de noticias','Noticias del día','Noticias para guardar','Guardar noticias del día')
