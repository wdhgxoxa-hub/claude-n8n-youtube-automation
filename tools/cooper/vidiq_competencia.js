// Investigación de solo lectura: una llamada de 5 créditos de la cuota renovable.
// No compra, recarga, reintento automático ni consumo del saldo adicional.
function leerVidiqCompetencia(respuesta, id) {
  const valor = respuesta?.data ?? respuesta?.body ?? '';
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  const eventos = texto.replace(/\r\n/g, '\n').split(/\n\n+/)
    .map(b => b.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')).filter(Boolean);
  let rpc;
  for (const evento of eventos.length ? eventos : [texto]) {
    try { const v = JSON.parse(evento); if (v.jsonrpc === '2.0' && v.id === id) rpc = v; } catch {}
  }
  let datos = rpc?.result?.structuredContent;
  if (!datos) for (const c of rpc?.result?.content || []) {
    if (c.type === 'text') try { datos = JSON.parse(c.text); break; } catch {}
  }
  return { ok: respuesta?.statusCode === 200 && !respuesta?.error && !!rpc?.result && !rpc?.error && !rpc.result.isError,
    rpc, datos };
}
function guardiaVidiqCompetencia(saldo, lista, competencia) {
  const balance = leerVidiqCompetencia(saldo, 10), catalogo = leerVidiqCompetencia(lista, 2);
  const cuenta = balance.datos || {}, herramienta = catalogo.rpc?.result?.tools?.find(t => t.name === 'vidiq_outliers');
  const esquema = herramienta?.inputSchema, propiedades = esquema?.properties || {};
  const candidatos = [...new Set((competencia?.competidores || []).filter(c => c.red === 'youtube')
    .map(c => /^https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})$/.exec(c.url || '')?.[1]).filter(Boolean))].slice(0, 3);
  const ok = balance.ok && catalogo.ok && cuenta._credits?.used === 0 &&
    Number.isFinite(cuenta.renewableCredits) && cuenta.renewableCredits >= 100 &&
    Number.isFinite(cuenta.addOnCredits) && cuenta.addOnCredits >= 0 &&
    herramienta && (esquema.required || []).length === 0 && propiedades.channelIds?.type === 'array' &&
    propiedades.limit?.type === 'integer' && propiedades.minOutlierScore?.type === 'number' && propiedades.contentType?.enum?.includes('short') &&
    propiedades.publishedWithin?.enum?.includes('thisMonth') && propiedades.userGoal?.type === 'string' && candidatos.length === 3;
  return { ok: !!ok, candidatos, renovables: cuenta.renewableCredits, adicionales: cuenta.addOnCredits,
    cuerpo: JSON.stringify({jsonrpc:'2.0',id:20,method:'tools/call',params:{name:'vidiq_outliers',
      arguments:{channelIds:candidatos,limit:10,minOutlierScore:2,contentType:'short',publishedWithin:'thisMonth',
        userGoal:'Consultar destacados recientes de las tres cuentas indicadas; no cambiar ni publicar nada'}}}) };
}
function acreditarCuotaVidiq(guardia, investigacion, saldoPosterior) {
  const consulta = leerVidiqCompetencia(investigacion, 20), despues = leerVidiqCompetencia(saldoPosterior, 11);
  return guardia?.ok === true && consulta.ok && despues.ok && [0,5].includes(consulta.datos?._credits?.used) &&
    despues.datos?._credits?.used === 0 && guardia.renovables - despues.datos.renewableCredits === consulta.datos._credits.used &&
    guardia.adicionales === despues.datos.addOnCredits;
}
function evidenciaVidiqCompetencia(consulta, candidatos) {
  const answer = typeof consulta?.datos?.answer === 'string' ? consulta.datos.answer : '';
  const rechazo = /unauthori[sz]ed|forbidden|insufficient|please (?:provide|specify|choose)|invalid (?:argument|parameter)|not supported/i.test(answer);
  // Una respuesta breve explícitamente vacía es un resultado válido de esta consulta.
  // No interpretar errores, instrucciones o prosa larga como ausencia de destacados.
  const vaciaTexto = !rechazo && answer.trim().length <= 80 &&
    /^(?:no (?:matching )?(?:outlier videos|outliers|videos|results)(?: were| was)? (?:found|available)(?: for (?:this query|these filters))?[.!]?|no se encontraron (?:videos|resultados)[.!]?)$/i.test(answer.trim());
  let datos = consulta?.datos;
  if (answer) {
    try { datos = JSON.parse(answer); } catch {
      const bloque = /```(?:json)?\s*([\s\S]*?)```/.exec(answer);
      if (bloque) try { datos = JSON.parse(bloque[1]); } catch {}
    }
  }
  const videos = [];
  const visitar = (x, nivel = 0) => {
    if (!x || typeof x !== 'object' || nivel > 6) return;
    if (Array.isArray(x)) { for (const y of x.slice(0, 30)) visitar(y, nivel + 1); return; }
    const id = x.videoId, canal = x.channelId;
    if (/^[\w-]{11}$/.test(id || '') && candidatos.includes(canal)) videos.push({id,canal});
    else for (const k of ['videos','items','results','data']) visitar(x[k], nivel + 1);
  };
  visitar(datos);
  const vacia = vaciaTexto || (!answer && ['videos','items','results'].some(k=>Array.isArray(datos?.[k])&&datos[k].length===0));
  return { verificable: consulta?.ok === true && !rechazo && (vacia || videos.length > 0), vacia,
    videos: videos.slice(0, 10) };
}
function incorporarVidiqCompetencia(pedido, guardia, investigacion, saldoPosterior, habilitado) {
  const salida = {...pedido}; let tendencias;
  try { tendencias = JSON.parse(pedido.tendencias || '{}'); } catch { return salida; }
  if (!tendencias.competencia) return salida;
  const base = tendencias.competencia, consulta = leerVidiqCompetencia(investigacion, 20);
  const evidencia = evidenciaVidiqCompetencia(consulta, guardia?.candidatos || []);
  const cuotaAcreditada = acreditarCuotaVidiq(guardia, investigacion, saldoPosterior);
  const acreditado = cuotaAcreditada && evidencia.verificable;
  let mensaje = !habilitado ? 'vidIQ está apagado; se conserva la investigación pública gratuita.' :
    !guardia?.ok ? 'vidIQ no pasó la comprobación de cuota renovable, catálogo o cuentas; se conserva la fuente gratuita.' :
    !acreditado ? 'vidIQ no aportó una respuesta verificable dentro del límite; se conserva la fuente gratuita.' :
    evidencia.vacia ? 'vidIQ consultó los tres competidores y no devolvió destacados con los filtros de Shorts de este mes; esto no acredita ausencia fuera de esa búsqueda.' :
    `vidIQ confirmó ${evidencia.videos.length} publicaciones en su consulta de Shorts de este mes. Se conserva la muestra pública para calcular destacados con una base comparable.`;
  let competencia = {...base, limitaciones:[...(base.limitaciones || []), mensaje]};
  if (acreditado && evidencia.videos.length) {
    const competidores = base.competidores.map(c => ({...c, muestras:c.muestras.map(v => {
      const id = /(?:watch\?v=|shorts\/)([\w-]{11})/.exec(v.url || '')?.[1];
      const confirmado = evidencia.videos.some(x => x.id === id && c.url === 'https://www.youtube.com/channel/' + x.canal);
      return confirmado && v.formato === 'sin_clasificar' ? {...v,formato:'short'} : {...v};
    })}));
    const fuentes = new Set([...competidores.flatMap(c => [c.url,c.fuente_identidad,...c.muestras.map(v => v.url)]),
      ...(base.homonimos || []).map(h => h.url), ...(base.comprobaciones || []).flatMap(c => [c.url,c.fuente_evidencia])]);
    competencia = normalizarEvidenciaCompetencia({...base,competidores},fuentes,pedido.nombre,Date.now(),base.fuente);
    competencia.limitaciones.push(mensaje);
  }
  tendencias.competencia=competencia;
  salida.tendencias=JSON.stringify(tendencias);
  // El consumo observado se informa aunque el contenido no sea utilizable.
  // Un fallo de interpretación nunca convierte créditos cobrados en cero.
  const usados=consulta.datos?._credits?.used;
  const consumoObservado=Number.isFinite(usados)&&usados>=0;
  salida.creditos=consumoObservado ? usados : guardia?.ok===true ? null : 0;
  salida.creditos_estado=consumoObservado ? 'observado' : guardia?.ok===true ? 'desconocido' : 'no_solicitado';
  return salida;
}
