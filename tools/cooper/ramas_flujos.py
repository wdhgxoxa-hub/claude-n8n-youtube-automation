"""Cortes de las ramas opcionales observados en el ensayo local; nunca despliega."""

# La entrega por URI de Omni puede seguir PROCESSING después de crear la
# interacción. Google exige consultar Files y descargar solo al llegar a ACTIVE.
# Contrato oficial consultado el 21-11-2026:
# https://aistudio.google.com/docs/omni#retrieving-videos-with-an-uri
# GET https://generativelanguage.googleapis.com/v1beta/files/{id}
# GET https://generativelanguage.googleapis.com/v1beta/files/{id}:download?alt=media
f = reabrir(PROD)
code1(f, 'Clip · preparar archivo', r"""
// Solo se envía la credencial existente al host oficial. Reconstruir la URL
// evita propagar query strings, usuarios o fragmentos recibidos del proveedor.
const uri=String($json.clip_uri || '');
const match=uri.match(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/([a-zA-Z0-9_-]{1,160})(?::download)?(?:\?alt=media)?$/);
const clip_nombre=match ? 'files/'+match[1] : '';
return {json:{...$json,clip_nombre,clip_consultas:0,clip_listo:false,
  clip_uri:match ? 'https://generativelanguage.googleapis.com/v1beta/'+clip_nombre+':download?alt=media' : '',
  clip_error:match ? '' : 'El clip no entregó una referencia válida de Google Files.'}};
""")
iff(f, '¿Referencia de clip válida?', '!$json.clip_error')
code1(f, 'Clip · consultar entrada', 'return {json:$json};')
http(f, 'Consultar archivo de clip', 'GET',
     "={{ 'https://generativelanguage.googleapis.com/v1beta/' + $json.clip_nombre }}",
     cred=CRED_GEMINI, timeout=30000)
f.nodes[-1]['onError'] = 'continueRegularOutput'
code1(f, 'Clip · estado archivo', r"""
const p=$('Clip · consultar entrada').item.json, r=$json;
const consultas=Number(p.clip_consultas || 0)+1;
const coincide=r.name === p.clip_nombre;
const activo=coincide && r.state === 'ACTIVE';
const pendiente=coincide && r.state === 'PROCESSING';
const error=r.error ? 'No se pudo consultar el archivo del clip.' : !coincide ? 'La consulta no corresponde al archivo del clip.' :
  r.state === 'FAILED' ? 'Google no pudo preparar el archivo del clip.' :
  !activo && !pendiente ? 'Google devolvió un estado de archivo desconocido.' :
  pendiente && consultas>=40 ? 'El archivo del clip no estuvo listo después de 40 consultas.' : '';
return {json:{...p,clip_consultas:consultas,clip_listo:activo && !error,clip_error:error}};
""")
iff(f, '¿Consulta de clip válida?', '!$json.clip_error')
iff(f, '¿Archivo de clip activo?', '$json.clip_listo === true')
wait(f, 'Esperar archivo de clip', 5)
code(f, 'Clip · fallo durable', r"""
return [{json:{etapa:'produccion',estado:'con_fallas',
  error:String($json.clip_error || 'No se pudo preparar el archivo del clip.').slice(0,500)}}];
""")
guardar_cierre_ensayo(f, 'Clip · guardar fallo', "={{ $('Plan de producción').first().json.video_id }}")
antes(f, 'Descargar clip', 'Clip · preparar archivo', '¿Archivo de clip activo?')
f.chain('Clip · preparar archivo','¿Referencia de clip válida?')
f.link('¿Referencia de clip válida?','Clip · consultar entrada',0)
f.link('¿Referencia de clip válida?','Clip · fallo durable',1)
f.chain('Clip · consultar entrada','Consultar archivo de clip','Clip · estado archivo','¿Consulta de clip válida?')
f.link('¿Consulta de clip válida?','¿Archivo de clip activo?',0)
f.link('¿Consulta de clip válida?','Clip · fallo durable',1)
f.link('¿Archivo de clip activo?','Esperar archivo de clip',1)
f.chain('Esperar archivo de clip','Clip · consultar entrada')
f.chain('Clip · fallo durable','Clip · guardar fallo')
# La espera revalida las selecciones autorizadas antes de seguir consultando.
guardia_presentacion(PROD,'Consultar archivo de clip','medios')
