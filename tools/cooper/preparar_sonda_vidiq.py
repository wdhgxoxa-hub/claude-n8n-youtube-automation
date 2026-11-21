#!/usr/bin/env python3
"""Prepara una sonda manual de vidIQ sin red, valores de credenciales ni gasto.

Solo initialize, tools/list y tres herramientas de lectura documentadas a 0 créditos.
La credencial es una referencia pública; n8n la usa sin extraerla al programa.
Requiere remapear la tabla de trabajos al entorno de destino antes de importar.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import uuid

RAIZ = Path(__file__).resolve().parents[2]
ID = 'CoopSondaVidIQ01'
GRATUITAS = ['vidiq_balance', 'vidiq_user_channels', 'vidiq_list_competitors']
SETTINGS = {'executionOrder': 'v1', 'timezone': 'America/Lima',
            'executionTimeout': 240, 'saveDataSuccessExecution': 'none',
            'saveDataErrorExecution': 'none', 'saveManualExecutions': False,
            'saveExecutionProgress': False}
LECTOR = r"""
const leer = (r, esperado) => {
 const cuerpo=r?.body ?? r?.data ?? '', t=typeof cuerpo==='string'?cuerpo:JSON.stringify(cuerpo);
 // Streamable HTTP permite JSON o SSE; un evento SSE puede tener varias líneas data:.
 const eventos=t.replace(/\r\n/g,'\n').split(/\n\n+/).map(b=>b.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')).filter(Boolean);
 let rpc={}; for(const x of eventos.length?eventos:[t]) { try {const p=JSON.parse(x);if(p.id===esperado&&p.jsonrpc==='2.0')rpc=p;}catch{}}
 let datos=rpc.result?.structuredContent;
 if(!datos)for(const c of rpc.result?.content || [])if(c.type==='text'){try{datos=JSON.parse(c.text);break;}catch{}}
 const codigo=Number(r?.statusCode || r?.error?.httpCode || r?.error?.statusCode || 0);
 const status=Number.isInteger(codigo)&&codigo>=100&&codigo<=599?codigo:0, error=!!(r?.error || rpc.error || rpc.result?.isError);
 // Clasificar dentro de n8n; nunca devolver el mensaje (puede contener datos del transporte).
 const nodo=typeof r?.error==='string'?r.error:JSON.stringify(r?.error || {});
 const fallo_nodo=!r?.error?null:/JSON.*(?:valid|v[aá]lid)|valid.*JSON/i.test(nodo)?'json_invalido':
  /paired.?item|expression|expresi[oó]n|referenced node/i.test(nodo)?'expresion':
  /credential|credencial/i.test(nodo)?'credencial_nodo':/timed?\s*out|timeout|ETIMEDOUT/i.test(nodo)?'timeout':
  /authoriz|unauthoriz|forbidden|401|403/i.test(nodo)?'autorizacion':
  /ENOTFOUND|ECONN|socket|network|certificate/i.test(nodo)?'red':
  /invalid character.*header|header.*invalid/i.test(nodo)?'cabecera_invalida':
  /bad request|request.*invalid|parameters/i.test(nodo)?'solicitud_invalida':
  /not.*found|does not exist/i.test(nodo)?'recurso_no_encontrado':
  /service.*(?:not able|failed|unavailable)|bad gateway/i.test(nodo)?'servicio':'otro';
 const texto=JSON.stringify(rpc.error || rpc.result?.content || []);
 const categoria=status===401?'no_autorizado':status===403?'sin_permiso':status===429?'limite_temporal':
  /expired|expiration|caduc/i.test(texto)?'acceso_caducado':/verif|authorize|connect.*channel/i.test(texto)?'requiere_conexion':
  /credit|balance|quota/i.test(texto)&&error?'limite_cuenta':error?'error_proveedor':status===200?'respuesta':'sin_respuesta';
 return {rpc,datos,status,error,categoria,fallo_nodo};
};
const salida=n=>$(n).isExecuted?$(n).all().map(i=>i.json):[];
"""


def nodo(nombre, tipo, parametros, version=2):
    return {'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'sonda-vidiq/' + nombre)),
            'name': nombre, 'type': 'n8n-nodes-base.' + tipo,
            'typeVersion': version, 'parameters': parametros, 'position': [0, 0]}


def preparar(tabla):
    original = json.loads((RAIZ / 'workflows/v2/FabVidiq00000001.json').read_text())
    referencia = next(n['credentials'] for n in original['nodes'] if n['name'] == 'Iniciar vidIQ')
    f = {'id': ID, 'name': 'Sonda Cooper · acceso vidIQ sin créditos', 'active': False,
         'nodes': [], 'connections': {}, 'settings': SETTINGS, 'staticData': None, 'pinData': {}, 'tags': []}

    def agregar(n):
        f['nodes'].append(n)

    def unir(a, b, salida=0):
        rutas = f['connections'].setdefault(a, {'main': []})['main']
        while len(rutas) <= salida:
            rutas.append([])
        rutas[salida].append({'node': b, 'type': 'main', 'index': 0})

    def http(nombre, cuerpo, inicial=False):
        cabeceras = [{'name': 'Content-Type', 'value': 'application/json'},
                     {'name': 'Accept', 'value': 'application/json, text/event-stream'}]
        if not inicial:
            cabeceras += [{'name': 'mcp-session-id', 'value': "={{ $('Inicializar').first().json.headers?.['mcp-session-id'] || '' }}"},
                         {'name': 'MCP-Protocol-Version', 'value': "={{ $('Comprobar inicio').first().json.protocolo }}"}]
        n = nodo(nombre, 'httpRequest', {'method': 'POST', 'url': 'https://mcp.vidiq.com/mcp',
            'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
            'sendHeaders': True, 'headerParameters': {'parameters': cabeceras},
            'sendBody': True, 'specifyBody': 'json',
            'jsonBody': cuerpo if isinstance(cuerpo, str) else json.dumps(cuerpo),
            'options': {'timeout': 30000, 'redirect': {'redirect': {'followRedirects': False}},
                        'response': {'response': {'fullResponse': True, 'responseFormat': 'text', 'neverError': True}},
                        'batching': {'batch': {'batchSize': 1, 'batchInterval': 200}}}}, 4.2)
        n.update({'credentials': copy.deepcopy(referencia), 'onError': 'continueRegularOutput'})
        agregar(n)

    agregar(nodo('Inicio', 'manualTrigger', {}, 1))
    http('Inicializar', {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
        'protocolVersion': '2025-03-26', 'capabilities': {},
        'clientInfo': {'name': 'cooper-sonda-gratuita', 'version': '1'}}}, True)
    agregar(nodo('Comprobar inicio', 'code', {'jsCode': LECTOR + r"""
const r=leer($json,1);return [{json:{ok:r.status===200&&!r.error&&!!r.rpc.result?.protocolVersion,
 protocolo:/^20\d\d-\d\d-\d\d$/.test(r.rpc.result?.protocolVersion)?r.rpc.result.protocolVersion:'2025-03-26'}}];
"""}))
    agregar(nodo('¿Autorizado?', 'if', {'conditions': {'options': {'version': 2},
        'conditions': [{'leftValue': '={{ $json.ok }}', 'rightValue': True,
                        'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
        'combinator': 'and'}}, 2.2))
    http('Notificar inicio', {'jsonrpc': '2.0', 'method': 'notifications/initialized'})
    http('Listar herramientas', {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}})
    agregar(nodo('Pedidos gratuitos', 'code', {'jsCode': LECTOR + '\nconst permitidas=' + json.dumps(GRATUITAS) + r""";
const r=leer($json,2);const pedidos=[];
if(r.status===200&&!r.error)for(const nombre of permitidas){
 const t=(r.rpc.result?.tools || []).find(t=>t.name===nombre);if(!t)continue;
 const requeridos=t.inputSchema?.required || [];
 if(requeridos.some(k=>k!=='userGoal'))continue;
 pedidos.push({json:{nombre,id:10+pedidos.length,args:requeridos.includes('userGoal')?{userGoal:'Comprobar acceso sin usar créditos ni cambiar la cuenta'}:{}}});
}
return pedidos.length?pedidos:[{json:{sin_pedidos:true}}];
"""}))
    agregar(nodo('¿Hay lecturas gratuitas?', 'if', {'conditions': {'options': {'version': 2},
        'conditions': [{'leftValue': '={{ $json.sin_pedidos !== true }}', 'rightValue': True,
                        'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
        'combinator': 'and'}}, 2.2))
    http('Leer cuenta sin créditos', "={{ JSON.stringify({jsonrpc:'2.0',id:$json.id,method:'tools/call',params:{name:$json.nombre,arguments:$json.args}}) }}")
    agregar(nodo('Diagnóstico mínimo', 'code', {'jsCode': LECTOR + r"""
const inicio=leer(salida('Inicializar')[0],1), lista=leer(salida('Listar herramientas')[0],2);
const nombres=['vidiq_balance','vidiq_user_channels','vidiq_list_competitors'];
const pedidos=salida('Pedidos gratuitos').filter(p=>nombres.includes(p.nombre));
const respuestas=salida('Leer cuenta sin créditos');
const ids=v=>{const encontrados=new Set();const visitar=(x,n=0)=>{if(n>8)return;if(typeof x==='string'&&/^UC[\w-]{22}$/.test(x))encontrados.add(x);else if(x&&typeof x==='object')for(const y of Object.values(x))visitar(y,n+1);};visitar(v);return [...encontrados].slice(0,30);};
const balance=v=>{const datos={};const visitar=(x,ruta='',n=0)=>{if(!x||typeof x!=='object'||n>5)return;
 for(const [k,y]of Object.entries(x)){if(!/^[\w-]{1,50}$/.test(k)||/token|secret|key|email|session|authorization/i.test(k))continue;
  const p=ruta?`${ruta}.${k}`:k;
  if(y&&typeof y==='object')visitar(y,p,n+1);
  else if(/credit|balance|remaining|renew|addon|reset|unlimited/i.test(p)&&
   (y===null||typeof y==='number'||typeof y==='boolean'||y==='unlimited'||/^\d{4}-\d\d-\d\d(?:T[\d:.+-]+Z?)?$/.test(String(y))))datos[p]=y;}};visitar(v);return datos;};
const consultas=pedidos.map((p,k)=>{const r=leer(respuestas[k],p.id);return {herramienta:p.nombre,http:r.status,
 ok:r.status===200&&!r.error&&!!r.rpc.result,categoria:r.categoria,fallo_nodo:r.fallo_nodo,
 creditos_usados:typeof r.datos?._credits?.used==='number'?r.datos._credits.used:null,
 ...(p.nombre==='vidiq_balance'?{saldo:balance(r.datos)}:{canales:ids(r.datos)})};});
const diagnostico={fecha:new Date().toISOString(),inicio:{http:inicio.status,categoria:inicio.categoria},
 lista:{http:lista.status,cantidad:Array.isArray(lista.rpc.result?.tools)?lista.rpc.result.tools.length:0,
 gratuitas:(lista.rpc.result?.tools || []).filter(t=>nombres.includes(t.name)).map(t=>({nombre:t.name,
  requeridos:(t.inputSchema?.required || []).filter(x=>/^[a-zA-Z0-9_]{1,60}$/.test(x))}))},
 consultas,investigacion_invocada:false,publicacion_invocada:false,credencial_extraida:false};
return [{json:{job_id:'vidiq-diag-'+String($execution.id),video_id:'',canal_id:'',modo:'vidiq_diagnostico',
 estado:consultas.some(c=>c.ok)?'listo':'bloqueado',resultado:JSON.stringify(diagnostico)}}];
"""}))
    guardar = copy.deepcopy(next(n for n in json.loads((RAIZ / 'workflows/v2/FabLlamarClaude1.json').read_text())['nodes'] if n['name'] == 'Registrar trabajo'))
    guardar.update({'name': 'Guardar diagnóstico mínimo', 'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'sonda-vidiq/guardar'))})
    guardar['parameters']['dataTableId']['value'] = tabla
    agregar(guardar)
    for a, b in [('Inicio','Inicializar'),('Inicializar','Comprobar inicio'),('Comprobar inicio','¿Autorizado?'),
                 ('¿Autorizado?','Notificar inicio'),('Notificar inicio','Listar herramientas'),
                 ('Listar herramientas','Pedidos gratuitos'),('Pedidos gratuitos','¿Hay lecturas gratuitas?'),
                 ('¿Hay lecturas gratuitas?','Leer cuenta sin créditos'),('Leer cuenta sin créditos','Diagnóstico mínimo'),
                 ('Diagnóstico mínimo','Guardar diagnóstico mínimo')]:
        unir(a,b)
    unir('¿Autorizado?','Diagnóstico mínimo',1)
    unir('¿Hay lecturas gratuitas?','Diagnóstico mínimo',1)
    return f


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--salida', type=Path, required=True)
    p.add_argument('--tabla-trabajos', required=True)
    a = p.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', a.tabla_trabajos):
        p.error('ID de tabla inválido')
    f = preparar(a.tabla_trabajos)
    a.salida.mkdir(parents=True, exist_ok=True, mode=0o700)
    contenido = json.dumps(f, ensure_ascii=False, indent=2) + '\n'
    (a.salida / (ID + '.json')).write_text(contenido)
    print(json.dumps({'preparado': True, 'id': ID, 'nodos': len(f['nodes']),
                      'sha256': hashlib.sha256(contenido.encode()).hexdigest(), 'red': False}))


if __name__ == '__main__':
    main()
