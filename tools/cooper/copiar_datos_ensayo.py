#!/usr/bin/env python3
"""Copia una allowlist de SQLite n8n detenido a un ensayo local pseudonimizado.

No consulta credenciales, configuración, ejecuciones ni campos de texto libre.
La base debe pertenecer a un contenedor detenido. No detiene servicios ni modifica
la base: abre una URI mode=ro e impone además un autorizador SQLite por columna.
Salida CLI: únicamente conteos. El JSON solo puede escribirse bajo .cache/.
"""
import argparse
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import sys


ROOT = Path(__file__).resolve().parents[2]
IDENTIFICADORES = {
    'canales': ('canal_id',),
    'videos': ('video_id', 'canal_id'),
    'planos': ('video_id', 'plano_id'),
    'costos': ('video_id', 'paso_id'),
    'trabajos': ('job_id', 'video_id', 'canal_id'),
    'aprobaciones': ('aprobacion_id', 'video_id', 'canal_id', 'job_id'),
}
ENUMS = {
    'estado': frozenset({
        'activo', 'inactivo', 'pausado', 'creando_biblia', 'investigando',
        'en_proceso', 'pendiente', 'enviado', 'bloqueado', 'listo', 'ok',
        'error', 'con_fallas', 'detenido', 'anulado', 'cancelado', 'publicado',
        'programado', 'aprobado', 'rechazado', 'cambios', 'decidida', 'esperando',
        'procesando', 'fallido', 'terminado', 'eliminado', 'revision',
    }),
    'etapa': frozenset({
        'canal', 'nicho', 'idea', 'radar', 'guion', 'verificacion',
        'aprobacion_guion', 'storyboard', 'produccion', 'imagenes', 'planos',
        'voz', 'sonido', 'montaje', 'render', 'calidad', 'final',
        'aprobacion_final', 'programado', 'publicado', 'aprendizaje',
    }),
    'formato': frozenset({'short', 'largo', 'avatar'}),
    'formato_defecto': frozenset({'short', 'largo', 'avatar'}),
    'modo': frozenset({
        'investigar_nichos', 'adoptar_cuenta', 'crear_biblia', 'guion',
        'corregir_guion', 'storyboard', 'revisar_plano', 'aprender',
    }),
    'tipo': frozenset({'imagen', 'ilustracion', 'clip', 'archivo', 'avatar'}),
}
ENUM_POR_TABLA = {
    'canales': ('estado', 'formato_defecto'),
    'videos': ('estado', 'etapa', 'formato'),
    'planos': ('tipo', 'estado'),
    'costos': (),
    'trabajos': ('modo', 'estado'),
    'aprobaciones': ('etapa', 'estado'),
}
NUMEROS = {
    'canales': ('presupuesto_largo_usd', 'presupuesto_short_usd'),
    'videos': ('version', 'costo_usd', 'presupuesto_usd', 'intentos', 'retencion', 'retencion_media'),
    'planos': ('version', 'orden', 'costo_usd', 'duracion_s', 'intentos'),
    'costos': ('usd', 'ahorro_estimado_usd'),
    'trabajos': (),
    'aprobaciones': (),
}
ALLOWLIST = {
    'fab_' + name: IDENTIFICADORES[name] + ENUM_POR_TABLA[name] + NUMEROS[name]
    for name in IDENTIFICADORES
}


class ExportacionRechazada(Exception):
    """Error público sin incluir contenido de filas, rutas ni SQL."""


class AutorizadorLectura:
    """Deniega por defecto: solo SELECT y READ de columnas declaradas."""

    def __init__(self):
        self.columnas = {'data_table': frozenset({'id', 'name'})}
        self.lecturas = set()

    def permitir_tabla(self, tabla, columnas):
        self.columnas[tabla] = frozenset(columnas)

    def __call__(self, accion, tabla, columna, base, origen):
        if accion == sqlite3.SQLITE_SELECT:
            return sqlite3.SQLITE_OK
        if accion == sqlite3.SQLITE_READ and base == 'main' and origen is None:
            if columna in self.columnas.get(tabla, ()):
                self.lecturas.add((tabla, columna))
                return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY


def identificador_sql(nombre):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,160}', nombre):
        raise ExportacionRechazada('Identificador de tabla no admitido.')
    return '[' + nombre + ']'


def conectar_solo_lectura(database, autorizador):
    database = Path(database).resolve(strict=True)
    if not database.is_file():
        raise ExportacionRechazada('La fuente debe ser un archivo SQLite existente.')
    con = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    con.set_authorizer(autorizador)
    return con


def copiar(database):
    """Retorna solo el snapshot permitido. Nunca devuelve filas originales."""
    autorizador = AutorizadorLectura()
    aliases = {}
    invalidos = 0

    def seudonimo(valor):
        if valor is None or valor == '':
            return ''
        if not isinstance(valor, (str, int)):
            raise ExportacionRechazada('Tipo de identificador no admitido.')
        clave = str(valor)
        if clave not in aliases:
            aliases[clave] = 'copia-' + str(len(aliases) + 1).zfill(6)
        return aliases[clave]

    tablas, columnas_leidas = {}, {}
    con = conectar_solo_lectura(database, autorizador)
    try:
        parametros = ','.join('?' for _ in ALLOWLIST)
        mapa = con.execute(
            'SELECT [id], [name] FROM [data_table] WHERE [name] IN (' + parametros + ')',
            tuple(ALLOWLIST),
        ).fetchall()
        por_nombre = {}
        for row in mapa:
            nombre = row['name']
            if nombre in por_nombre or not isinstance(row['id'], str):
                raise ExportacionRechazada('Mapa de tablas ambiguo o incompatible.')
            por_nombre[nombre] = 'data_table_user_' + row['id']
        if set(por_nombre) != set(ALLOWLIST):
            raise ExportacionRechazada('Falta una de las seis tablas autorizadas.')
        if len(set(por_nombre.values())) != len(por_nombre):
            raise ExportacionRechazada('Mapa de tablas ambiguo o incompatible.')
        for nombre, permitidas in ALLOWLIST.items():
            tabla = por_nombre[nombre]
            tabla_sql = identificador_sql(tabla)
            autorizador.permitir_tabla(tabla, permitidas)
            existentes = []
            for columna in permitidas:
                # Consulta vacía de una sola columna: no lee defaults del esquema
                # ni permite que una columna desconocida se interprete como texto.
                try:
                    con.execute('SELECT ' + identificador_sql(columna) + ' FROM ' + tabla_sql + ' WHERE 0')
                except sqlite3.OperationalError as exc:
                    if str(exc).startswith('no such column:'):
                        continue
                    raise
                existentes.append(columna)
            corta = nombre.removeprefix('fab_')
            if not set(IDENTIFICADORES[corta]).intersection(existentes):
                raise ExportacionRechazada('Tabla sin identificadores compatibles.')
            seleccion = ', '.join(identificador_sql(col) for col in existentes)
            columnas_leidas[nombre] = existentes
            seguras = []
            for fila in con.execute('SELECT ' + seleccion + ' FROM ' + tabla_sql):
                limpia = {}
                for col in existentes:
                    valor = fila[col]
                    if col in IDENTIFICADORES[corta]:
                        limpia[col] = seudonimo(valor)
                    elif col in ENUM_POR_TABLA[corta]:
                        if valor is None or valor == '':
                            limpia[col] = ''
                        elif isinstance(valor, str) and valor in ENUMS[col]:
                            limpia[col] = valor
                        else:
                            limpia[col] = 'desconocido'
                            invalidos += 1
                    elif valor is None:
                        limpia[col] = None
                    elif isinstance(valor, (int, float)) and not isinstance(valor, bool) and math.isfinite(valor) and valor >= 0:
                        limpia[col] = valor
                    else:
                        limpia[col] = None
                        invalidos += 1
                if corta in {'canales', 'videos', 'trabajos', 'costos'}:
                    limpia['dueno_email'] = 'copia@example.test'
                if corta in {'canales', 'videos'}:
                    limpia['eliminado'] = True
                if corta == 'canales':
                    limpia.update(nombre='Canal ficticio copiado ' + str(len(seguras) + 1), nicho='Historia ficticia de ensayo')
                if corta == 'videos':
                    limpia['tema'] = 'Tema ficticio copiado ' + str(len(seguras) + 1)
                seguras.append(limpia)
            tablas[corta] = seguras
    finally:
        con.close()
    return {
        'version': 1,
        'origen': 'Copia pseudonimizada de SQLite n8n detenido, abierta mode=ro y limitada por columna',
        'tablas': tablas,
        'manifest': {
            'conteos': {name: len(rows) for name, rows in tablas.items()},
            'total_filas': sum(map(len, tablas.values())),
            'allowlist': {name: list(cols) for name, cols in ALLOWLIST.items()},
            'columnas_leidas': columnas_leidas,
            'metadatos_leidos': {'data_table': ['id', 'name']},
            'valores_fuera_de_catalogo': invalidos,
            'canales_y_videos_eliminados': True,
            'credenciales_copiadas': 0,
        },
    }


def guardar(snapshot, output):
    output = Path(output).resolve()
    permitidas = (ROOT / '.cache', ROOT / 'cooper' / '.cache')
    if not any(output.is_relative_to(base) for base in permitidas):
        raise ExportacionRechazada('La salida debe quedar dentro de .cache/ o cooper/.cache/, excluidas de Git.')
    if output.suffix != '.json':
        raise ExportacionRechazada('La salida debe tener extensión .json.')
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as archivo:
        json.dump(snapshot, archivo, ensure_ascii=False, indent=2, allow_nan=False)
        archivo.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True, type=Path, help='SQLite de n8n detenido; se abre mode=ro.')
    parser.add_argument('--output', required=True, type=Path, help='JSON nuevo bajo .cache/ o cooper/.cache/.')
    args = parser.parse_args()
    try:
        snapshot = copiar(args.database)
        guardar(snapshot, args.output)
    except ExportacionRechazada as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except (OSError, sqlite3.Error, ValueError, TypeError):
        print('No se pudo completar la copia segura; no se imprimieron datos de la fuente.', file=sys.stderr)
        return 1
    print(json.dumps({'conteos': snapshot['manifest']['conteos'], 'total_filas': snapshot['manifest']['total_filas']}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
