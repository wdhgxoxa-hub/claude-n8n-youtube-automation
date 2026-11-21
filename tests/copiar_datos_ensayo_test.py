"""Regresiones de copia segura con una SQLite totalmente ficticia."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('copiar_datos', ROOT / 'tools/cooper/copiar_datos_ensayo.py')
copia = importlib.util.module_from_spec(spec)
spec.loader.exec_module(copia)
MARCADOR = 'SECRETO_FICTICIO_NO_COPIAR'


def crear_fixture(database):
    con = sqlite3.connect(database)
    con.execute('CREATE TABLE data_table (id TEXT, name TEXT, secreto TEXT)')
    con.execute('CREATE TABLE credentials_entity (id TEXT, data TEXT)')
    con.execute('INSERT INTO credentials_entity VALUES (?,?)', ('credencial-ficticia', MARCADOR))
    con.execute('CREATE TABLE settings (key TEXT, value TEXT)')
    con.execute('INSERT INTO settings VALUES (?,?)', ('api-key-ficticia', MARCADOR))
    con.execute('CREATE TABLE execution_data (id TEXT, data TEXT)')
    con.execute('INSERT INTO execution_data VALUES (?,?)', ('ejecucion-ficticia', MARCADOR))
    schemas = {
        'canales': {'canal_id': 'TEXT', 'estado': 'TEXT', 'formato_defecto': 'TEXT', 'presupuesto_short_usd': 'REAL', 'nombre': 'TEXT', 'nicho': 'TEXT', 'metas': 'TEXT', 'cuenta': 'TEXT'},
        'videos': {'video_id': 'TEXT', 'canal_id': 'TEXT', 'estado': 'TEXT', 'etapa': 'TEXT', 'formato': 'TEXT', 'version': 'INTEGER', 'costo_usd': 'REAL', 'tema': 'TEXT', 'render_url': 'TEXT'},
        'planos': {'video_id': 'TEXT', 'plano_id': 'TEXT', 'tipo': 'TEXT', 'estado': 'TEXT', 'orden': 'INTEGER', 'url': 'TEXT', 'archivo_id': 'TEXT', 'prompt': 'TEXT'},
        'costos': {'video_id': 'TEXT', 'usd': 'REAL', 'concepto': 'TEXT', 'servicio': 'TEXT'},
        'trabajos': {'job_id': 'TEXT', 'video_id': 'TEXT', 'canal_id': 'TEXT', 'modo': 'TEXT', 'estado': 'TEXT', 'resultado': 'TEXT'},
        'aprobaciones': {'aprobacion_id': 'TEXT', 'video_id': 'TEXT', 'canal_id': 'TEXT', 'job_id': 'TEXT', 'etapa': 'TEXT', 'estado': 'TEXT', 'pedido': 'TEXT', 'url': 'TEXT', 'resumen': 'TEXT'},
    }
    rows = {
        'canales': {'canal_id': 'canal-privado', 'estado': 'activo', 'formato_defecto': 'short', 'presupuesto_short_usd': 5.0},
        'videos': {'video_id': 'video-privado', 'canal_id': 'canal-privado', 'estado': 'publicado', 'etapa': 'publicado', 'formato': 'short', 'version': 2, 'costo_usd': 1.25},
        'planos': {'video_id': 'video-privado', 'plano_id': 'plano-privado', 'tipo': 'imagen', 'estado': 'listo', 'orden': 0},
        'costos': {'video_id': 'video-privado', 'usd': 1.25},
        'trabajos': {'job_id': 'trabajo-privado', 'video_id': 'video-privado', 'canal_id': 'canal-privado', 'modo': 'guion', 'estado': 'listo'},
        'aprobaciones': {'aprobacion_id': 'aprobacion-privada', 'video_id': 'video-privado', 'canal_id': 'canal-privado', 'job_id': 'trabajo-privado', 'etapa': 'final', 'estado': 'pendiente'},
    }
    for name, schema in schemas.items():
        table = 'data_table_user_' + name
        con.execute('INSERT INTO data_table VALUES (?,?,?)', (name, 'fab_' + name, MARCADOR))
        columns = ','.join('[' + key + '] ' + kind for key, kind in schema.items())
        con.execute('CREATE TABLE [' + table + '] (' + columns + ', [secreto] TEXT)')
        values = [rows[name].get(key, MARCADOR) for key in schema] + [MARCADOR]
        con.execute('INSERT INTO [' + table + '] VALUES (' + ','.join('?' for _ in values) + ')', values)
    con.commit()
    con.close()


class CopiaSegura(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.database = Path(self.tmp.name) / 'n8n-ficticio.sqlite'
        crear_fixture(self.database)

    def test_solo_copia_allowlist_y_pseudonimos_con_relaciones(self):
        huella = hashlib.sha256(self.database.read_bytes()).hexdigest()
        snapshot = copia.copiar(self.database)
        texto = json.dumps(snapshot)
        self.assertNotIn(MARCADOR, texto)
        self.assertNotIn('privado', texto)
        self.assertNotIn('privada', texto)
        self.assertEqual(snapshot['manifest']['total_filas'], 6)
        self.assertTrue(all(n == 1 for n in snapshot['manifest']['conteos'].values()))
        tablas = snapshot['tablas']
        canal, video = tablas['canales'][0], tablas['videos'][0]
        self.assertEqual(canal['canal_id'], video['canal_id'])
        self.assertTrue(canal['canal_id'].startswith('copia-'))
        self.assertEqual(video['video_id'], tablas['costos'][0]['video_id'])
        self.assertEqual(tablas['trabajos'][0]['job_id'], tablas['aprobaciones'][0]['job_id'])
        self.assertEqual(video['estado'], 'publicado')
        self.assertEqual(canal['estado'], 'activo')
        self.assertTrue(canal['eliminado'])
        self.assertTrue(video['eliminado'])
        self.assertEqual(canal['dueno_email'], 'copia@example.test')
        self.assertEqual(video['costo_usd'], 1.25)
        self.assertEqual(huella, hashlib.sha256(self.database.read_bytes()).hexdigest())
        for row in snapshot['manifest']['columnas_leidas'].values():
            self.assertTrue(set(row).isdisjoint({'secreto', 'resultado', 'pedido', 'nombre', 'tema', 'url', 'metas', 'cuenta', 'archivo_id'}))

    def test_authorizer_prohibe_columnas_privadas_tablas_completas_y_escrituras(self):
        autor = copia.AutorizadorLectura()
        autor.permitir_tabla('data_table_user_trabajos', ('job_id', 'estado'))
        con = copia.conectar_solo_lectura(self.database, autor)
        self.addCleanup(con.close)
        self.assertEqual(con.execute('SELECT [estado] FROM [data_table_user_trabajos]').fetchone()[0], 'listo')
        prohibidas = [
            'SELECT [resultado] FROM [data_table_user_trabajos]',
            'SELECT [secreto] FROM [data_table]',
            'SELECT [data] FROM [credentials_entity]',
            'SELECT [value] FROM [settings]',
            'SELECT [data] FROM [execution_data]',
            'SELECT * FROM [data_table_user_trabajos]',
            'PRAGMA table_info(data_table_user_trabajos)',
            "UPDATE [data_table_user_trabajos] SET [estado]='error'",
        ]
        for sql in prohibidas:
            with self.subTest(sql=sql), self.assertRaises(sqlite3.DatabaseError):
                con.execute(sql).fetchall()
        self.assertNotIn(('data_table_user_trabajos', 'resultado'), autor.lecturas)
        self.assertNotIn(('credentials_entity', 'data'), autor.lecturas)

    def test_campos_enum_y_numeros_no_transportan_texto_libre(self):
        con = sqlite3.connect(self.database)
        con.execute('UPDATE data_table_user_videos SET estado=?, costo_usd=?', (MARCADOR, MARCADOR))
        con.commit()
        con.close()
        snapshot = copia.copiar(self.database)
        video = snapshot['tablas']['videos'][0]
        self.assertEqual(video['estado'], 'desconocido')
        self.assertIsNone(video['costo_usd'])
        self.assertEqual(snapshot['manifest']['valores_fuera_de_catalogo'], 2)
        self.assertNotIn(MARCADOR, json.dumps(snapshot))

    def test_rechaza_vista_que_intenta_leer_una_columna_privada(self):
        con = sqlite3.connect(self.database)
        con.execute('DROP TABLE data_table_user_trabajos')
        con.execute('CREATE VIEW data_table_user_trabajos AS SELECT data AS job_id FROM credentials_entity')
        con.commit()
        con.close()
        with self.assertRaises(sqlite3.DatabaseError):
            copia.copiar(self.database)

    def test_salida_privada_exclusiva_y_fuera_de_git(self):
        cache = ROOT / 'cooper/.cache'
        cache.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='copia-segura-test-', dir=cache) as output_dir:
            output = Path(output_dir) / 'snapshot.json'
            snapshot = copia.copiar(self.database)
            copia.guardar(snapshot, output)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(output.read_text()), snapshot)
            with self.assertRaises(FileExistsError):
                copia.guardar(snapshot, output)
        with self.assertRaises(copia.ExportacionRechazada):
            copia.guardar(snapshot, Path(self.tmp.name) / 'snapshot.json')

    def test_cli_solo_imprime_conteos_y_no_datos(self):
        cache = ROOT / 'cooper/.cache'
        cache.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='copia-cli-test-', dir=cache) as output_dir:
            output = Path(output_dir) / 'snapshot.json'
            result = subprocess.run([
                sys.executable, '-B', str(ROOT / 'tools/cooper/copiar_datos_ensayo.py'),
                '--database', str(self.database), '--output', str(output),
            ], check=False, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stderr, '')
            resumen = json.loads(result.stdout)
            self.assertEqual(set(resumen), {'conteos', 'total_filas'})
            self.assertEqual(resumen['total_filas'], 6)
            self.assertNotIn(MARCADOR, result.stdout)
            self.assertNotIn(str(self.database), result.stdout)


if __name__ == '__main__':
    unittest.main()
