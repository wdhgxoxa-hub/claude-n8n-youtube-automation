// Solo códigos operativos conocidos: no datos de usuarios, contenido ni secretos.
const crypto = require('crypto');
const body = $json.body || {};
const fail = () => [{ json: { ok: false, enviar: false, codigo: 401 } }];
const payload = body.payload;
const signature = body.firma;
const secret = String($env.COOPER_WEBHOOK_SECRET || '');
if (secret.length < 32 || typeof payload !== 'string' || payload.length > 2048 || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return fail();
const expected = crypto.createHmac('sha256', secret).update('cooper-monitor-v1\n' + payload).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return fail();
let report;
try { report = JSON.parse(payload); } catch { return fail(); }
if (!report || typeof report !== 'object' || Array.isArray(report) || Object.keys(report).sort().join(',') !== 'fecha,problemas,prueba,version') return fail();
const labels = {
  servicio_cooper: 'Cooper no está saludable', servicio_n8n: 'n8n no está saludable',
  servicio_runner: 'El ejecutor no está saludable', servicio_caddy: 'HTTPS no está saludable',
  disco_bajo: 'Queda poco espacio en disco', copia_local: 'La copia local falta o está vencida',
  copia_remota: 'La copia de la PC falta o está vencida', https_cooper: 'Cooper no responde por HTTPS',
};
if (report.version !== 1 || !Number.isInteger(report.fecha) || Math.abs(Date.now() / 1000 - report.fecha) > 300 || !Array.isArray(report.problemas) || report.problemas.length > 8 || report.problemas.some(x => typeof x !== 'string' || !Object.hasOwn(labels, x)) || typeof report.prueba !== 'boolean') return fail();
const state = $getWorkflowStaticData('global');
const now = Math.floor(Date.now() / 1000);
state.avisos = Object.fromEntries(Object.entries(state.avisos || {}).filter(([, v]) => v >= now - 600));
const duplicate = Boolean(state.avisos[signature]);
if (!report.prueba) state.avisos[signature] = now;
const text = report.problemas.length ? '⚠️ Cooper necesita atención:\n' + [...new Set(report.problemas)].map(x => '• ' + labels[x]).join('\n') : 'Cooper volvió a estar saludable. Copias y servicios comprobados.';
return [{ json: { ok: true, enviar: !report.prueba && !duplicate, codigo: 200, texto: text, prueba: report.prueba, duplicado: duplicate } }];
