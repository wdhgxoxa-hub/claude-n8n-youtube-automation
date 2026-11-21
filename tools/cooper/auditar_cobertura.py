"""Inventario estático reproducible. Lee únicamente fuentes/exportaciones versionables."""
import ast
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAPA = {
    'CooperMarcasPub1': ('/marcas', 'Despertar el trabajador firmado para publicaciones aprobadas e ingesta; bloqueado por configuración'),
    'CooperMarcasMet1': ('/marcas', 'Consultar métricas de publicaciones de marcas con reservas y reintentos acotados'),
    'FabAgenteTelegr1': ('/', 'Chat breve con herramientas; avisos en /avisos'),
    'FabAjustes000001': ('/admin/fabrica', 'Editar ajustes con revisión, confirmación y registro'),
    'FabAprendizaje01': ('/aprendizaje', 'Retención, lecciones e incidencias; /publicados para métricas'),
    'FabAprobacion001': ('/decisiones', 'Aprobar o pedir cambios; reanudar la espera nativa o cerrar la puerta web'),
    'FabAvatar0000001': ('/avatares', 'Elegir avatar y voz; consentimiento, revocación y progreso en detalle de video'),
    'FabChatWeb000001': ('/', 'Chat de Cooper; el chat legado de n8n no se incrusta'),
    'FabCompYouTube01': ('/radar', 'Competidores y muestras públicas por canal, vidIQ con cuota renovable comprobada y respaldo gratuito'),
    'FabConfirmar0001': ('/programados', 'Estado por red, borrador/omisión y consulta sin volver a subir'),
    'FabCooperAPI0001': ('/radar', 'Puente firmado de todas las pantallas; autorización y recibos idempotentes'),
    'FabCooperCosto01': ('/admin', 'Costos por dueño; /admin/fabrica fija presupuestos y límites'),
    'FabCooperProgr01': ('/videos/[id]', 'Etapa persistida, reconexión y progreso por SSE'),
    'FabDerivados0001': ('/videos/[id]', 'Cortes y miniatura en galería; interruptores y costes en /admin/fabrica'),
    'FabErrores000001': ('/incidencias', 'Causa sencilla, siguiente acción y reintento seguro; fallos globales solo admin'),
    'FabEstado0000001': ('/videos', 'Estado por canal/video; métricas en /publicados y gasto solo admin'),
    'FabLlamarClaude1': ('/videos/[id]', 'Investigación/guion/storyboard y errores; modelo e interruptor administrativos'),
    'FabNoticia000001': ('/radar', 'Noticia verificada, fuente y encargo; interruptor por canal'),
    'FabOrquestador01': ('/videos/[id]', 'Canales, creación, corrección, decisiones, programación y eliminación en reposo'),
    'FabPendientes001': ('/decisiones', 'Todas las decisiones autorizadas, con detalle y acciones'),
    'FabPresentacion1': ('/avatares', 'Consentimiento y elección; explicación de bloqueos en /incidencias'),
    'FabProduccion001': ('/videos/[id]', 'Planos, render y sonido; decisión de gasto solo admin, controles en /admin/fabrica'),
    'FabPublicacion01': ('/videos/[id]', 'Calidad y revisión final; errores y correcciones en /aprendizaje'),
    'FabRadar00000001': ('/radar', 'Ideas, fuente, sonidos, solicitar lectura y usar idea para pedir video'),
    'FabRedes00000001': ('/redes', 'Especialistas, plataformas y perfil; agenda y resultados en /programados'),
    'FabReenviar00001': ('/decisiones', 'Renovar/reenviar una decisión propia; no rehacer un permiso de gasto muerto'),
    'FabReferencias01': ('/referencias', 'Personajes/escenarios, descripción, enlaces y generación de referencias'),
    'FabRetornoClaud1': ('/videos/[id]', 'Resultado validado avanza la etapa; fallos en /incidencias'),
    'FabRutina0000001': ('/rutina', 'Metas, automatización, decisiones diarias, motivos, frenos y video encargado'),
    'FabSonido0000001': ('/videos/[id]', 'Reproductores y piezas de voz; estilo en biblia y servicios en /admin/fabrica'),
    'FabTextoGPT0001': ('/admin/fabrica', 'Modelo y respaldo API; resultado dentro del paso que lo solicitó'),
    'FabVidiq00000001': ('/radar', 'Ideas y fuentes; adopción en /cuentas, título elegido en el video'),
    'FabYouTube000001': ('/redes', 'Estado y preparación de enlace; autorización interactiva del propietario en Google'),
}


def inventario():
    source = (ROOT / 'tools/generar_flujos_v2.py').read_text()
    tree = ast.parse(source)
    tables = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(x, ast.Name) and x.id == 'T' for x in n.targets))
    table_names = {v: k for k, v in tables.items()}
    workflows = []
    for path in sorted((ROOT / 'workflows/v2').glob('*.json')):
        w = json.loads(path.read_text())
        screen, action = MAPA[w['id']]  # Un flujo nuevo sin revisar hace fallar el inventario.
        nodes = []
        for n in w['nodes']:
            p = n['parameters']
            table_id = p.get('dataTableId', {})
            if isinstance(table_id, dict):
                table_id = table_id.get('value')
            outputs = w.get('connections', {}).get(n['name'], {})
            destinations = [{'tipo': kind, 'salida': i, 'destinos': [e['node'] for e in edges]} for kind, ports in outputs.items() for i, edges in enumerate(ports)]
            nodes.append({'nombre': n['name'], 'tipo': n['type'], 'decision': n['type'].split('.')[-1] in ['if', 'switch', 'wait'], 'tabla': table_names.get(table_id), 'operacion_tabla': p.get('operation') if table_id else None, 'salidas': destinations, 'pantalla': screen, 'estado': 'completo'})
        events = sorted(set(re.findall(r"tipo\s*:\s*['\"]([a-z][a-z_]+)['\"]", json.dumps(w, ensure_ascii=False).replace('\\"', '"'))))
        workflows.append({'id': w['id'], 'nombre': w['name'], 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'pantalla': screen, 'accion': action, 'estado': 'completo', 'nodos': nodes, 'tipos_registrados': events})
    assert set(MAPA) == {w['id'] for w in workflows}
    catalog = json.loads((ROOT / 'cooper/src/contratos/ajustes-fabrica.json').read_text())
    contract = json.loads((ROOT / 'cooper/src/contratos/cooper-v1.json').read_text())
    legacy=[]
    for path in sorted((ROOT/'workflows').glob('*.json')):
        data=json.loads(path.read_text())
        for w in data if isinstance(data,list) else [data]:
            replacements={'01':'Entrada de Telegram; chat en / y creación en /canales o /videos', '02':'Decisiones, corrección y cancelación en /decisiones y /videos/[id]', '03':'Registro de videos en Data Tables y Cooper; /videos y /publicados', '04':'Avatar, render, estado y publicación en /avatares, /videos/[id] y /programados'}
            legacy.append({'archivo':path.name,'nombre':w['name'],'equivalencia_v2':replacements[path.name[:2]],'estado':'completo por equivalente v2','limite':'No se activa un segundo circuito de revisión ni el antiguo registro en Sheets.', 'nodos':[{'nombre':n['name'],'tipo':n['type'],'salidas':w.get('connections',{}).get(n['name'],{})} for n in w['nodes']]})
    return {'legados':legacy,'alcance': 'Cobertura funcional del código. No certifica despliegue ni proveedores externos. Nodos automáticos se controlan mediante la acción de producto e interruptores, no ejecución arbitraria.', 'flujos': workflows, 'tablas': sorted(tables), 'ajustes_editables': {k: {'etiqueta': v['etiqueta'], 'tipo': v['tipo'], 'pantalla': '/admin/fabrica'} for k, v in catalog.items()}, 'ajustes_instalacion_reservados': ['chatId', 'routineUrl', 'retornoUrl', 'driveCarpetaRaizId', 'baseUrl', 'googleClientId'], 'contrato': contract}


if __name__ == '__main__':
    result = inventario()
    output = ROOT / 'docs/informes/cooper-cobertura-inventario.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f"Inventario: {len(result['flujos'])} flujos, {sum(len(w['nodos']) for w in result['flujos'])} nodos, {sum(n['decision'] for w in result['flujos'] for n in w['nodos'])} decisiones/esperas, {len(result['ajustes_editables'])} ajustes y {len(result['tablas'])} tablas.")
