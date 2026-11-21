const crypto = require('crypto');
const token = String($env.COOPER_N8N_TOKEN || '');
const supplied = String($json.headers?.authorization || '');
const expected = 'Bearer ' + token;
const fail = (status, error) => [{ json: { status, respuesta: { error } } }];
if (token.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return fail(401, 'No autorizado');
const b = $json.body;
if (!b || b.version !== 'cooper-v1' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id_evento || '') ||
    !Object.keys(CONTRATO.eventos).concat(CONTRATO.consultas).includes(b.evento) ||
    typeof b.dueno_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.dueno_email) || b.dueno_email.length > 254 ||
    typeof b.admin !== 'boolean' || !b.datos || Array.isArray(b.datos) || typeof b.datos !== 'object' || JSON.stringify(b).length > 64000)
  return fail(400, 'Solicitud inválida');
// El rol procede del servidor, y además se contrasta con el único administrador configurado en n8n.
const admin = b.admin && b.dueno_email.toLowerCase() === String($env.COOPER_ADMIN_EMAIL || '').toLowerCase();
if (b.admin && !admin || b.evento === 'gastos' && !admin) return fail(403, 'Consulta no permitida');
return [{ json: { status: 200, solicitud: b, admin, dueno_email: b.dueno_email.toLowerCase() } }];
