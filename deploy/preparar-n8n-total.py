#!/usr/bin/env python3
"""Combina un export real privado con el lote; solo informa IDs, nombres y hashes."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re

DEPENDENCIAS_SEGURAS = {'FabYouTube000001', 'FabRadar00000001', 'FabConfirmar0001'}


def plan_publicacion(workflows, originales):
    por_id = {w['id']: w for w in workflows}
    pendientes = set(originales) | DEPENDENCIAS_SEGURAS
    if not pendientes <= set(por_id):
        raise ValueError('Falta una dependencia necesaria en el lote')
    orden, visitando = [], set()

    def visitar(wid):
        if wid in orden:
            return
        if wid in visitando:
            raise ValueError('Ciclo de subflujos: requiere revisar el plan')
        visitando.add(wid)
        for n in por_id[wid]['nodes']:
            if n['type'] != 'n8n-nodes-base.executeWorkflow' or n.get('disabled'):
                continue
            ref = n['parameters'].get('workflowId', {})
            value = ref.get('value') if isinstance(ref, dict) else ref
            if not value or value.startswith('='):
                continue
            if value not in pendientes:
                raise ValueError('Dependencia estática fuera del plan aprobado')
            visitar(value)
        visitando.remove(wid)
        orden.append(wid)

    for wid in sorted(pendientes):
        visitar(wid)
    return orden


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def preparar(actuales, entradas, origen, metadata=None, publicar_dependencias=False):
    if origen != 'https://flujos.cooperestudio.com':
        raise ValueError('Origen no autorizado')
    by_id = {w['id']: w for w in actuales}
    by_name = {}
    for w in actuales:
        by_name.setdefault(w['name'], []).append(w)
    mapping, pairs = {}, []
    for nuevo in entradas:
        matches = [by_id[nuevo['id']]] if nuevo['id'] in by_id else by_name.get(nuevo['name'], [])
        if len(matches) > 1:
            raise ValueError('Nombre de workflow ambiguo')
        actual = matches[0] if matches else None
        mapping[nuevo['id']] = actual['id'] if actual else nuevo['id']
        pairs.append((nuevo, actual))
    output, report = [], []
    faltantes, bloqueos, disparadores = [], [], []
    # Los identificadores no son claves. Sustituye únicamente referencias conocidas.
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True)))
    for nuevo, actual in pairs:
        data = json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(nuevo, ensure_ascii=False)))
        data['active'] = False
        data['pinData'] = {}
        data['settings']['saveDataSuccessExecution'] = 'none'
        data['settings']['saveDataErrorExecution'] = 'none'
        if actual:
            previous_nodes = {n['name']: n for n in actual['nodes']}
            for node in data['nodes']:
                old = previous_nodes.get(node['name'])
                if old and node['type'] == old['type']:
                    node['id'] = old['id']
                    if old.get('credentials'):
                        node['credentials'] = copy.deepcopy(old['credentials'])
                    if 'webhookId' in old:
                        node['webhookId'] = old['webhookId']
                if nuevo['id'] == 'FabAjustes000001' and node['name'] == 'Ajustes':
                    if not old:
                        raise ValueError('Falta nodo Ajustes real; no usar defaults')
                    node['parameters'] = copy.deepcopy(old['parameters'])
                    js = node['parameters']['jsCode']
                    # Solo dominios de referencia; conserva todo otro ajuste/identificador.
                    js = re.sub(r'https://[a-z0-9-]+\.ngrok-free\.dev', origen, js)
                    node['parameters']['jsCode'] = js
        output.append(data)
        report.append({'id': data['id'], 'nombre': data['name'], 'nuevo': actual is None,
                       'antes_sha256': digest(actual) if actual else None, 'despues_sha256': digest(data),
                       'publicado_antes': bool(actual and actual['active']), 'publicado_entrada': False,
                       'nodos_antes': len(actual['nodes']) if actual else 0, 'nodos_despues': len(data['nodes'])})
    if metadata is not None:
        workflows = set(by_id) | {w['id'] for w in output}
        tablas = set(metadata['tablas'])
        credenciales = metadata['credenciales']
        for w in output:
            for n in w['nodes']:
                p = n.get('parameters', {})
                for field, permitidos in [('workflowId', workflows), ('dataTableId', tablas)]:
                    ref = p.get(field)
                    value = ref.get('value') if isinstance(ref, dict) else ref
                    if isinstance(value, str) and not value.startswith('=') and value not in permitidos:
                        raise ValueError('Referencia inexistente: ' + w['id'] + '/' + n['name'] + '/' + field)
                for tipo, ref in n.get('credentials', {}).items():
                    if any(c['id'] == ref.get('id') and c['type'] == tipo for c in credenciales):
                        continue
                    candidatas = [c for c in credenciales if c['name'] == ref.get('name') and c['type'] == tipo]
                    if len(candidatas) == 1:
                        ref['id'] = candidatas[0]['id']
                    else:
                        faltantes.append({'workflow': w['id'], 'nodo': n['name'], 'tipo': tipo, 'nombre': ref.get('name')})
        if publicar_dependencias:
            for w in output:
                for n in w['nodes']:
                    ausentes = [c for c in faltantes if c['workflow'] == w['id'] and c['nodo'] == n['name']]
                    if ausentes:
                        # La fuente canónica conserva la implementación; el destino falla de forma explícita.
                        nombres = ', '.join(sorted({c['nombre'] or c['tipo'] for c in ausentes}))
                        mensaje = 'Paso bloqueado: falta configurar ' + nombres + '. No se realizó ninguna llamada externa.'
                        n['type'] = 'n8n-nodes-base.code'
                        n['typeVersion'] = 2
                        n['parameters'] = {'jsCode': 'throw new Error(' + json.dumps(mensaje, ensure_ascii=False) + ');'}
                        for key in ('credentials', 'onError', 'continueOnFail', 'retryOnFail', 'maxTries', 'waitBetweenTries'):
                            n.pop(key, None)
                        bloqueos.append({'workflow': w['id'], 'nodo': n['name'], 'motivo': 'credencial_ausente', 'comportamiento': 'error_explicito'})
                    if w['id'] in DEPENDENCIAS_SEGURAS and n['type'] in ('n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.webhook'):
                        n['disabled'] = True
                        disparadores.append({'workflow': w['id'], 'nodo': n['name'], 'tipo': n['type']})
        for w, r in zip(output, report):
            r['despues_sha256'] = digest(w)
    originales = [r['id'] for r in report if r['publicado_antes']]
    resultado = {'mapa_ids': mapping, 'flujos': report, 'credenciales_faltantes': faltantes,
                 'republicar_originales': originales, 'bloqueos_explicitos': bloqueos,
                 'disparadores_dependencias_pausados': disparadores}
    if publicar_dependencias:
        if metadata is None:
            raise ValueError('Publicar dependencias exige inventario de referencias')
        resultado['plan_publicacion'] = plan_publicacion(output, originales)
    return output, resultado


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', dest='export', type=Path, required=True)
    parser.add_argument('--entrada', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    parser.add_argument('--metadata', type=Path)
    parser.add_argument('--publicar-dependencias-seguras', action='store_true')
    args = parser.parse_args()
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    actuales = json.loads(args.export.read_text())
    entradas = [json.loads(p.read_text()) for p in sorted(args.entrada.glob('*.json'))]
    metadata = json.loads(args.metadata.read_text()) if args.metadata else None
    salida, diff = preparar(actuales, entradas, 'https://flujos.cooperestudio.com', metadata, args.publicar_dependencias_seguras)
    for name, data in [('entrada.json', salida), ('diff.json', diff)]:
        target = args.salida / name
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        target.chmod(0o600)
    print(json.dumps({'preparados': len(salida), 'inactivos': True, 'diff': str(args.salida / 'diff.json')}))


if __name__ == '__main__':
    main()
