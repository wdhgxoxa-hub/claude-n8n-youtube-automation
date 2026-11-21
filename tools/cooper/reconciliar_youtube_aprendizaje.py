#!/usr/bin/env python3
"""Reconcilia un ID público confirmado. Solo cambia youtube_id; no lee secretos.

Por defecto solo informa. --aplicar prueba escritura/reversa/reaplicación en una
transacción y guarda el valor previo en un diario nuevo. Requiere exclusiva operativa.
"""
from contextlib import closing
import argparse
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlparse, parse_qs


def parse(raw):
    try:
        return json.loads(raw or '{}')
    except (ValueError, TypeError):
        return {}


def ids_publicos(valor):
    if isinstance(valor, dict):
        return {i for v in valor.values() for i in ids_publicos(v)}
    if isinstance(valor, list):
        return {i for v in valor for i in ids_publicos(v)}
    if not isinstance(valor, str) or not valor.startswith('https://'):
        return set()
    url = urlparse(valor)
    if url.hostname not in ['youtube.com', 'www.youtube.com', 'youtu.be']:
        return set()
    ident = (parse_qs(url.query).get('v') or [url.path.rstrip('/').split('/')[-1]])[0]
    return {ident} if re.fullmatch(r'[a-zA-Z0-9_-]{11}', ident) else set()


def reconciliar(db, video_id, request_id, aplicar=False, diario=None):
    db.row_factory = sqlite3.Row
    metadata = list(db.execute('SELECT id,name FROM data_table'))
    tablas = {r['name']: r['id'] for r in metadata}
    nombres = ['fab_videos', 'publicaciones' if 'publicaciones' in tablas else 'fab_publicaciones', 'fab_trabajos']
    if any(sum(r['name'] == n for r in metadata) != 1 or not re.fullmatch(r'[A-Za-z0-9]+', tablas[n]) for n in nombres):
        raise ValueError('Esquema de tablas inesperado')
    videos, publicaciones, trabajos = ['data_table_user_' + tablas[n] for n in nombres]
    db.execute('BEGIN IMMEDIATE' if aplicar else 'BEGIN')
    try:
        vs = db.execute(f'SELECT video_id,canal_id,youtube_id,estado FROM {videos} WHERE video_id=?', (video_id,)).fetchall()
        ps = db.execute(f'SELECT video_id,canal_id,request_id,estado,plataformas,resultado FROM {publicaciones} WHERE request_id=?', (request_id,)).fetchall()
        if len(vs) != 1 or len(ps) != 1:
            raise ValueError('El video o la publicación no son únicos')
        v, p = vs[0], ps[0]
        if v['estado'] != 'publicado' or p['estado'] != 'publicado' or p['video_id'] != v['video_id'] or p['canal_id'] != v['canal_id'] or 'youtube' not in (p['plataformas'] or '').lower():
            raise ValueError('No corresponde a una publicación YouTube confirmada del mismo canal')
        candidatos = ids_publicos(parse(p['resultado']))
        fuentes = ['url_publicacion'] if candidatos else []
        for t in db.execute(f"SELECT job_id,resultado FROM {trabajos} WHERE modo='aprender_diagnostico' AND estado='listo' AND canal_id=?", (v['canal_id'],)):
            for r in parse(t['resultado']).get('redes', []):
                ident = str(r.get('youtube_id_confirmado') or '')
                if r.get('request_id_coincide') is True and r.get('request_id') == request_id and r.get('video_id') == video_id and r.get('canal_id') == v['canal_id'] and re.fullmatch(r'[a-zA-Z0-9_-]{11}', ident):
                    candidatos.add(ident)
                    fuentes.append(t['job_id'])
        if len(candidatos) != 1:
            raise ValueError('Falta un ID nativo confirmado inequívoco')
        nuevo = next(iter(candidatos))
        anterior = v['youtube_id']
        if anterior and anterior != nuevo:
            raise ValueError('Existe un ID distinto; no se sobrescribe')
        resultado = {'video_id': video_id, 'canal_id': v['canal_id'], 'request_id': request_id,
                     'youtube_id_anterior': anterior, 'youtube_id_confirmado': nuevo, 'fuentes': sorted(set(fuentes)),
                     'aplicado': False, 'reversa_probada': False, 'solo_columna': 'youtube_id'}
        if aplicar and anterior != nuevo:
            if diario is None:
                raise ValueError('Falta diario previo')
            with Path(diario).open('x') as out:
                Path(diario).chmod(0o600)
                out.write(json.dumps(resultado, ensure_ascii=False, indent=2) + '\n')
            def cambiar(desde, hasta):
                cambio = db.execute(f'UPDATE {videos} SET youtube_id=? WHERE video_id=? AND canal_id=? AND youtube_id IS ?', (hasta, video_id, v['canal_id'], desde))
                if cambio.rowcount != 1:
                    raise ValueError('La fila cambió durante la conciliación')
                observado = db.execute(f'SELECT youtube_id FROM {videos} WHERE video_id=? AND canal_id=?', (video_id, v['canal_id'])).fetchone()[0]
                if observado != hasta:
                    raise ValueError('La verificación de la escritura no coincide')
            cambiar(anterior, nuevo)
            cambiar(nuevo, anterior)
            resultado['reversa_probada'] = True
            cambiar(anterior, nuevo)
            resultado['aplicado'] = True
        db.commit()
        return resultado
    except Exception:
        db.rollback()
        raise


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--base', required=True, type=Path)
    a.add_argument('--video-id', required=True)
    a.add_argument('--request-id', required=True)
    a.add_argument('--aplicar', action='store_true')
    a.add_argument('--diario', type=Path)
    args = a.parse_args()
    modo = 'rw' if args.aplicar else 'ro'
    with closing(sqlite3.connect(args.base.resolve().as_uri() + '?mode=' + modo, uri=True)) as db:
        print(json.dumps(reconciliar(db, args.video_id, args.request_id, args.aplicar, args.diario), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        raise SystemExit('Conciliación detenida sin exponer datos; revisar IDs, esquema, diario y estado publicado')
