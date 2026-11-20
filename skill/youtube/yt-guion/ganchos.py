#!/usr/bin/env python3
"""ganchos.py - puntúa un gancho en español antes de gastar en él.

Adaptado de hookscore.py de Jakeschincariol/youtube-agent-skill (MIT). Cinco propiedades de 0 a 100 y
un veredicto que es 60 % el promedio y 40 % la más débil: un gancho con cuatro propiedades fuertes y
una muerta se escapa por la muerta.

    python3 ganchos.py --gancho "una frase"      # un gancho
    python3 ganchos.py ganchos.txt               # uno por línea, ordenados
    python3 ganchos.py --json ganchos.txt        # salida para máquinas

Es una ALERTA, no un juez: un puntaje bajo es motivo para mirar otra vez; uno alto no promete nada.
La misma lógica corre en n8n (nodo «Puntuar ganchos»), leyendo este mismo ganchos.json.
"""
import json, os, re, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(AQUI, "ganchos.json"), encoding="utf-8"))
L = D["listas"]; MIN_P, MAX_P = D["rango_palabras"]

def normal(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[¿¡]", "", t).strip()

def palabras(t): return re.findall(r"[a-z0-9%/.,]+", normal(t))
def cuenta(lista, t):  # frases de varias palabras cuentan como una
    n = normal(t); return sum(len(re.findall(r"\b" + re.escape(x) + r"\b", n)) for x in lista)
CONCRETO = re.compile(r"(\d[\d.,]*\s?(%|mil|millones|soles|dolares|s|m|h)?\b|s/ ?\d|\$ ?\d|\b\d+\s?(segundos?|minutos?|horas?|dias?|semanas?|meses|anos?)\b)")

def especificidad(t):
    w = palabras(t)
    if not w: return 0
    s = 34 + len(CONCRETO.findall(normal(t))) * 22 - cuenta(L["vagas"], t) * 16 - cuenta(L["relleno"], t) * 5
    s += min(18, 6 * sum(1 for x in t.split()[1:] if x[:1].isupper()))   # nombres propios
    return max(0, min(100, s))

def a_ti(t):
    primeras = " ".join(t.split()[:6])
    return max(0, min(100, 26 + cuenta(L["tu"], t) * 20 + (30 if cuenta(L["tu"], primeras) else 0)))

def riesgo(t): return max(0, min(100, 22 + cuenta(L["riesgo"], t) * 26 + (14 if CONCRETO.search(normal(t)) else 0)))

def curiosidad(t):
    q = 18 if t.strip().endswith("?") else 0
    cerrado = -18 if cuenta(L["cierre"], t) else 0          # un gancho que se responde solo no deja hueco
    return max(0, min(100, 24 + cuenta(L["curiosidad"], t) * 17 + q + cerrado))

def brevedad(t):
    n = len(palabras(t))
    if n == 0: return 0
    if MIN_P <= n <= MAX_P: return 100
    if n < MIN_P: return max(30, 100 - (MIN_P - n) * 11)
    return max(10, 100 - (n - MAX_P) * 7)

PROPS = [("especificidad", especificidad), ("a_ti", a_ti), ("riesgo", riesgo), ("curiosidad", curiosidad), ("brevedad", brevedad)]
ARREGLO = {"especificidad": "cambia un adjetivo por un número, un nombre o una fecha",
           "a_ti": "habla al espectador (tú, tus, pagas…) en las primeras seis palabras",
           "riesgo": "di qué le cuesta seguir creyendo lo que cree",
           "curiosidad": "corta la mitad de la frase que se responde sola",
           "brevedad": f"de {MIN_P} a {MAX_P} palabras: léelo en voz alta y para donde te falte el aire"}

def formula(t):
    n = normal(t); mejor, hits = None, 0
    for f in D["formulas"]:
        k = sum(1 for p in f["patrones"] if re.search(p, n))
        if k > hits: mejor, hits = f, k
    return (mejor["nombre"] if mejor else "Sin fórmula"), hits

def puntuar(t):
    partes = {k: fn(t) for k, fn in PROPS}; v = list(partes.values())
    veredicto = int(0.6 * sum(v) / len(v) + 0.4 * min(v) + 0.5)   # mismo redondeo que n8n (Math.round)
    nombre, hits = formula(t); debil = min(partes, key=partes.get)
    banda = "FUERTE" if veredicto >= 72 else "SIRVE" if veredicto >= 55 else "DÉBIL"
    return {"gancho": t.strip(), "propiedades": partes, "veredicto": veredicto, "banda": banda,
            "formula": nombre, "coincidencias": hits, "mas_debil": debil, "arreglo": ARREGLO[debil]}

def main():
    a = sys.argv[1:]; js = "--json" in a; a = [x for x in a if x != "--json"]
    if "--gancho" in a: lineas = [a[a.index("--gancho") + 1]]
    elif a and os.path.exists(a[0]): lineas = [l for l in open(a[0], encoding="utf-8").read().splitlines() if l.strip()]
    else: print(__doc__); sys.exit(1)
    out = sorted((puntuar(t) for t in lineas), key=lambda r: -r["veredicto"])
    if js: print(json.dumps(out, ensure_ascii=False, indent=1)); return
    for r in out:
        print(f"\n  {r['gancho']}")
        for k, v in r["propiedades"].items(): print(f"    {k:<14} {v:3d}  {'#' * (v // 5)}")
        print(f"    {'VEREDICTO':<14} {r['veredicto']:3d}  {r['banda']}\n    fórmula        {r['formula']}\n    más débil      {r['mas_debil']}: {r['arreglo']}")

if __name__ == "__main__":
    main()
