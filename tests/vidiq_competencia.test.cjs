const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {leerVidiqCompetencia,guardiaVidiqCompetencia,acreditarCuotaVidiq,evidenciaVidiqCompetencia,incorporarVidiqCompetencia}=new Function(fs.readFileSync('cooper/src/contratos/competencia.mjs','utf8').replaceAll('export function ','function ')+'\n'+fs.readFileSync('tools/cooper/vidiq_competencia.js','utf8')+';return {leerVidiqCompetencia,guardiaVidiqCompetencia,acreditarCuotaVidiq,evidenciaVidiqCompetencia,incorporarVidiqCompetencia};')();
const rpc=(id,datos)=>({statusCode:200,data:JSON.stringify({jsonrpc:'2.0',id,result:{structuredContent:datos}})});
const saldo=(renovables=150,adicionales=500,id=10)=>rpc(id,{renewableCredits:renovables,addOnCredits:adicionales,_credits:{used:0}});
const catalogo={statusCode:200,body:{jsonrpc:'2.0',id:2,result:{tools:[{name:'vidiq_outliers',inputSchema:{required:[],properties:{channelIds:{type:'array'},limit:{type:'integer'},minOutlierScore:{type:'number'},contentType:{type:'string',enum:['long','short']},publishedWithin:{type:'string',enum:['thisMonth']},userGoal:{type:'string'}}}}]}}};
const competencia={competidores:['A','B','C'].map(x=>({red:'youtube',url:'https://www.youtube.com/channel/UC'+x.repeat(22)}))};
test('lee JSON y SSE correlacionados sin aceptar un id ajeno',()=>{const r=rpc(20,{videos:[]});assert.equal(leerVidiqCompetencia(r,20).ok,true);assert.equal(leerVidiqCompetencia(r,21).ok,false);assert.equal(leerVidiqCompetencia({...r,data:'event: message\ndata: '+r.data+'\n\n'},20).ok,true);});
test('guardia permite solo tres cuentas y una investigación de lectura',()=>{const g=guardiaVidiqCompetencia(saldo(),catalogo,competencia);assert.equal(g.ok,true);const p=JSON.parse(g.cuerpo);assert.equal(p.params.name,'vidiq_outliers');assert.equal(p.params.arguments.channelIds.length,3);assert.equal(p.params.arguments.limit,10);assert.match(p.params.arguments.userGoal,/las tres cuentas indicadas/);assert.doesNotMatch(p.params.arguments.userGoal,/peruan/i);});
test('no usa addOn como respaldo y exige saldo renovable y esquema',()=>{for(const n of [0,5,99,NaN])assert.equal(guardiaVidiqCompetencia(saldo(n,10000),catalogo,competencia).ok,false);assert.equal(guardiaVidiqCompetencia(saldo(),rpc(2,{}),competencia).ok,false);assert.equal(guardiaVidiqCompetencia(saldo(),catalogo,{competidores:[]}).ok,false);});
test('solo acredita coste exacto y saldo adicional intacto',()=>{const g=guardiaVidiqCompetencia(saldo(),catalogo,competencia);const ok=rpc(20,{videos:[],_credits:{used:5}});assert.equal(acreditarCuotaVidiq(g,ok,saldo(145,500,11)),true);assert.equal(acreditarCuotaVidiq(g,ok,saldo(145,495,11)),false);assert.equal(acreditarCuotaVidiq(g,rpc(20,{_credits:{used:10}}),saldo(140,500,11)),false);assert.equal(acreditarCuotaVidiq(g,ok,saldo(140,500,11)),false);});

test('consulta sin destacados es válida con coste cero, no una exigencia de inventarlos',()=>{
 const g=guardiaVidiqCompetencia(saldo(),catalogo,competencia),r=rpc(20,{answer:'No outlier videos found.\n',_credits:{used:0}});
 assert.equal(acreditarCuotaVidiq(g,r,saldo(150,500,11)),true);
 assert.deepEqual(evidenciaVidiqCompetencia(leerVidiqCompetencia(r,20),g.candidatos),{verificable:true,vacia:true,videos:[]});
});

test('no acredita ausencia a partir de errores, instrucciones o una respuesta desconocida',()=>{
 for(const answer of ['No results found. Please provide a channel.','No results found because access is unauthorized.','No API key found','No matching videos','Here is what no videos found means.'])
  assert.equal(evidenciaVidiqCompetencia(leerVidiqCompetencia(rpc(20,{answer}),20),[]).verificable,false,answer);
});

test('solo acepta IDs verificables de las cuentas consultadas, también desde JSON textual',()=>{
 const canal='UC'+'A'.repeat(22),id='a'.repeat(11);
 const r=leerVidiqCompetencia(rpc(20,{answer:'```json\n'+JSON.stringify({videos:[{videoId:id,channelId:canal},{videoId:'b'.repeat(11),channelId:'UC'+'Z'.repeat(22)}]})+'\n```'}),20);
 assert.deepEqual(evidenciaVidiqCompetencia(r,[canal]),{verificable:true,vacia:false,videos:[{id,canal}]});
});

test('el respaldo conserva datos gratuitos, homónimos y diferenciación sin fingir acceso',()=>{
 const base={estado:'parcial',competidores:competencia.competidores,homonimos:[{nombre:'Margen Real'}],comprobaciones:[{red:'tiktok',estado:'inaccesible'}],diferenciacion:'Perú, soles y casos peruanos',limitaciones:['TikTok bloquea robots']};
 const p={canal_id:'margen-real',nombre:'Margen Real',creditos:0,tendencias:JSON.stringify({competencia:base})};
 const salida=incorporarVidiqCompetencia(p,undefined,undefined,undefined,false),c=JSON.parse(salida.tendencias).competencia;
 assert.deepEqual(c.competidores,base.competidores);assert.deepEqual(c.comprobaciones,base.comprobaciones);assert.equal(c.estado,'parcial');assert.equal(c.diferenciacion,base.diferenciacion);assert.match(c.limitaciones.at(-1),/apagado/);
 const g=guardiaVidiqCompetencia(saldo(),catalogo,competencia),vacio=rpc(20,{answer:'No outlier videos found.',_credits:{used:0}});
 const consultado=JSON.parse(incorporarVidiqCompetencia(p,g,vacio,saldo(150,500,11),true).tendencias).competencia;
 assert.equal(consultado.estado,'parcial');assert.deepEqual(consultado.comprobaciones,base.comprobaciones);assert.match(consultado.limitaciones.at(-1),/no acredita ausencia fuera/);
 const desconocida=incorporarVidiqCompetencia(p,g,rpc(20,{answer:'Unknown content',_credits:{used:5}}),saldo(145,500,11),true);
 assert.equal(desconocida.creditos,5);assert.match(JSON.parse(desconocida.tendencias).competencia.limitaciones.at(-1),/no aportó una respuesta verificable/);
 const sinRespuesta=incorporarVidiqCompetencia(p,g,undefined,undefined,true);
 assert.equal(sinRespuesta.creditos,null);assert.equal(sinRespuesta.creditos_estado,'desconocido');
 assert.equal(salida.creditos,0);assert.equal(salida.creditos_estado,'no_solicitado');
});

test('el flujo solo investiga tras interruptor y saldo, sin reintentos ni acciones de compra',()=>{
 const f=JSON.parse(fs.readFileSync('workflows/v2/FabCompYouTube01.json','utf8'));
 const nodes=f.nodes.filter(n=>n.parameters.url==='https://mcp.vidiq.com/mcp');
 assert.equal(nodes.length,6);
 // Fiabilidad omite el booleano apagado; también se rechaza cualquier valor definido distinto de false.
 for(const n of nodes){assert.equal(n.retryOnFail??false,false);assert.equal(n.onError,'continueRegularOutput');assert.equal(n.parameters.options.timeout,15000);assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);assert.equal(n.parameters.options.response.response.responseFormat,'text');}
 const name='Un pedido de destacados incluido',p=f.nodes.find(n=>n.name===name);
 assert.equal(p.parameters.jsonBody,'={{ $json.cuerpo }}');
 assert.deepEqual(f.connections['¿Cuota renovable acreditada?'].main.map(a=>a.map(x=>x.node)),[[name],['Competencia con cuota comprobada']]);
 assert.equal(f.connections['¿vidIQ habilitado?'].main[1][0].node,'Competencia con cuota comprobada');
 assert.equal(f.settings.saveDataSuccessExecution,'none');assert.equal(f.settings.saveDataErrorExecution,'none');
 assert.equal(f.settings.executionTimeout,330);assert.equal(f.settings.errorWorkflow,'FabErrores000001');
});
