// Regresión con evaluador y nodo HTTP reales. Solo transporte/credencial ficticios.
// Ejecutar en la imagen n8n local con --network=none y JSON canónicos públicos.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const raiz='/usr/local/lib/node_modules/n8n';
const base=path.dirname(require.resolve('n8n-nodes-base/package.json',{paths:[raiz]}));
const {HttpRequestV3}=require(path.join(base,'dist/nodes/HttpRequest/V3/HttpRequestV3.node.js'));
const {Expression}=require(require.resolve('n8n-workflow',{paths:[raiz]}));
const initial={semilla:'economía',tema:'Tema peruano',idioma:'es',formato:'short'};
const json={termino:'documental',id:'id-ficticio',titulo:'Título de prueba',tipo:'short',nombre:'vidiq_user_channels',args:{userGoal:'ensayo'}};
const previous=name=>({first:()=>({json:name==='Inicio'?initial:{headers:{'mcp-session-id':'sesion-ficticia'}}})});
(async()=>{
 let comprobadas=0;
 for(const file of process.argv.slice(2)){
  const f=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const node of f.nodes.filter(n=>n.type.endsWith('.httpRequest')&&n.parameters.jsonBody?.includes("method: 'tools/call'"))){
   const expression=new Expression({});
   const item={json};
   const original=JSON.parse(expression.resolveSimpleParameterValue(node.parameters.jsonBody,{$json:json,$:previous}));
   const resolve=value=>typeof value==='string'&&value.startsWith('={{')
    ?expression.resolveSimpleParameterValue(value,{$json:item.json,$:previous})
    :Array.isArray(value)?value.map(resolve):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v)])):value;
   const solicitudes=[];
   const context={
    getInputData:()=>[item],getNode:()=>node,
    getNodeParameter:(key,_i,def)=>resolve(key.split('.').reduce((v,k)=>v?.[k],node.parameters)??({contentType:'json'}[key]??def)),
    getCredentials:async()=>({name:'Authorization',value:'FICTICIO',allowedHttpRequestDomains:'all'}),
    continueOnFail:()=>true,getExecutionCancelSignal:()=>new AbortController().signal,
    getMode:()=> 'webhook',isToolExecution:()=>false,sendMessageToUI:()=>{},getContext:()=>({}),
    helpers:{request:async opts=>{solicitudes.push(opts.body);return {headers:{'content-type':'text/event-stream'},statusCode:200,statusMessage:'OK',body:'data: '+JSON.stringify({jsonrpc:'2.0',id:opts.body.id,result:{content:[{type:'text',text:'{}'}]}})+'\n\n'};}},
   };
   const [out]=await new HttpRequestV3({name:'httpRequest',displayName:'HTTP Request'}).execute.call(context);
   assert.deepEqual(solicitudes,[original]);
   assert.equal(solicitudes[0].method,'tools/call');
   assert.ok(solicitudes[0].params.arguments);
   assert.equal(out[0].json.statusCode,200);
   comprobadas++;
  }
 }
 assert.equal(comprobadas,8);
 console.log(JSON.stringify({n8n:require(path.join(raiz,'package.json')).version,expresiones_canonicas_originales_correctas:8,peticiones_ficticias:8,nodo_http_real:'PASS',transporte:'ficticio',red:false,credencial:'ficticia'}));
})().catch(()=>{console.error('Falló la regresión MCP aislada.');process.exit(1);});
