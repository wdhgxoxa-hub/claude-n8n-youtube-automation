// Solo el sobre autenticado aporta el resultado; dueño y recursos salen del trabajo.
const b = $json.body || {};
const modos = ['investigar_nichos','adoptar_cuenta','crear_biblia','guion','corregir_guion','storyboard','revisar_plano','aprender'];
const objeto = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const avisos = b.avisos === undefined ? [] : b.avisos;
let valido = objeto(b) && typeof b.job_id === 'string' && b.job_id.length <= 160
  && /^[a-z_]+-[a-z0-9]+-[a-z0-9]+$/.test(b.job_id) && modos.includes(b.modo)
  && b.job_id.startsWith(b.modo + '-') && ['ok','error'].includes(b.estado)
  && (objeto(b.resultado) || b.estado === 'error' && b.resultado == null)
  && Array.isArray(avisos) && avisos.length <= 20
  && avisos.every(x => typeof x === 'string' && x.length <= 2000);
let huella;
// Orden estable: reserializar las mismas claves no convierte un reintento en otro resultado.
function canon(x, profundidad = 0) {
  if (profundidad > 64) throw new Error('Resultado demasiado profundo');
  if (Array.isArray(x)) return '[' + x.map(v => canon(v, profundidad + 1)).join(',') + ']';
  if (objeto(x)) return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k], profundidad + 1)).join(',') + '}';
  return JSON.stringify(x);
}
if (valido) {
  try {
    const texto = canon({modo:b.modo, estado:b.estado, resultado:b.resultado ?? null, avisos});
    valido = texto.length <= 1000000;
    if (valido) huella = require('crypto').createHash('sha256').update(texto).digest('hex');
  } catch { valido = false; }
}
return [{json: valido ? {valido, job_id:b.job_id, modo:b.modo, estado:b.estado,
  resultado:b.resultado ?? null, avisos, huella} : {valido:false}}];
