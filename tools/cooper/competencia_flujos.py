"""Radar público sin gasto: evidencia, homónimos y contexto obligatorio antes del guion."""
COMPETENCIA_JS = open(os.path.join(RAIZ, 'cooper/src/contratos/competencia.mjs'), encoding='utf-8').read().replace('export function ', 'function ')
# Un pedido de investigación nunca hereda el permiso global de respaldo pago.
cambiar(TEXTO, 'Pedido de texto', 'api_permitida:aj.allowTextoApi === true', 'api_permitida:aj.allowTextoApi === true && e.sin_api !== true')
n=next(n for n in TEXTO['nodes'] if n['name']=='Intentar Codex')
n['parameters']['options']['timeout']="={{ $('Pedido de texto').first().json.tarea === 'radar' && $('Pedido de texto').first().json.local.buscar_web ? 190000 : 45000 }}"
f = reabrir(RADAR)
# Publicar permite los pedidos internos; el horario queda detenido hasta aceptar
# las fuentes reales y revisar también su rama de noticias, que conserva APIs.
for n in f.nodes:
    if n['type'] == 'n8n-nodes-base.scheduleTrigger':
        n['disabled'] = True
n=next(n for n in f.nodes if n['name']=='¿Solo ver?')
n['parameters']['conditions']['conditions'][0]['leftValue']="={{ !['correr','antes_idea'].includes($('Inicio').first().json.accion) }}"
code(f, 'Encargo público de competencia', COMPETENCIA_JS + r"""
return $('Pedidos de radar').all().map(i => ({json:{...i.json,tarea:'radar',sin_api:true,costo_estimado_usd:0,
 body:{tools:[{type:'web_search'}],input:[{role:'user',content:[{type:'input_text',text:promptCompetencia(i.json)}]}]}}}));
""")
call(f, 'Investigar competencia pública', W['texto'], each=True)
f.nodes[-1]['onError'] = 'continueRegularOutput'
code(f, 'Competencia comprobada', TEXTO_JS + COMPETENCIA_JS + r"""
const pedidos=$('Pedidos de radar').all().map(i=>i.json);
return $input.all().map((i,k)=>{const p=pedidos[k], r=leerTexto(i.json), competencia=normalizarCompetencia(r,i.json,p.nombre);
 const fuentes=new Set(competencia.competidores.flatMap(c=>c.outliers.map(v=>v.url)));
 const ideas=competenciaVigente(competencia) ? (Array.isArray(r?.ideas)?r.ideas:[]).filter(x=>fuentes.has(x.fuente_url) && typeof x.titulo==='string' && typeof x.gancho==='string').slice(0,5).map(x=>({titulo:x.titulo.slice(0,200),gancho:x.gancho.slice(0,500),red:['youtube','tiktok','instagram','facebook'].includes(x.red)?x.red:'youtube',formato:x.formato==='largo'?'largo':'short',por_que:String(x.por_que||'').slice(0,600),fuente:'Publicación pública consultada',fuente_url:x.fuente_url})) : [];
 return {json:{canal_id:p.canal_id,nombre:p.nombre,ok:true,creditos:0,tendencias:JSON.stringify({fecha:competencia.fecha,resumen:competencia.resumen,competencia,ideas,sonidos:[],formatos:[]})}};});
""")
# Mantener las rutas anteriores desconectadas y explícitamente inactivas para revisión.
legados = {'vidIQ: radar','Encargo del analista','Analista de tendencias','Radar del canal',
 'Cooper · costo Analista de tendencias','Cooper · costo Analista de tendencias registrar',
 'Cooper · costo Analista de tendencias seguir','Cooper · identificar Cooper · costo Analista de tendencias registrar',
 'Texto · Analista de tendencias'}
for legado in f.nodes:
    if legado['name'] in legados:
        legado['disabled'] = True
f.conn['¿Hay canales?']['main'][0] = [{'node':'Encargo público de competencia','type':'main','index':0}]
f.chain('Encargo público de competencia','Investigar competencia pública','Competencia comprobada','Solo tendencias')
n=next(n for n in f.nodes if n['name']=='Solo tendencias')
n['parameters']['jsCode']="return $input.all().filter(i=>i.json.ok).map(i=>({json:{canal_id:i.json.canal_id,tendencias:i.json.tendencias}}));"
n=next(n for n in f.nodes if n['name']=='¿Radar encendido?')
n['parameters']['conditions']['conditions'][0]['leftValue']="={{ $('Leer ajustes').first().json.allowRadar === true || ($('Inicio').isExecuted && $('Inicio').first().json.accion === 'antes_idea') }}"
# El chequeo obligatorio no abre el radar diario de noticias ni consume APIs.
n=next(n for n in f.nodes if n['name']=='¿Radar de noticias activo?')
n['parameters']['conditions']['conditions'][0]['leftValue']="={{ $('Leer ajustes').first().json.allowRadar === true && !($('Inicio').isExecuted && $('Inicio').first().json.accion === 'antes_idea') }}"
code(f,'Resultado del radar público',"return $('Competencia comprobada').all();")
iff(f,'¿Avisar radar público?',"!($('Inicio').isExecuted && $('Inicio').first().json.accion === 'antes_idea')")
n=next(n for n in f.nodes if n['name']=='Mensaje de radar')
n['parameters']['jsCode']=r"""
const lineas=$('Competencia comprobada').all().map(i=>{const c=JSON.parse(i.json.tendencias).competencia;
 return `${i.json.nombre}: ${c.estado === 'listo' ? 'investigación disponible' : 'investigación incompleta'} · ${c.competidores.length} competidores.\n${c.resumen}`;});
return [{json:{texto:('📡 Competencia de hoy\n\n'+lineas.join('\n\n')+'\n\nFuentes y límites en Radar de Cooper.').slice(0,3900)}}];
"""
f.link('Guardar tendencias','¿Avisar radar público?')
f.link('¿Avisar radar público?','Mensaje de radar',0)
f.link('¿Avisar radar público?','Resultado del radar público',1)
f.link('Aviso: radar','Resultado del radar público')

# Ejecutar una investigación nueva antes de cada pedido, incluidos tema manual y rutina.
f = reabrir(ORQ)
code(f, 'Pedido de competencia previa', "return [{json:{accion:'antes_idea',canal_id:$('Buscar canal').first().json.canal_id}}];")
call(f, 'Radar antes de la idea', W['radar'])
dt_get(f, 'Canal con competencia', 'canales', 'canal_id', "={{ $('Buscar canal').first().json.canal_id }}")
code(f, 'Exigir competencia previa', COMPETENCIA_JS + r"""
const c=$('Canal con competencia').first().json; let t;try{t=JSON.parse(c.tendencias||'{}');}catch{t={};}
const investigado=$('Radar antes de la idea').all().map(i=>i.json).find(r=>r.canal_id===c.canal_id && r.ok===true);
// La vigencia de una fila anterior no acredita la investigación de este pedido.
if(!investigado || investigado.tendencias!==c.tendencias || !competenciaVigente(t.competencia)) throw new Error('Radar pendiente: faltan competidores, homónimos o muestra comparable. Revisa Radar antes de pedir una idea.');
return $('Temas recientes del canal').all();
""")
antes(f, 'Nuevo video', 'Pedido de competencia previa', 'Exigir competencia previa')
f.chain('Pedido de competencia previa','Radar antes de la idea','Canal con competencia','Exigir competencia previa')
cambiar(ORQ, 'Nuevo video', "const canal = $('Buscar canal').first().json;", "const canal = $('Canal con competencia').isExecuted ? $('Canal con competencia').first().json : $('Buscar canal').first().json;")
cambiar(ORQ, 'Nuevo video', "nicho: canal.nicho || '',", "competencia: (()=>{try{return JSON.parse(canal.tendencias||'{}').competencia||null;}catch{return null;}})(), nicho: canal.nicho || '',")

# Proyección pública cerrada, sin cuerpos remotos ni instrucciones internas.
n=next(n for n in COOPER['nodes'] if n['name']=='Resolver')
n['parameters']['jsCode'] = COMPETENCIA_JS + '\n' + n['parameters']['jsCode']
