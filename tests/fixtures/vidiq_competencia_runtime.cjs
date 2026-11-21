// Evaluador y HTTP de n8n reales; red, cuenta y respuestas son ficticias.
// Uso dentro de imagen n8n: node fixture.cjs FabCompYouTube01.json
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const raiz='/usr/local/lib/node_modules/n8n';
const base=path.dirname(require.resolve('n8n-nodes-base/package.json',{paths:[raiz]}));
const {HttpRequestV3}=require(path.join(base,'dist/nodes/HttpRequest/V3/HttpRequestV3.node.js'));
const {Expression}=require(require.resolve('n8n-workflow',{paths:[raiz]}));
const flujo=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),expr=new Expression({});
const cuerpo=JSON.stringify({jsonrpc:'2.0',id:20,method:'tools/call',params:{name:'vidiq_outliers',arguments:{channelIds:['UC'+'A'.repeat(22),'UC'+'B'.repeat(22),'UC'+'C'.repeat(22)],contentType:'short',publishedWithin:'thisMonth',limit:10,minOutlierScore:2,userGoal:'Ensayo ficticio'}}});
const items=[{json:{cuerpo}}],solicitudes=[];
const resolve=v=>typeof v==='string'&&v.startsWith('={{')?expr.resolveSimpleParameterValue(v,{$json:items[0].json,$:()=>({first:()=>({json:{headers:{'mcp-session-id':'FICTICIO'}}})})}):Array.isArray(v)?v.map(resolve):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)])):v;
(async()=>{
 for(const node of flujo.nodes.filter(n=>n.parameters.url==='https://mcp.vidiq.com/mcp')){
  const context={getInputData:()=>items,getNode:()=>node,
   getNodeParameter:(key,i,def)=>resolve(key.split('.').reduce((v,k)=>v?.[k],node.parameters)??({contentType:'json'}[key]??def)),
   getCredentials:async()=>({name:'Authorization',value:'FICTICIO',allowedHttpRequestDomains:'all'}),
   continueOnFail:()=>true,getExecutionCancelSignal:()=>new AbortController().signal,getMode:()=>'webhook',isToolExecution:()=>false,sendMessageToUI:()=>{},getContext:()=>({}),
   helpers:{request:async opts=>{solicitudes.push(opts.body);return {headers:{'content-type':'text/event-stream'},statusCode:200,statusMessage:'OK',body:'event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:opts.body.id,result:{structuredContent:{answer:'No outlier videos found.\n',_credits:{used:0}}}})+'\n\n'};}}};
  const [out]=await new HttpRequestV3({name:'httpRequest',displayName:'HTTP Request'}).execute.call(context);
  assert.equal(out[0].json.statusCode,200,node.name);
 }
 assert.equal(solicitudes.length,6);
 assert.deepEqual(solicitudes.filter(x=>x.method==='tools/call').map(x=>x.params.name),['vidiq_balance','vidiq_outliers','vidiq_balance']);
 assert.deepEqual(solicitudes.find(x=>x.id===20),JSON.parse(cuerpo));
 console.log(JSON.stringify({n8n:require(path.join(raiz,'package.json')).version,solicitudes:solicitudes.length,pedidos_investigacion:1,evaluador:'real',nodo_http:'real',red:false,credencial:'ficticia',ok:true}));
})().catch(()=>{console.error('Falló la regresión aislada de competencia vidIQ.');process.exit(1);});
