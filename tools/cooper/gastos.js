const auth = $('Autenticar').first().json;
if (!auth.admin) return [{ json: { status: 403, respuesta: { error: 'No autorizado' } } }];
const now = new Date(), day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const week = day - ((now.getUTCDay() + 6) % 7) * 86400000, month = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
const result = new Map(); let estimados = false;
for (const item of $input.all()) {
  const c = item.json, time = Date.parse(c.createdAt), usd = Number(c.usd);
  if (!c.dueno_email || !Number.isFinite(usd) || usd < 0 || !Number.isFinite(time) || time > Date.now()) continue;
  const row = result.get(c.dueno_email) || { dueno_email: c.dueno_email, dia: 0, semana: 0, mes: 0 };
  for (const [key, since] of [['dia',day],['semana',week],['mes',month]]) if (time >= since) row[key] += usd;
  estimados ||= c.estimado !== false;
  result.set(c.dueno_email, row);
}
return [{ json: { status: 200, respuesta: { gastos: [...result.values()].map(r => ({ ...r, dia: Math.round(r.dia*1e6)/1e6, semana: Math.round(r.semana*1e6)/1e6, mes: Math.round(r.mes*1e6)/1e6 })), estimados } } }];
