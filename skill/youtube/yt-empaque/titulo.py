#!/usr/bin/env python3
"""titulo.py - revisa título y miniatura como UNA pareja antes de publicar.

Adaptado de title.py de Jakeschincariol/youtube-agent-skill (MIT).

    python3 titulo.py --titulo "..." --miniatura "QUEDAN S/ 2"
    python3 titulo.py titulos.txt            # uno por línea, ordenados
    python3 titulo.py --json --titulo "..."

YouTube corta cerca de 60 caracteres en la búsqueda de escritorio y cerca de 40 en el inicio del
celular: se reportan los dos porque fallan distinto (uno pierde el final, el otro puede perder el tema).
La misma lógica corre en n8n (publicación), leyendo este mismo titulo.json.
"""
import json, os, re, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(AQUI, "titulo.json"), encoding="utf-8"))

def normal(t):
    t = unicodedata.normalize("NFD", t.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")
def palabras(t): return re.findall(r"[a-z0-9ñ']+", normal(t))

def revisar(titulo, miniatura=None):
    t = titulo.strip(); n = len(t); fallas, bien = [], []
    if n > C["maximo"]: fallas.append(("largo", f"{n} caracteres: el límite de YouTube es {C['maximo']}"))
    elif n > C["escritorio"]: fallas.append(("largo", f"{n} caracteres: la búsqueda de escritorio corta cerca de {C['escritorio']}"))
    else: bien.append(f"{n} caracteres, dentro del corte de escritorio ({C['escritorio']})")
    if n > C["movil"]:
        cabeza = t[:C["movil"]].rsplit(" ", 1)[0]
        fallas.append(("movil", f"en el celular se ve «{cabeza}…»: revisa que el tema sobreviva"))
    mayus = [w for w in t.split() if len(w) > 2 and w.isupper() and not re.search(r"\d", w)]
    if len(mayus) > 2: fallas.append(("gritos", f"{len(mayus)} palabras en mayúsculas: más de dos parece spam"))
    vagas = sorted({w for w in palabras(t) if w in C["vagas"]})
    if vagas: fallas.append(("vago", f"{', '.join(vagas)}: cámbialo por un número, un nombre o una fecha"))
    if re.search(r"\d", t): bien.append("lleva una cifra concreta")
    else: fallas.append(("sin-cifra", "sin número, fecha ni nombre: el arreglo más fiable"))
    if t.endswith("?"): bien.append("pregunta abierta")
    if not [w for w in palabras(t)[:3] if w not in C["vacias"]]:
        fallas.append(("inicio", "las tres primeras palabras son relleno: adelanta el tema"))
    if miniatura:
        clave = lambda x: {w for w in palabras(x) if len(w) > 1 and w not in C["vacias"]}
        comunes = clave(t) & clave(miniatura)
        if comunes: fallas.append(("repite", f"la miniatura repite el título en {', '.join(sorted(comunes))}: debe decir lo que el título no dice"))
        else: bien.append("título y miniatura dicen cosas distintas")
        if len(palabras(miniatura)) > C["palabras_miniatura"]:
            fallas.append(("miniatura-larga", f"{len(palabras(miniatura))} palabras en la miniatura: {C['palabras_miniatura']} es el techo a tamaño de feed"))
    puntaje = max(0, min(100, 100 - 14 * len(fallas) + 4 * len(bien)))
    return {"titulo": t, "caracteres": n, "puntaje": puntaje, "fallas": fallas, "bien": bien}

def main():
    a = sys.argv[1:]; js = "--json" in a; a = [x for x in a if x != "--json"]
    mini = a[a.index("--miniatura") + 1] if "--miniatura" in a else None
    if "--titulo" in a: filas = [revisar(a[a.index("--titulo") + 1], mini)]
    elif a and os.path.exists(a[0]): filas = [revisar(l, mini) for l in open(a[0], encoding="utf-8").read().splitlines() if l.strip()]
    else: print(__doc__); sys.exit(1)
    filas.sort(key=lambda r: -r["puntaje"])
    if js: print(json.dumps(filas, ensure_ascii=False, indent=1)); return
    for r in filas:
        print(f"\n  «{r['titulo']}»  {r['caracteres']} caracteres  puntaje {r['puntaje']}/100")
        for k, m in r["fallas"]: print(f"    x  {k:<16} {m}")
        for m in r["bien"]: print(f"    ok                  {m}")

if __name__ == "__main__":
    main()
