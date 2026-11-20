#!/usr/bin/env python3
"""capitulos.py - valida la lista de capítulos contra las reglas de YouTube.

Reglas de yt-chapters (Jakeschincariol/youtube-agent-skill, MIT): empieza en 0:00, al menos tres,
cada uno de 10 s o más. Lee el arreglo `capitulos` del guion: [{"t": "0:00", "titulo": "..."}].

    python3 capitulos.py capitulos.json --duracion 600
"""
import json, re, sys

def seg(t):
    p = [int(x) for x in str(t).strip().split(":")]
    return sum(v * 60 ** i for i, v in enumerate(reversed(p)))

def validar(caps, duracion=None):
    fallas = []
    if len(caps) < 3: fallas.append(f"hay {len(caps)} capítulos: YouTube necesita al menos 3")
    if caps and seg(caps[0]["t"]) != 0: fallas.append(f"el primero empieza en {caps[0]['t']}: debe ser 0:00")
    ts = [seg(c["t"]) for c in caps] + ([duracion] if duracion else [])
    for i in range(len(caps)):
        if i + 1 < len(ts) and ts[i + 1] - ts[i] < 10:
            fallas.append(f"«{caps[i]['titulo']}» dura {ts[i + 1] - ts[i]} s: el mínimo es 10")
        if i and ts[i] <= ts[i - 1]: fallas.append(f"«{caps[i]['titulo']}» no va después del anterior")
        n = len(re.findall(r"\S+", caps[i].get("titulo", "")))
        if not 3 <= n <= 5: fallas.append(f"«{caps[i].get('titulo','')}» tiene {n} palabras: mejor de 3 a 5, como promesa")
    return {"valido": not [f for f in fallas if "palabras" not in f], "fallas": fallas}

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(1)
    dur = int(a[a.index("--duracion") + 1]) if "--duracion" in a else None
    d = json.load(open(a[0], encoding="utf-8")); caps = d.get("capitulos", d) if isinstance(d, dict) else d
    print(json.dumps(validar(caps, dur), ensure_ascii=False, indent=1))
