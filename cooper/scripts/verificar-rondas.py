"""Revisa dos rondas terminadas sin ejecutar navegadores ni alterar sus fuentes.

Uso: python3 scripts/verificar-rondas.py RAIZ RONDA1 RONDA2 --salida DIRECTORIO_NUEVO
La revisión visual queda pendiente hasta que se inspeccionan sus muestras.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import sys

ANCHOS = (1440, 390)
TEMAS = ('oscuro', 'claro')
PROYECTOS = {'chromium', 'demostracion', 'movimiento-integrado',
             'estres-integrado', 'recorrido-integrado'}


def exigir(condicion, mensaje):
    if not condicion:
        raise ValueError(mensaje)


def huella(ruta):
    exigir(ruta.is_file() and not ruta.is_symlink(), 'Archivo ausente o enlazado: ' + str(ruta))
    digest = hashlib.sha256()
    with ruta.open('rb') as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b''):
            digest.update(bloque)
    return {'bytes': ruta.stat().st_size, 'sha256': digest.hexdigest()}


def leer_json(ruta):
    exigir(ruta.is_file() and not ruta.is_symlink(), 'Informe ausente o enlazado: ' + str(ruta))
    return json.loads(ruta.read_text())


def pruebas_playwright(informe):
    stats = informe.get('stats', {})
    exigir(stats.get('expected', 0) > 0 and all(stats.get(k) == 0 for k in
            ('unexpected', 'flaky', 'skipped')) and informe.get('errors') == [],
            'Playwright tiene fallos, omisiones, inestables o informe incompleto')
    pruebas = []

    def recorrer(suite, padres=()):
        contexto = (*padres, suite['title']) if suite.get('title') else padres
        for spec in suite.get('specs', []):
            exigir(spec.get('ok') is True, 'Spec sin aprobación: ' + spec.get('title', '?'))
            for test in spec.get('tests', []):
                resultados = test.get('results', [])
                exigir(test.get('status') == 'expected' and test.get('expectedStatus') == 'passed'
                        and len(resultados) == 1 and resultados[0].get('status') == 'passed'
                        and resultados[0].get('retry') == 0,
                        'Prueba omitida, fallida o reintentada: ' + spec.get('title', '?'))
                pruebas.append((test.get('projectName'), spec.get('file'),
                                ' > '.join((*contexto, spec.get('title', '')))))
        for hija in suite.get('suites', []):
            recorrer(hija, contexto)

    recorrer({'suites': informe.get('suites', [])})
    exigir(len(pruebas) == stats['expected'] and len(set(pruebas)) == len(pruebas),
            'Conteo de pruebas incoherente o duplicado')
    exigir(PROYECTOS <= {p[0] for p in pruebas}, 'Faltan proyectos de la ronda integrada')
    exigir(float(stats.get('duration', 0)) > 0, 'Ronda sin duración')
    inicio = datetime.fromisoformat(stats['startTime'].replace('Z', '+00:00')).timestamp()
    return {'pruebas': sorted(pruebas), 'cantidad': len(pruebas), 'inicio': inicio,
            'fin': inicio + stats['duration'] / 1000}


def matriz(pantallas, ancho, tema):
    exigir(isinstance(pantallas, list) and len(pantallas) >= 22, 'Matriz visual incompleta')
    exigir(len({p['name'] for p in pantallas}) == len(pantallas), 'Pantallas duplicadas')
    for p in pantallas:
        exigir(p.get('width') == ancho and p.get('theme') == tema
                and p.get('cpu') == (4 if ancho == 390 else 1), 'Contexto visual incorrecto')
        exigir(re.fullmatch(fr'{ancho}-{tema}-\d+-[a-z-]+', p['name'])
                and p.get('video') == p['name'] + '.webm', 'Nombre o video de matriz incoherente')
        exigir(all(isinstance(p.get(k), (float, int)) and math.isfinite(p[k]) for k in
                   ('fps', 'p95', 'maxFrame', 'cls', 'frames')), 'Medida visual no finita')
        exigir(p['fps'] >= 57 and 0 <= p['p95'] <= 25 and 0 <= p['maxFrame'] < 100
                and 0 <= p['cls'] <= .01 and p['frames'] > 0
                and isinstance(p.get('longTasks'), list)
                and all(isinstance(x, (float, int)) and math.isfinite(x) and 0 <= x < 100
                        for x in p['longTasks']), 'Matriz fuera de los umbrales de la suite')
    return {'pantallas': len(pantallas), 'fps_min': min(p['fps'] for p in pantallas),
            'frame_max_ms': max(p['maxFrame'] for p in pantallas),
            'cls_max': max(p['cls'] for p in pantallas),
            'tareas_largas': sum(len(p['longTasks']) for p in pantallas)}


def sentinel(informe):
    exigir({m.get('nombre') for m in informe.get('modulos', [])} ==
            {'recorridos', 'caos', 'estabilidad'}, 'Faltan módulos Sentinel')
    exigir(len(informe.get('pantallas', [])) >= 20, 'Sentinel no recorrió la matriz')
    exigir(isinstance(informe.get('hallazgos'), list)
            and all(h.get('gravedad') == 'info' for h in informe['hallazgos']),
            'Sentinel tiene hallazgos no informativos')
    medidas = informe.get('medidas_caos', [])
    exigir(medidas and all(m.get('congelada') is False and m.get('estrellada') is False
                          for m in medidas), 'Caos vacío, congelado o con caídas')
    exigir(all(isinstance(m.get('acciones'), int) and m['acciones'] >= 0 for m in medidas),
            'Contador de acciones inválido')
    acciones = sum(m.get('acciones', 0) for m in medidas)
    exigir(acciones > 0, 'Sentinel no ejecutó acciones de caos')
    fps = [f for m in medidas for f in m.get('fps', []) if isinstance(f, (float, int)) and math.isfinite(f)]
    exigir(fps, 'Caos sin muestras de rendimiento')
    return {'rutas': len(informe['pantallas']), 'acciones': acciones,
            'muestras_fps': len(fps), 'fps_min_puntual': min(fps),
            'muestras_menos_45_fps': sum(f < 45 for f in fps),
            'hallazgos_info': len(informe['hallazgos'])}


def ejecutar(args):
    resultado = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True,
                               text=True, timeout=180, check=False,
                               env={k: os.environ[k] for k in ('PATH', 'LANG') if k in os.environ})
    exigir(resultado.returncode == 0 and not resultado.stderr.strip(),
            args[0] + ' falló o emitió diagnóstico: ' + resultado.stderr[-4000:])
    return resultado.stdout


def verificar_video(ruta, esperado=None):
    anterior = ruta.stat()
    digest = huella(ruta)
    probe = json.loads(ejecutar(['ffprobe', '-v', 'warning', '-protocol_whitelist', 'file,pipe',
                                '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate:format=duration,size',
                                '-of', 'json', str(ruta)]))
    streams = [s for s in probe.get('streams', []) if s.get('codec_type') == 'video']
    duracion = float(probe.get('format', {}).get('duration', 'nan'))
    exigir(streams and math.isfinite(duracion) and duracion > 0, 'Video sin imagen o duración')
    exigir(all(s.get('width', 0) > 0 and s.get('height', 0) > 0 for s in streams), 'Video sin dimensiones')
    if esperado:
        exigir(len(streams) == 1 and (streams[0]['width'], streams[0]['height']) == esperado,
                'Resolución distinta de la grabación solicitada: ' + ruta.name)
    progreso = ejecutar(['ffmpeg', '-nostdin', '-hide_banner', '-v', 'warning', '-xerror',
                         '-err_detect', 'explode', '-threads', '1', '-protocol_whitelist', 'file,pipe',
                         '-i', str(ruta), '-map', '0:v', '-map', '0:a?', '-threads', '1',
                         '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'])
    cuadros = [int(x) for x in re.findall(r'^frame=(\d+)$', progreso, re.MULTILINE)]
    exigir('progress=end' in progreso and cuadros and max(cuadros) > 0, 'Decodificación incompleta')
    posterior = ruta.stat()
    exigir((anterior.st_size, anterior.st_mtime_ns) == (posterior.st_size, posterior.st_mtime_ns),
            'El video cambió durante la revisión')
    return {**digest, 'duracion_s': duracion, 'streams': streams,
            'cuadros_decodificados': max(cuadros), 'ffprobe_rc': 0, 'ffmpeg_rc': 0,
            'diagnosticos': 0, 'decodificacion_completa': True}


def imagen_png(ruta):
    digest = huella(ruta)
    with ruta.open('rb') as f:
        cabecera = f.read(24)
    exigir(len(cabecera) == 24 and cabecera[:8] == b'\x89PNG\r\n\x1a\n'
            and cabecera[12:16] == b'IHDR', 'Captura PNG sin cabecera válida')
    ancho, alto = struct.unpack('>II', cabecera[16:24])
    exigir(ancho > 0 and alto > 0, 'Captura sin dimensiones')
    return {**digest, 'ancho': ancho, 'alto': alto}


def revisar_ronda(raiz, nombre):
    exigir(re.fullmatch(r'[a-z][a-z0-9-]*', nombre), 'Nombre de ronda inválido')
    carpeta = raiz / nombre
    exigir(carpeta.is_dir() and not carpeta.is_symlink(), 'Ronda ausente o enlazada')
    exigir(all(not p.is_symlink() for p in carpeta.rglob('*')), 'Enlace no permitido en la ronda')
    resultado = {'ronda': nombre, 'playwright': pruebas_playwright(leer_json(carpeta / 'playwright.json')),
                 'informes': [], 'matrices': [], 'sentinel': [], 'videos': [], 'capturas': [], 'muestras_visuales': []}
    informes = ['playwright.json']
    referencias = {}
    nombres_matriz = None
    for ancho in ANCHOS:
        for tema in TEMAS:
            archivo = f'pantallas-{ancho}-{tema}.json'
            pantallas = leer_json(carpeta / archivo)
            resultado['matrices'].append({'ancho': ancho, 'tema': tema, **matriz(pantallas, ancho, tema)})
            nombres = [p['name'].split('-', 2)[2] for p in pantallas]
            exigir(nombres_matriz is None or nombres == nombres_matriz, 'Matrices de pantallas distintas')
            nombres_matriz = nombres
            informes.append(archivo)
            for p in pantallas:
                referencias[p['video']] = (ancho, 900)
                png = carpeta / (p['name'] + '.png')
                exigir(imagen_png(png)['ancho'] == ancho, 'Captura con ancho incorrecto')
                if p['path'] in ('/', '/marcas', '/cuentas', '/publicados', '/aprendizaje', '/admin/fabrica'):
                    resultado['muestras_visuales'].append({'archivo': nombre + '/' + png.name,
                                                         'ancho': ancho, 'tema': tema, 'ruta': p['path'],
                                                         'sha256': huella(png)['sha256']})
        archivo = f'sentinel-{ancho}/informe.json'
        resultado['sentinel'].append({'ancho': ancho, **sentinel(leer_json(carpeta / archivo))})
        informes.append(archivo)
        for clase in ('estados', 'interacciones'):
            archivo = f'{ancho}-{clase}.json'
            dato = leer_json(carpeta / archivo)
            exigir(dato.get('width') == ancho and dato.get('video') == f'{ancho}-{clase}.webm',
                    'Video de estados/interacciones incoherente')
            referencias[dato['video']] = (ancho, 900)
            informes.append(archivo)
        archivo = f'recorrido-completo-{ancho}.json'
        recorrido = leer_json(carpeta / archivo)
        pasos = recorrido.get('pasos', [])
        exigir(recorrido.get('width') == ancho and recorrido.get('height') == 900
                and len(pasos) >= 22 and all(math.isfinite(p.get('segundos', float('nan'))) for p in pasos),
                'Recorrido continuo incompleto')
        tiempos = [p['segundos'] for p in pasos]
        exigir(tiempos == sorted(tiempos) and tiempos[0] >= 0, 'Tiempos de recorrido incoherentes')
        referencias[f'recorrido-completo-{ancho}.webm'] = (ancho, 900)
        informes.append(archivo)
    for archivo in informes:
        resultado['informes'].append({'archivo': nombre + '/' + archivo, **huella(carpeta / archivo)})
    for archivo in sorted(carpeta.rglob('*')):
        exigir(not archivo.is_symlink(), 'Enlace no permitido en la ronda')
        relativo = archivo.relative_to(carpeta).as_posix()
        if archivo.is_file() and archivo.suffix.lower() in ('.webm', '.mp4'):
            dato = verificar_video(archivo, referencias.get(relativo))
            resultado['videos'].append({'archivo': nombre + '/' + relativo,
                                        'principal': relativo in referencias, **dato})
            print(f'{nombre}: video {len(resultado["videos"])} verificado', flush=True)
        elif archivo.is_file() and archivo.suffix.lower() == '.png':
            resultado['capturas'].append({'archivo': nombre + '/' + relativo, **imagen_png(archivo)})
    encontrados = {v['archivo'].removeprefix(nombre + '/') for v in resultado['videos']}
    exigir(set(referencias) <= encontrados, 'Faltan videos referidos por los informes')
    exigir(len(resultado['muestras_visuales']) == 24, 'Selección visual escritorio/móvil incompleta')
    return resultado


def escribir_indice(raiz, salida, rondas):
    clips = [v for r in rondas for v in r['videos'] if v['principal']]
    clips.sort(key=lambda v: ('recorrido-completo' not in v['archivo'], v['archivo']))
    def enlace(archivo):
        return html.escape(os.path.relpath(raiz / archivo, salida), quote=True)
    contenido = ''.join(f'<details><summary>{html.escape(v["archivo"])}</summary>'
                        f'<video controls preload="none" src="{enlace(v["archivo"])}"></video>'
                        f'<p>{v["duracion_s"]:.2f} s · SHA-256 {v["sha256"]}</p></details>' for v in clips)
    (salida / 'index.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width"><title>Cooper · cierre verificado</title>'
        '<style>body{font:16px system-ui;margin:24px;background:#101214;color:#f0eee7}a{color:#a6d7ed}'
        'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}'
        'video{width:100%;max-height:700px}summary{padding:12px}p{overflow-wrap:anywhere}</style>'
        '<h1>Videos de cierre</h1><p>Solo las dos rondas explícitas aprobadas por la revisión técnica. '
        'La inspección visual se documenta por separado; la cadencia del archivo no equivale a FPS de interfaz.</p>'
        f'<p>{len(clips)} videos principales. <a href="verificacion.json">Huellas y decodificación de todos los videos</a>'
        ' · <a href="revision-visual.json">Muestras visuales pendientes de inspección</a></p><main>' + contenido + '</main></html>')
    (salida / 'indice.json').write_text(json.dumps({'rondas': [r['ronda'] for r in rondas], 'clips': clips}, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('raiz', type=Path)
    parser.add_argument('rondas', nargs=2)
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    exigir(len(set(args.rondas)) == 2, 'Se necesitan dos rondas distintas')
    raiz, salida = args.raiz.absolute(), args.salida.absolute()
    exigir(not raiz.is_symlink(), 'La raíz de videos no admite enlaces')
    exigir(not salida.exists() and not salida.is_symlink(), 'Use una salida nueva; no se borran evidencias anteriores')
    exigir(all(not salida.is_relative_to(raiz / n) for n in args.rondas), 'La salida no puede alterar las rondas')
    salida.mkdir(parents=True)
    informe = {'fecha': datetime.now(timezone.utc).isoformat(), 'resultado': 'FAIL',
               'rondas_solicitadas': args.rondas, 'rondas': [], 'revision_visual': 'pendiente'}
    try:
        for nombre in args.rondas:
            informe['rondas'].append(revisar_ronda(raiz, nombre))
        primera, segunda = informe['rondas']
        exigir(primera['playwright']['pruebas'] == segunda['playwright']['pruebas'], 'Las rondas ejecutaron baterías diferentes')
        exigir(segunda['playwright']['inicio'] >= primera['playwright']['fin'], 'Las rondas se solapan o están invertidas')
        visual = {'estado': 'pendiente', 'criterios': ['contenido legible', 'sin recortes/solapamientos',
                  'contraste y tema coherentes', 'gráficos y estados presentes'],
                  'muestras': [m for r in informe['rondas'] for m in r['muestras_visuales']]}
        (salida / 'revision-visual.json').write_text(json.dumps(visual, indent=2, ensure_ascii=False) + '\n')
        escribir_indice(raiz, salida, informe['rondas'])
        informe['indice'] = {nombre: huella(salida / nombre) for nombre in ('index.html', 'indice.json')}
        informe['resultado'] = 'PASS_TECNICO'
    except Exception as error:
        informe['error'] = str(error)
        for nombre in ('index.html', 'indice.json'):
            (salida / nombre).unlink(missing_ok=True)
    (salida / 'verificacion.json').write_text(json.dumps(informe, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'resultado': informe['resultado'], 'informe': str(salida / 'verificacion.json'),
                      'revision_visual': informe['revision_visual'], 'error': informe.get('error')}, ensure_ascii=False))
    return 0 if informe['resultado'] == 'PASS_TECNICO' else 1


if __name__ == '__main__':
    sys.exit(main())
