// Compartido por entrada, storyboard, planos y sonido. Sin evidencia ni URLs privadas.
function validarPresentacion(value) {
  if (value === undefined || value === null) return null;
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  if (!obj(value) || value.version !== 1 || !['completo', 'partes'].includes(value.presencia) ||
      !Object.hasOwn(value, 'avatar') || !Object.hasOwn(value, 'voz') ||
      Object.keys(value).some(k => !['version', 'presencia', 'avatar', 'voz'].includes(k))) throw new Error('Presentación inválida');
  for (const kind of ['avatar', 'voz']) {
    const m = value[kind];
    if (m === null) continue;
    if (!obj(m) || !['propio', 'catalogo'].includes(m.tipo) ||
        ![m.id, m.recurso_id].every(x => typeof x === 'string' && /^[\w-]{1,160}$/.test(x)) ||
        Object.keys(m).some(k => !['recurso_id', 'proveedor', 'id', 'tipo'].includes(k))) throw new Error('Recurso inválido');
    if (m.proveedor === 'simulada') throw new Error('Recurso de demostración');
    if (kind === 'avatar' ? m.proveedor !== 'heygen' :
      !(m.proveedor === 'gemini' && m.tipo === 'catalogo' || ['heygen', 'elevenlabs'].includes(m.proveedor) && m.tipo === 'propio')) throw new Error('Proveedor incompatible');
  }
  return value;
}
function planosPresentacion(planos, value) {
  const p = validarPresentacion(value);
  const narrados = planos.filter(x => String(x.texto_narrado || '').trim());
  if (!narrados.length && (p?.avatar || p?.voz)) throw new Error('La presentación requiere narración');
  const result = planos.map(x => {
    const habla = !!String(x.texto_narrado || '').trim();
    const avatar = !!p?.avatar && habla && (p.presencia === 'completo' || x.usa_avatar === true || x.tipo === 'avatar');
    if (x.tipo === 'avatar' && !avatar) throw new Error('Plano avatar sin presentación autorizada');
    return { ...x, ...(p ? { usa_avatar: avatar, presentacion: p } : {}), ...(avatar ? { tipo: 'avatar' } : {}) };
  });
  if (p?.avatar && p.presencia === 'partes') {
    const n = result.filter(x => x.usa_avatar).length;
    if (!n || narrados.length > 1 && n === narrados.length) throw new Error('Storyboard: elige solo algunas escenas con usa_avatar');
  }
  return result;
}
function costoVozPresentacion(texto, value, aj) {
  const voz = value?.voz;
  const tarifa = voz?.proveedor === 'heygen' ? aj.costoVozHeygenCaracterUsd : voz?.proveedor === 'elevenlabs' ? aj.costoVozElevenCaracterUsd : null;
  const costo = tarifa === null ? Number(aj.costoVozUsdPorPlano) : String(texto || '').replace(/\[[^\]]*\]|<[^>]*>/g, '').length * Number(tarifa);
  if (!Number.isFinite(costo) || costo < 0) throw new Error('Configura la tarifa de voz');
  return costo;
}
