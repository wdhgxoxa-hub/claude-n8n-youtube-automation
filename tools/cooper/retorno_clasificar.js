const v = $('Validar').first().json;
const filas = $input.all().map(i => i.json).filter(t => t.job_id);
const t = filas[0];
let salida = {accion:'rechazar', codigo:409, status:'rechazado'};
if (filas.length === 1 && t.job_id === v.job_id && t.modo === v.modo) {
  if (['enviado','envio_incierto'].includes(t.estado)) {
    salida = {accion:'reservar', codigo:202, status:'revision_requerida'};
  } else {
    let recibo;
    try { recibo = JSON.parse(t.resultado).retorno; } catch { /* Sin recibo comprobable. */ }
    if (recibo?.version === 1 && recibo.huella === v.huella) {
      if (['listo','error'].includes(t.estado) && recibo.entregado === true)
        salida = {accion:'duplicado', codigo:200, status:'recibido'};
      else if (t.estado === 'retorno_en_curso')
        salida = {accion:'revision', codigo:202, status:'revision_requerida'};
    }
  }
}
return [{json:salida}];
