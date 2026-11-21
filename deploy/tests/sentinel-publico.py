"""Aceptación Sentinel de la entrada pública autorizada, sin OAuth ni sesión.

El objetivo remoto se declara explícitamente; se conserva el guardián y todos
sus evaluadores. No se etiqueta producción como copia ni se fabrican cookies.
"""
import importlib
import json
import os
from pathlib import Path
import sys

source = Path(os.environ.get('SENTINEL_CODIGO', str(Path.home() / 'Proyectos/Sistema-Sentinel/codigo')))
sys.path.insert(0, str(source / 'src'))
from sentinel.contrato import Objetivo, ComprobacionDestino, Contexto, Exclusiones
from sentinel.guardian.guardian import Guardian

output = Path(sys.argv[1]).resolve()
output.mkdir(parents=True, exist_ok=True)
origin = 'https://cooper.cooperestudio.com'
for width in (1440, 390):
    folder = output / str(width)
    folder.mkdir(exist_ok=True)
    objective = Objetivo(nombre='cooper-produccion-entrada-publica', url_interfaz=origin,
        url_api_base=origin, ruta_openapi='/no-openapi',
        # La respuesta real usa un booleano. Guardian compara el valor sin coerción.
        destino=ComprobacionDestino('/api/salud', 'ok', True),
        # Dos estados reales fuerzan navegación repetida: una sola página inmóvil
        # solo aportaría las descargas iniciales al comparador de latencia.
        hosts_permitidos=('cooper.cooperestudio.com',),
        pantallas=('/entrar', '/entrar?error=AccessDenied'),
        duracion_por_prueba_s=30,
        exclusiones=Exclusiones(textos=('Google', 'Entrar', 'Iniciar sesión'),
            selectores=('button', 'form', 'input', 'a[href*="/api/auth/"]'),
            rutas_api=('/api/auth/*',)))

    class ViewportGuardian(Guardian):
        def proteger_contexto(self, context, register):
            super().proteger_contexto(context, register)
            context.on('page', lambda page: page.set_viewport_size({'width': width, 'height': 900}))

    guardian = ViewportGuardian(objective, lambda: {})
    guardian.verificar_destino()
    findings = []
    ctx = Contexto(objetivo=objective, carpeta=folder, guardian=guardian, registrar=findings.append)
    modules = []
    for name in ('recorridos', 'estabilidad'):
        guardian.verificar_destino()
        found = importlib.import_module('sentinel.pruebas.' + name).MODULO.ejecutar(ctx)
        findings.extend(found)
        modules.append({'modulo': name, 'hallazgos': len(found)})
    unique = {h.huella(): h.a_dict() for h in findings}
    result = {'herramienta': 'Sistema Sentinel', 'origen': origin, 'ancho': width,
              'alcance': 'Entrada pública sin sesión; pantallas privadas pendientes',
              'modulos': modules, 'hallazgos': list(unique.values())}
    (folder / 'informe.json').write_text(guardian.redactar(json.dumps(result, ensure_ascii=False, indent=2)) + '\n')
    failures = sum(h['gravedad'] != 'info' for h in unique.values())
    print(json.dumps({'ancho': width, 'fallos': failures}), flush=True)
    if failures:
        raise SystemExit(1)
