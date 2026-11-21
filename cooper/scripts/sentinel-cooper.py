"""Adaptador de ensayo: usa la API instalada de Sentinel, sin modificarla.
Añade la sesión E2E y la matriz visual a sus contextos; conserva el guardián.
El proceso padre impone el plazo y termina su grupo de procesos al excederlo.
"""
import importlib
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

config = json.loads(Path(sys.argv[1]).read_text())
raiz = Path(os.environ.get('SENTINEL_CODIGO', str(Path.home() / 'Proyectos/Sistema-Sentinel/codigo')))
sys.path.insert(0, str(raiz / 'src'))
from sentinel.contrato import Objetivo, ComprobacionDestino, Contexto, Exclusiones
from sentinel.guardian.guardian import Guardian

if urlsplit(config['url']).hostname != '127.0.0.1':
    raise ValueError('Solo Cooper E2E en loopback')
cookies = json.loads(Path(config['sesion']).read_text())['cookies']
carpeta = Path(config['salida'])
carpeta.mkdir(parents=True, exist_ok=True)
objetivo = Objetivo(nombre='cooper-pulido-e2e', url_interfaz=config['url'], url_api_base=config['fixture'],
    ruta_openapi='/no-openapi', destino=ComprobacionDestino('/destino','destino','cooper-e2e-aislado'),
    pantallas=tuple(config['pantallas']), duracion_por_prueba_s=config.get('duracion', 45),
    exclusiones=Exclusiones(textos=('Cerrar sesión',), selectores=('iframe', 'a[href^="/api/archivos/"]', 'a[href^="/api/revision-archivo/"]', 'button[aria-label^="Modo noticia:"]')))
class GuardianSesion(Guardian):
    def proteger_contexto(self, contexto, registrar):
        super().proteger_contexto(contexto, registrar)
        contexto.add_cookies(cookies)
        contexto.add_init_script("localStorage.setItem('cooper-motion-paused', 'false');")
        def preparar(pagina):
            pagina.set_viewport_size({'width': config.get('ancho', 1440), 'height':900})
        contexto.on('page', preparar)
        for pagina in contexto.pages:
            preparar(pagina)
    def redactar(self, texto):
        texto = super().redactar(texto)
        for c in cookies:
            texto = texto.replace(c['value'],'[sesión E2E]')
        return texto

guardian = GuardianSesion(objetivo, lambda:{})
guardian.verificar_destino()
hallazgos=[]
ctx = Contexto(objetivo=objetivo, carpeta=carpeta, guardian=guardian, registrar=hallazgos.append)
modulos=[]
medidas_caos=[]
for nombre in config.get('modulos',['recorridos','caos','estabilidad']):
    guardian.verificar_destino()
    paquete=importlib.import_module('sentinel.pruebas.'+nombre)
    modulo=paquete.MODULO
    if nombre == 'estabilidad' and config.get('esperar_operacion'):
        # Next entrega HTML antes de cargar la consulta de operación. La primera muestra
        # debe comparar pantallas listas; no una shell de servidor contra React hidratado.
        navegar=paquete._navegar
        def navegar_listo(pagina,url,guardian,timeout_ms):
            modo=navegar(pagina,url,guardian,timeout_ms)
            if pagina.locator('.operation-page:visible').count():
                pagina.wait_for_function("() => [...document.querySelectorAll('.operation-page')].some(p=>p.getClientRects().length && !p.innerText.includes('Consultando la fábrica…'))",timeout=timeout_ms)
            return modo
        paquete._navegar=navegar_listo
    if nombre == 'caos':
        # Observación adicional de la API instalada: conserva íntegro su evaluador.
        evaluar = modulo._hallazgos
        def con_medidas(guardian, observacion, pagina, carpeta_ev, indice):
            medidas_caos.append({'url': observacion.url, 'acciones': observacion.acciones,
                'fps': observacion.fps, 'congelada': observacion.congelada,
                'estrellada': observacion.estrellada})
            return evaluar(guardian, observacion, pagina, carpeta_ev, indice)
        modulo._hallazgos = con_medidas
    nuevos=modulo.ejecutar(ctx)
    hallazgos.extend(nuevos)
    modulos.append({'nombre':nombre,'hallazgos':len(nuevos)})
    print(json.dumps(modulos[-1]),flush=True)
unicos={h.huella():h.a_dict() for h in hallazgos}
informe={'herramienta':'Sistema Sentinel API local','modulos':modulos,'medidas_caos':medidas_caos,'pantallas':ctx.pantallas,'hallazgos':list(unicos.values())}
(carpeta/'informe.json').write_text(guardian.redactar(json.dumps(informe,ensure_ascii=False,indent=2)))
fallos=[h for h in unicos.values() if h['gravedad'] != 'info']
print(json.dumps({'fallos':len(fallos),'informe':str(carpeta/'informe.json')}))
sys.exit(1 if fallos else 0)
