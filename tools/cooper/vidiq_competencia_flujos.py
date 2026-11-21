"""vidIQ opcional por canal, con cuota renovable acreditada y respaldo gratuito."""
VIDIQ_COMP_JS = open(os.path.join(RAIZ, 'tools/cooper/vidiq_competencia.js'), encoding='utf-8').read()
f = reabrir(COMPETENCIA_YOUTUBE)
call(f, 'Ajustes de investigación incluida', W['ajustes'])
iff(f, '¿vidIQ habilitado?', '$json.allowVidiq === true')

def http_vidiq_competencia(nombre, cuerpo, inicial=False):
    cabeceras={'Content-Type':'application/json','Accept':'application/json, text/event-stream'}
    if not inicial:
        cabeceras['mcp-session-id']="={{ $('Iniciar vidIQ de competencia').first().json.headers?.['mcp-session-id'] || '' }}"
        cabeceras['MCP-Protocol-Version']='2025-03-26'
    http(f,nombre,'POST','https://mcp.vidiq.com/mcp',body=cuerpo,cred=CRED_VIDIQ,headers=cabeceras,timeout=15000)
    n=f.nodes[-1]
    n.update({'onError':'continueRegularOutput','retryOnFail':False})
    n['parameters']['options'].update({'redirect':{'redirect':{'followRedirects':False}},
        'response':{'response':{'fullResponse':True,'responseFormat':'text','neverError':True}}})

http_vidiq_competencia('Iniciar vidIQ de competencia',json.dumps({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'cooper-competencia-cuota','version':'1'}}}),True)
http_vidiq_competencia('Notificar vidIQ de competencia',json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'}))
http_vidiq_competencia('Catálogo vidIQ de competencia',json.dumps({'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}}))
http_vidiq_competencia('Cuota renovable antes',json.dumps({'jsonrpc':'2.0','id':10,'method':'tools/call','params':{'name':'vidiq_balance','arguments':{}}}))
code(f,'Guardia vidIQ de competencia',VIDIQ_COMP_JS+r"""
const p=$('Competencia nativa comprobada').first().json;let t;try{t=JSON.parse(p.tendencias||'{}');}catch{t={};}
return [{json:guardiaVidiqCompetencia($json,$('Catálogo vidIQ de competencia').first().json,t.competencia)}];
""")
iff(f,'¿Cuota renovable acreditada?', '$json.ok === true')
http_vidiq_competencia('Un pedido de destacados incluido', '={{ $json.cuerpo }}')
http_vidiq_competencia('Cuota renovable después',json.dumps({'jsonrpc':'2.0','id':11,'method':'tools/call','params':{'name':'vidiq_balance','arguments':{}}}))
code(f,'Competencia con cuota comprobada',COMPETENCIA_JS+'\n'+VIDIQ_COMP_JS+r"""
const resultado=n=>$(n).isExecuted?$(n).first().json:undefined;
return [{json:incorporarVidiqCompetencia($('Competencia nativa comprobada').first().json,
 resultado('Guardia vidIQ de competencia'),resultado('Un pedido de destacados incluido'),resultado('Cuota renovable después'),
 resultado('Ajustes de investigación incluida')?.allowVidiq===true)}];
""")
f.chain('Competencia nativa comprobada','Ajustes de investigación incluida','¿vidIQ habilitado?',
 'Iniciar vidIQ de competencia','Notificar vidIQ de competencia','Catálogo vidIQ de competencia','Cuota renovable antes',
 'Guardia vidIQ de competencia','¿Cuota renovable acreditada?','Un pedido de destacados incluido',
 'Cuota renovable después','Competencia con cuota comprobada')
f.link('¿vidIQ habilitado?','Competencia con cuota comprobada',1)
f.link('¿Cuota renovable acreditada?','Competencia con cuota comprobada',1)
COMPETENCIA_YOUTUBE['settings']['executionTimeout']=330
