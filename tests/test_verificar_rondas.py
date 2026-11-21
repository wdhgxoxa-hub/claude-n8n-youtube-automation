"""Casos del revisor: informes ficticios y clips sintéticos, sin navegadores."""
import copy
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('verificar_rondas',
    Path(__file__).resolve().parents[1] / 'cooper/scripts/verificar-rondas.py')
revisor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(revisor)


def playwright():
    specs = [{'title': 'Caso ' + proyecto, 'file': 'ficticio.spec.ts', 'ok': True,
              'tests': [{'projectName': proyecto, 'status': 'expected', 'expectedStatus': 'passed',
                         'results': [{'status': 'passed', 'retry': 0}]}]}
             for proyecto in sorted(revisor.PROYECTOS)]
    return {'stats': {'expected': len(specs), 'unexpected': 0, 'flaky': 0, 'skipped': 0,
                      'startTime': '2026-11-21T16:00:00Z', 'duration': 1000},
            'errors': [], 'suites': [{'specs': specs}]}


class Informes(unittest.TestCase):
    def test_exige_toda_la_bateria_sin_reintentos_ni_omisiones(self):
        informe = playwright()
        self.assertEqual(revisor.pruebas_playwright(informe)['cantidad'], 5)
        for key in ('unexpected', 'flaky', 'skipped'):
            malo = copy.deepcopy(informe)
            malo['stats'][key] = 1
            with self.assertRaisesRegex(ValueError, 'fallos, omisiones'):
                revisor.pruebas_playwright(malo)
        malo = copy.deepcopy(informe)
        malo['suites'][0]['specs'][0]['tests'][0]['results'][0]['retry'] = 1
        with self.assertRaisesRegex(ValueError, 'reintentada'):
            revisor.pruebas_playwright(malo)
        informe['suites'][0]['specs'].pop()
        informe['stats']['expected'] -= 1
        with self.assertRaisesRegex(ValueError, 'Faltan proyectos'):
            revisor.pruebas_playwright(informe)

    def test_matriz_no_relaja_los_umbrales_y_rechaza_nan(self):
        pantallas = [{'name': f'390-claro-{i:02}-inicio', 'video': f'390-claro-{i:02}-inicio.webm',
                     'width': 390, 'theme': 'claro', 'cpu': 4, 'fps': 60, 'p95': 16.7,
                     'maxFrame': 20, 'cls': 0, 'frames': 120, 'longTasks': []} for i in range(22)]
        self.assertEqual(revisor.matriz(pantallas, 390, 'claro')['pantallas'], 22)
        for campo, valor in [('fps', 56), ('maxFrame', 100), ('longTasks', [100]), ('p95', 26), ('cls', .02), ('fps', float('nan'))]:
            malo = copy.deepcopy(pantallas)
            malo[0][campo] = valor
            with self.assertRaises(ValueError):
                revisor.matriz(malo, 390, 'claro')
        with self.assertRaisesRegex(ValueError, 'incompleta'):
            revisor.matriz(pantallas[:-1], 390, 'claro')

    def test_sentinel_no_oculta_bajo_fps_ni_acepta_caos_vacio(self):
        informe = {'modulos': [{'nombre': n} for n in ('recorridos', 'caos', 'estabilidad')],
                   'pantallas': ['/'] * 20, 'hallazgos': [{'gravedad': 'info'}],
                   'medidas_caos': [{'acciones': 10, 'fps': [20, 60], 'congelada': False, 'estrellada': False}]}
        dato = revisor.sentinel(informe)
        self.assertEqual(dato['fps_min_puntual'], 20)
        self.assertEqual(dato['muestras_menos_45_fps'], 1)
        for cambio in ({'acciones': 0}, {'congelada': True}, {'estrellada': True}):
            malo = copy.deepcopy(informe)
            malo['medidas_caos'][0].update(cambio)
            with self.assertRaises(ValueError):
                revisor.sentinel(malo)
        informe['hallazgos'][0]['gravedad'] = 'media'
        with self.assertRaisesRegex(ValueError, 'no informativos'):
            revisor.sentinel(informe)

    def test_ronda_fallida_no_genera_indice_y_no_borra_anteriores(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for nombre in ('cierre-1', 'cierre-2'):
                carpeta = root / nombre
                carpeta.mkdir()
                informe = playwright()
                informe['stats']['unexpected'] = 1
                (carpeta / 'playwright.json').write_text(json.dumps(informe))
            anterior = root / 'index.html'
            anterior.write_text('Evidencia anterior preservada')
            salida = root / 'revision'
            result = subprocess.run(['python3', str(Path(revisor.__file__)), str(root),
                                     'cierre-1', 'cierre-2', '--salida', str(salida)],
                                    capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads((salida / 'verificacion.json').read_text())['resultado'], 'FAIL')
            self.assertFalse((salida / 'index.html').exists())
            self.assertEqual(anterior.read_text(), 'Evidencia anterior preservada')


class Videos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporal = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temporal.cleanup)
        cls.raiz = Path(cls.temporal.name)
        for ext, codec in [('webm', 'libvpx-vp9'), ('mp4', 'libx264')]:
            result = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-v', 'error', '-f', 'lavfi',
                                     '-i', 'color=blue:size=64x64:rate=5', '-t', '0.4', '-c:v', codec,
                                     '-threads', '1', '-y', str(cls.raiz / ('clip.' + ext))],
                                    capture_output=True, text=True, check=False)
            if result.returncode != 0:
                raise RuntimeError('No se pudo crear el clip sintético: ' + result.stderr)

    def test_probe_y_decodificacion_completa_webm_y_mp4(self):
        for ext in ('webm', 'mp4'):
            with self.subTest(ext=ext):
                dato = revisor.verificar_video(self.raiz / ('clip.' + ext), (64, 64))
                self.assertEqual(dato['cuadros_decodificados'], 2)
                self.assertTrue(dato['decodificacion_completa'])
                self.assertEqual(dato['diagnosticos'], 0)
                self.assertEqual(len(dato['sha256']), 64)

    def test_rechaza_video_truncado_o_resolucion_incorrecta(self):
        clip = self.raiz / 'clip.mp4'
        with self.assertRaisesRegex(ValueError, 'Resolución distinta'):
            revisor.verificar_video(clip, (390, 900))
        truncado = self.raiz / 'truncado.mp4'
        truncado.write_bytes(clip.read_bytes()[:clip.stat().st_size // 2])
        with self.assertRaises(ValueError):
            revisor.verificar_video(truncado)


if __name__ == '__main__':
    unittest.main()
