"""Ejecuta cada nodo Code de cada flujo en el motor real, sin datos de entrada.
Un error de datos (p. ej. leer algo vacío) es esperable; un «X is not defined» o «Unexpected token» es un fallo real del entorno o de sintaxis."""
import sys, os, json, glob, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import arnes as A
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
malos, total = [], 0
for f in sorted(glob.glob(os.path.join(RAIZ, 'workflows', 'v2', '*.json'))):
    w = json.load(open(f)); nombres = {n['name'] for n in w['nodes']}
    for n in w['nodes']:
        if n['type'] != 'n8n-nodes-base.code': continue
        total += 1
        nodo = {**n, 'onError': 'continueRegularOutput'}
        orig = A.nodo; A.nodo = lambda fl, nm, _n=nodo: _n
        try: out = A.probar(w['id'], n['name'], {}, entrada=[{}], sin_ejecutar=[x for x in nombres if x != n['name']][:0])
        finally: A.nodo = orig
        txt = json.dumps(out, ensure_ascii=False)
        m = re.search(r'([A-Za-z_$][\w$]*) is not defined|SyntaxError[^"]*|Unexpected token[^"]*|is not a function', txt)
        if m:
            ident = m.group(1)
            # referencias a nodos ($('X')) fallan sin datos: eso no es del entorno
            if ident and ident in ('$',): continue
            malos.append((w['name'], n['name'], m.group(0)[:120]))
        print(f"{'✗' if m else '·'} {w['name'][:28]} | {n['name']}" + (f" → {m.group(0)[:100]}" if m else ''), flush=True)
print(f"\n{total} nodos Code; posibles fallos de entorno o sintaxis: {len(malos)}")
for x in malos: print(' ', x)
