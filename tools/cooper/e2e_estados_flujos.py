"""Cierres durables encontrados en el ensayo integral. Generación offline."""

# M01 valida el modo y reserva el retorno antes del despacho; conservar su máquina durable.


def guardar_cierre_ensayo(f, nombre, video):
    """El resultado terminal nunca reanima una fila retirada por su dueño."""
    dt_update(f, nombre, 'videos', 'video_id', video)
    f.nodes[-1]['parameters']['filters']['conditions'].extend([
        {'keyName': 'estado', 'condition': 'neq', 'keyValue': 'cancelado'},
        {'keyName': 'eliminado', 'condition': 'neq', 'keyValue': True},
    ])


# $runIndex es persistido por n8n entre vueltas del Wait: no depende de memoria
# global ni de que el proveedor entregue un contador. 40 consultas = 30 minutos
# de espera programada, por debajo del timeout global del flujo (una hora).
# Fuente: https://docs.n8n.io/code/builtin/n8n-metadata/
# Estados: https://creatomate.com/docs/api/reference/what-is-a-render
f = reabrir(PROD)
code(f, 'Render · limitar espera', r"""
const r=$json, intento=$runIndex+1;
const pendientes=['planned','waiting','transcribing','rendering'];
const terminal=r.status==='failed' || ['canceled','cancelled'].includes(r.status);
const invalido=r.status!=='succeeded' && !terminal && !pendientes.includes(r.status);
const agotado=pendientes.includes(r.status) && intento>=40;
const incompleto=r.status==='succeeded' && !r.url;
if (terminal || invalido || agotado || incompleto) {
  const motivo=agotado?'El montaje no terminó después de 40 consultas.':
    incompleto?'El montaje terminó sin entregar un archivo.':
    invalido?'No se pudo interpretar el estado del montaje.':'El montaje informó un fallo.';
  return [{json:{...r,status:'failed',error_message:motivo,consultas_render:intento}}];
}
return [{json:{...r,consultas_render:intento}}];
""")
antes(f, '¿Render listo?', 'Render · limitar espera', 'Render · limitar espera')

code(f, 'Render · fallo durable', r"""
return [{json:{etapa:'montaje',estado:'con_fallas',error:String($json.error_message || 'El montaje informó un fallo.').slice(0,500)}}];
""")
guardar_cierre_ensayo(f, 'Render · guardar fallo', "={{ $('Plan de producción').first().json.video_id }}")
code(f, 'Render · conservar fallo', devolver_items("$('Render · limitar espera').all()"))
antes(f, 'Aviso: render fallido', 'Render · fallo durable', 'Render · conservar fallo')
f.chain('Render · fallo durable', 'Render · guardar fallo', 'Render · conservar fallo')

# Los frenos conocidos son pausas, no ejecuciones que siguen en curso indefinidamente.
for destino in ['Aviso: falta encender', 'Aviso: sobre presupuesto']:
    p = 'Pausa · ' + destino
    code(f, p, r"""
const p=$('Plan de producción').first().json;
return [{json:{etapa:'produccion',estado:'detenido',error:p.bloqueo==='presupuesto'?
  'Producción pausada: el storyboard supera el presupuesto permitido.':
  'Producción pausada: faltan habilitaciones para continuar.'}}];
""")
    guardar_cierre_ensayo(f, p+' guardar', "={{ $('Plan de producción').first().json.video_id }}")
    code(f, p+' continuar', devolver_items("$('Plan de producción').all()"))
    antes(f, destino, p, p+' continuar')
    f.chain(p, p+' guardar', p+' continuar')

# El retorno de error guarda el trabajo y ahora también cierra el video. No copia
# mensajes libres del proveedor ni manda el resultado a la ruta de éxito.
f = reabrir(ORQ)
iff(f, '¿Falló el especialista?', "$('Inicio').first().json.evento === 'claude_error' && !!$('Inicio').first().json.video_id")
code(f, 'Especialista · fallo durable', r"""
const e=$('Inicio').first().json;
return [{json:{etapa:e.modo==='storyboard'?'storyboard':'guion',estado:'con_fallas',
  error:'El especialista no completó el encargo; requiere revisión antes de continuar.'}}];
""")
guardar_cierre_ensayo(f, 'Especialista · guardar fallo', "={{ $('Inicio').first().json.video_id }}")
antes(f, 'Ruta', '¿Falló el especialista?', '¿Falló el especialista?')
f.conn['¿Falló el especialista?'] = {'main': [
    [{'node':'Especialista · fallo durable','type':'main','index':0}],
    [{'node':'Ruta','type':'main','index':0}],
]}
f.chain('Especialista · fallo durable', 'Especialista · guardar fallo')

# Calidad entrega los medios dentro del contexto de la aprobación. Guardarlos
# en la misma escritura que la etapa evita una aprobación sin video visible.
f = reabrir(PUB)
n = next(n for n in f.nodes if n['name'] == 'Cooper · Aprobación final etapa')
n['parameters']['jsCode'] = OBS_JS + r"""
const c=$('Cooper · Aprobación final entrada').first().json.contexto || {};
const render_url=urlCooper(c.render_url);
if (!render_url) throw new Error('Aprobación final detenida: falta un archivo de montaje válido.');
return [{json:{etapa:'aprobacion_final',render_url,miniatura_url:urlCooper(c.miniatura_url)}}];
"""
n = next(n for n in f.nodes if n['name'] == 'Cooper · Aprobación final guardar')
n['parameters']['filters']['conditions'].append({'keyName':'estado','condition':'neq','keyValue':'cancelado'})
