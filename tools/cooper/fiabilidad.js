// Política pura de transporte. No envía solicitudes ni conserva errores de proveedores.
function evaluarRespuestaFiable(r, intento, ahora = Date.now(), azar = Math.random()) {
  if (!Number.isInteger(intento) || intento < 1 || intento > 4) throw new Error('Intento de transporte inválido');
  const recibido = Number(r?.statusCode || r?.error?.statusCode || r?.error?.httpCode || 0);
  const codigo = Number.isInteger(recibido) ? recibido : 0;
  if (codigo >= 200 && codigo < 300) return { reintentar: false, esperaSegundos: 0, respuesta: r.body, codigo };
  const transitorio = [408, 425, 429].includes(codigo) || (codigo >= 500 && codigo <= 599) || (!codigo && !!r?.error);
  if (!transitorio) throw new Error('Respuesta HTTP no recuperable; revisar la incidencia sin reenviar la operación');
  if (intento === 4) throw new Error('Transporte agotado tras cuatro intentos seguros; requiere conciliación');
  const headers = r.headers || r.error?.headers || {};
  const raw = Object.entries(headers).find(([k]) => k.toLowerCase() === 'retry-after')?.[1];
  let retryAfter = 0;
  if (raw !== undefined) {
    const texto = String(raw).trim();
    if (/^\d+(?:\.\d+)?$/.test(texto)) retryAfter = Math.ceil(Number(texto));
    else {
      // Date.parse admite basura como "-1" o fechas abreviadas: aceptar solo
      // IMF-fixdate y exigir que la fecha y el día de semana sean coherentes.
      const instante = Date.parse(texto);
      if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(texto) || !Number.isFinite(instante) || new Date(instante).toUTCString() !== texto) {
        throw new Error('Retry-After inválido; detener antes de incumplir la cuota');
      }
      retryAfter = Math.max(0, Math.ceil((instante - ahora) / 1000));
    }
    if (!Number.isFinite(retryAfter)) throw new Error('Retry-After inválido; detener antes de incumplir la cuota');
    // El callback firmado caduca: no esperar indefinidamente ni anticipar Retry-After.
    if (retryAfter > 60) throw new Error('Retry-After excede el presupuesto; reanudar tras conciliación');
  }
  const base = [2, 8, 32][intento - 1];
  const jitter = Math.min(2, Math.max(0, Math.floor(Number(azar) * 3) || 0));
  return { reintentar: true, esperaSegundos: Math.max(base + jitter, retryAfter), respuesta: null, codigo };
}

function clavePublicacionFiable(video, tipo, red) {
  if (!video || !tipo || !red) throw new Error('Publicación sin identidad estable');
  return 'publicacion:v1:' + require('crypto').createHash('sha256').update(JSON.stringify([String(video), String(tipo), String(red)])).digest('hex');
}

function publicacionYaReservada(video, tipo, red, publicaciones, reservas) {
  const clave = clavePublicacionFiable(video, tipo, red);
  return reservas.some(r => r.evento === clave) || publicaciones.some(p => p.video_id === video && p.tipo === tipo && String(p.plataformas || '').split(',').includes(red));
}

function elegirReservasPublicacion(pedidos, propias, reservas) {
  const vistas = new Set();
  return pedidos.filter(p => {
    const clave = p.clave_publicacion;
    if (!clave || vistas.has(clave)) return false;
    vistas.add(clave);
    const mia = propias.filter(r => r.evento === clave);
    const todas = reservas.filter(r => r.evento === clave);
    if (mia.length !== 1 || !todas.length || [...mia, ...todas].some(r => !Number.isSafeInteger(Number(r.id)) || Number(r.id) <= 0)) {
      throw new Error('No se pudo verificar la reserva de publicación; no reenviar');
    }
    const id = Number(mia[0].id);
    if (!todas.some(r => Number(r.id) === id)) throw new Error('La reserva aún no es visible; no reenviar');
    return id === Math.min(...todas.map(r => Number(r.id)));
  });
}
