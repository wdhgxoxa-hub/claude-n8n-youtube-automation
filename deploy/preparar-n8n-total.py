#!/usr/bin/env python3
"""Combina un export real privado con el lote; solo informa IDs, nombres y hashes."""
import argparse
import copy
from contextlib import closing
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

DEPENDENCIAS_SEGURAS = {'FabYouTube000001', 'FabRadar00000001', 'FabConfirmar0001'}
POLITICA_DISPARADORES = 'conservar_existentes_bloquear_nuevos'
CAMPOS_CAS = ('nodes', 'connections', 'settings', 'versionId', 'activeVersionId', 'active')
CAMPOS_CONTENIDO = ('nodes', 'connections', 'settings')
AUSENTE = object()
CAMPOS_RESOLUCION = {'workflow', 'componente', 'nombre', 'base_sha256', 'integrado_sha256',
                     'vivo_sha256', 'elegir', 'motivo'}
CAMPOS_HUELLAS = ('base_sha256', 'integrado_sha256', 'vivo_sha256')


def entrada_externa(node):
    tipo = node.get('type', '').split('.')[-1]
    return tipo not in ('executeWorkflowTrigger', 'manualTrigger') and (
        'trigger' in tipo.lower() or tipo in ('webhook', 'form'))


def nodos_por_firma(nodes):
    result = {(n['name'], n['type']): n for n in nodes}
    if len(result) != len(nodes):
        raise ValueError('Nombre y tipo de nodo ambiguos')
    return result


def plan_publicacion(workflows, originales, dependencias=None):
    por_id = {w['id']: w for w in workflows}
    pendientes = set(originales) | (DEPENDENCIAS_SEGURAS if dependencias is None else set(dependencias))
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


class ConflictoConciliacion(ValueError):
    def __init__(self, comparacion):
        super().__init__('Conciliación bloqueada; revisar únicamente nombres, hashes y decisiones del informe')
        self.comparacion = comparacion


def hash_componente(value):
    return digest({'presente': False} if value is AUSENTE else {'presente': True, 'valor': value})


def indice_unico(values, key):
    result = {item[key]: item for item in values}
    if len(result) != len(values):
        raise ValueError('Identidad ambigua en la comparación de tres vías')
    return result


def indice_resoluciones(resoluciones):
    if not isinstance(resoluciones, list):
        raise ValueError('Las resoluciones deben ser una lista explícita')
    result = {}
    for row in resoluciones:
        if (not isinstance(row, dict) or set(row) != CAMPOS_RESOLUCION
                or any(not isinstance(row[key], str) or not row[key].strip() for key in CAMPOS_RESOLUCION)
                or row['componente'] not in ('nodo', 'conexiones', 'ajuste')
                or row['elegir'] not in ('vivo', 'integrado') or len(row['motivo']) > 1000
                or any(not re.fullmatch('[a-f0-9]{64}', row[key]) for key in CAMPOS_HUELLAS)):
            raise ValueError('Resolución desconocida o incompleta; exige identidad, tres hashes, elección y motivo')
        key = (row['workflow'], row['componente'], row['nombre'])
        if key in result:
            raise ValueError('Resolución duplicada para el mismo componente')
        result[key] = row
    return result


def validar_resoluciones(comparison):
    resoluciones = comparison.get('resoluciones', [])
    by_key = indice_resoluciones(resoluciones)
    if 'resoluciones' in comparison and digest(resoluciones) != comparison.get('resoluciones_sha256'):
        raise ValueError('La huella de las resoluciones no coincide')
    used = set()
    for row in comparison['componentes']:
        key = (row['workflow'], row['componente'], row['nombre'])
        resolution = by_key.get(key)
        if row['decision'] in ('resuelto_vivo', 'resuelto_integrado'):
            if (resolution is None or key in used or row.get('decision_previa') != 'conflicto'
                    or len({row.get(field) for field in CAMPOS_HUELLAS}) != 3
                    or any(row.get(field) != resolution[field] for field in CAMPOS_HUELLAS)
                    or row['decision'] != 'resuelto_' + resolution['elegir']
                    or row.get('elegido_sha256') != resolution[resolution['elegir'] + '_sha256']
                    or row.get('motivo') != resolution['motivo']):
                raise ValueError('Auditoría de resolución distinta del conflicto y elección aprobados')
            used.add(key)
        elif resolution is not None or any(field in row for field in ('decision_previa', 'elegido_sha256', 'motivo')):
            raise ValueError('Una resolución solo puede decidir un conflicto real')
    if used != set(by_key):
        raise ValueError('Resoluciones sobrantes o desconocidas')


def normalizar_nodo(node, metadata):
    if node is AUSENTE:
        return AUSENTE
    result = copy.deepcopy(node)
    for key in ('id', 'position', 'webhookId'):
        result.pop(key, None)
    if entrada_externa(node):
        result.pop('disabled', None)
    # Los IDs de credenciales son operativos; cambiar de cuenta o tipo sí es semántico.
    for tipo, ref in result.get('credentials', {}).items():
        candidates = [c for c in metadata['credenciales'] if c['id'] == ref.get('id') and c['type'] == tipo]
        name = candidates[0]['name'] if len(candidates) == 1 else ref.get('name')
        if not name:
            raise ValueError('Credencial sin identidad comparable; no inferir equivalencias')
        result['credentials'][tipo] = {'name': name}
    if not result.get('credentials'):
        result.pop('credentials', None)
    return result


def elegir_componente(base, integrado, vivo, normalizar, rows, wid, clase, nombre, opaco=False,
                      resoluciones=None, usadas=None):
    normalized = [normalizar(value) for value in (base, integrado, vivo)]
    hashes = [hash_componente(value) for value in normalized]
    if opaco and vivo is not AUSENTE:
        selected, decision = vivo, 'conservar_vivo_opaco'
    elif normalized[1] == normalized[0]:
        selected, decision = vivo, 'conservar_vivo'
    elif normalized[2] == normalized[0]:
        selected, decision = integrado, 'incorporar_integrado'
    elif normalized[1] == normalized[2]:
        selected, decision = vivo, 'coinciden'
    else:
        selected, decision = AUSENTE, 'conflicto'
    row = {'workflow': wid, 'componente': clase, 'nombre': nombre,
           'base_sha256': hashes[0], 'integrado_sha256': hashes[1], 'vivo_sha256': hashes[2],
           'decision': decision}
    key = (wid, clase, nombre)
    resolution = (resoluciones or {}).get(key)
    if resolution is not None:
        if decision != 'conflicto':
            raise ValueError('Una resolución solo puede decidir un conflicto real')
        if any(row[field] != resolution[field] for field in CAMPOS_HUELLAS):
            raise ValueError('Resolución obsoleta: cambiaron las huellas del conflicto')
        selected = vivo if resolution['elegir'] == 'vivo' else integrado
        row.update({'decision': 'resuelto_' + resolution['elegir'], 'decision_previa': 'conflicto',
                    'elegido_sha256': resolution[resolution['elegir'] + '_sha256'], 'motivo': resolution['motivo']})
        usadas.add(key)
    rows.append(row)
    return copy.deepcopy(selected) if selected is not AUSENTE else AUSENTE


def validar_conexiones(workflow):
    names = set(indice_unico(workflow['nodes'], 'name'))
    for source, outputs in workflow['connections'].items():
        if source not in names or not isinstance(outputs, dict):
            return False
        for ports in outputs.values():
            if not isinstance(ports, list):
                return False
            for targets in ports:
                if not isinstance(targets, list) or any(not isinstance(t, dict) or t.get('node') not in names for t in targets):
                    return False
    return True


def conciliar_workflow(base, integrado, vivo, metadata, rows, ajustes=False, resoluciones=None, usadas=None):
    result = copy.deepcopy(integrado)
    wid = integrado['id']
    if base is not None and vivo is None:
        # No se puede distinguir una eliminación operativa de un flujo nunca instalado.
        elegir_componente(base, integrado, AUSENTE, lambda value: value, rows, wid, 'workflow', integrado['name'])
        rows[-1]['decision'] = 'conflicto_workflow_base_ausente'
        return result
    by_name = [indice_unico(w['nodes'], 'name') if w else {} for w in (base, integrado, vivo)]
    result['nodes'] = []
    for name in dict.fromkeys(name for group in by_name for name in group):
        values = [group.get(name, AUSENTE) for group in by_name]
        is_ajustes = ajustes and name == 'Ajustes'
        if is_ajustes:
            # No inspeccionar código/URLs ni reemplazar el nodo de configuración con defaults.
            norm = lambda value: value
        else:
            norm = lambda value: normalizar_nodo(value, metadata)
        selected = elegir_componente(*values, norm, rows, wid, 'nodo', name, opaco=is_ajustes,
                                     resoluciones=resoluciones, usadas=usadas)
        if selected is not AUSENTE:
            result['nodes'].append(selected)
    for field, clase in [('connections', 'conexiones'), ('settings', 'ajuste')]:
        groups = [w.get(field, {}) if w else {} for w in (base, integrado, vivo)]
        result[field] = {}
        for name in dict.fromkeys(name for group in groups for name in group):
            selected = elegir_componente(*(group.get(name, AUSENTE) for group in groups),
                                         lambda value: value, rows, wid, clase, name,
                                         resoluciones=resoluciones, usadas=usadas)
            if selected is not AUSENTE:
                result[field][name] = selected
    if not validar_conexiones(result):
        rows.append({'workflow': wid, 'componente': 'conexiones', 'nombre': integrado['name'],
                     'base_sha256': hash_componente(base.get('connections', {}) if base else AUSENTE),
                     'integrado_sha256': hash_componente(integrado['connections']),
                     'vivo_sha256': hash_componente(vivo.get('connections', {}) if vivo else AUSENTE),
                     'decision': 'conflicto_referencia_a_nodo_ausente'})
    return result


def estado_cas(workflow):
    if not all(k in workflow for k in CAMPOS_CAS) or not workflow.get('versionId'):
        raise ValueError('El export conservador exige contenido y ambas versiones del workflow')
    return {key: workflow[key] for key in CAMPOS_CAS}


def validar_conservacion(workflows, diff):
    if diff.get('politica_disparadores') != POLITICA_DISPARADORES:
        raise ValueError('Política de disparadores desconocida')
    by_id = {w['id']: w for w in workflows}
    rows = diff.get('flujos', [])
    if len(by_id) != len(workflows) or {r['id'] for r in rows} != set(by_id) or len(rows) != len(by_id):
        raise ValueError('Inventario de conservación incompleto')
    if 'conciliacion_tres_vias' in diff:
        comparison = diff['conciliacion_tres_vias']
        allowed = {'conservar_vivo', 'incorporar_integrado', 'coinciden', 'conservar_vivo_opaco',
                   'resuelto_vivo', 'resuelto_integrado'}
        if (not re.fullmatch('[a-f0-9]{64}', comparison.get('base_sha256', ''))
                or not isinstance(comparison.get('componentes'), list)
                or any(row.get('decision') not in allowed for row in comparison['componentes'])):
            raise ValueError('Conciliación incompleta o con conflictos sin resolver')
        validar_resoluciones(comparison)
    for row in rows:
        if digest(by_id[row['id']]['nodes']) != row.get('nodos_despues_sha256'):
            raise ValueError('Nodos distintos del contrato conservado')
        if not row.get('nuevo') and not re.fullmatch('[a-f0-9]{64}', row.get('nodos_antes_sha256', '')):
            raise ValueError('Falta huella de los nodos anteriores')
        if not row.get('nuevo') and not re.fullmatch('[a-f0-9]{64}', row.get('estado_antes_sha256', '')):
            raise ValueError('Falta huella CAS del contenido y las versiones anteriores')
        if 'conciliacion_tres_vias' in diff and digest({key: by_id[row['id']][key] for key in CAMPOS_CONTENIDO}) != row.get('contenido_despues_sha256'):
            raise ValueError('El contenido difiere de la conciliación aprobada')
    by_node = {(w['id'], n['name'], n['type']): n for w in workflows for n in w['nodes']}
    guards = {(r['workflow'], r['nodo']) for r in diff.get('bloqueos_explicitos', [])}
    registrados = set()
    for field in ('disparadores_preservados', 'disparadores_nuevos_bloqueados'):
        for row in diff.get(field, []):
            key = (row['workflow'], row['nodo'], row['tipo'])
            if key in registrados or type(row.get('deshabilitado')) is not bool:
                raise ValueError('Inventario de disparadores ambiguo')
            registrados.add(key)
            node = by_node.get(key)
            if node is None and key[:2] in guards:
                # Una credencial ausente puede sustituir un disparador por un error explícito.
                node = by_node.get((*key[:2], 'n8n-nodes-base.code'))
                if node and (not node.get('parameters', {}).get('jsCode', '').startswith('throw new Error(')
                             or 'onError' in node or node.get('continueOnFail')):
                    node = None
            if node is None or bool(node.get('disabled')) != row['deshabilitado']:
                raise ValueError('Cambió el estado de un disparador conservado')
            if field == 'disparadores_nuevos_bloqueados' and not row['deshabilitado']:
                raise ValueError('Un disparador nuevo debe permanecer bloqueado')
    externos = {key for key, node in by_node.items() if entrada_externa(node)}
    if not externos <= registrados:
        raise ValueError('Disparador externo sin decisión de conservación')
    for row in diff.get('ajustes_preservados', []):
        node = by_node.get((row['workflow'], row['nodo'], row['tipo']))
        if node is None or digest(node['parameters']) != row['parametros_sha256']:
            raise ValueError('Los parámetros de Ajustes deben conservarse opacamente')
    deps = diff.get('dependencias_conservadas', {})
    originales = diff.get('republicar_originales', [])
    if set(deps) != DEPENDENCIAS_SEGURAS or not set(deps.values()) <= set(originales):
        raise ValueError('Conservar disparadores no permite activar dependencias históricas')
    if diff.get('plan_publicacion') != plan_publicacion(workflows, originales, deps.values()):
        raise ValueError('Plan topológico distinto de las publicaciones conservadas')
    return set(originales)


def validar_actual(path, diff, despues=False):
    # Procesa JSON opacamente y solo compara hashes; nunca imprime parámetros ni credenciales.
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        for row in diff['flujos']:
            exacto = despues and 'contenido_despues_sha256' in row
            fields = ','.join(CAMPOS_CONTENIDO if exacto else ('nodes',) if despues else CAMPOS_CAS)
            values = db.execute('SELECT ' + fields + ' FROM workflow_entity WHERE id=?', (row['id'],)).fetchall()
            if not despues and row['nuevo']:
                if values:
                    raise ValueError('Un workflow nuevo apareció después del export')
                continue
            if len(values) != 1:
                raise ValueError('Workflow ausente o ambiguo desde la copia')
            if exacto:
                hash_actual = digest({key: json.loads(value) if value is not None else None
                                      for key, value in zip(CAMPOS_CONTENIDO, values[0])})
            elif despues:
                hash_actual = digest(json.loads(values[0][0]))
            else:
                state = dict(zip(CAMPOS_CAS, values[0]))
                for field in ('nodes', 'connections', 'settings'):
                    state[field] = json.loads(state[field]) if state[field] is not None else None
                state['active'] = bool(state['active'])
                hash_actual = digest(estado_cas(state))
            key = 'contenido_despues_sha256' if exacto else 'nodos_despues_sha256' if despues else 'estado_antes_sha256'
            if hash_actual != row[key]:
                raise ValueError('El contenido o las versiones cambiaron desde la copia o el lote ensayado')


def preparar(actuales, entradas, origen, metadata=None, publicar_dependencias=False, conservar_disparadores=False,
             bases=None, resoluciones=None):
    if origen != 'https://flujos.cooperestudio.com':
        raise ValueError('Origen no autorizado')
    if conservar_disparadores and (metadata is None or not publicar_dependencias):
        raise ValueError('Conservar disparadores exige inventario y plan de publicación')
    if bases is not None and not conservar_disparadores:
        raise ValueError('La comparación de tres vías exige conservar disparadores y CAS')
    if resoluciones is not None and bases is None:
        raise ValueError('Las resoluciones exigen comparación de tres vías con base explícita')
    decisiones = indice_resoluciones(resoluciones) if resoluciones is not None else {}
    usadas = set()
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
    bases_por_id, bases_por_nombre = {}, {}
    comparacion = None
    if bases is not None:
        indice_unico(actuales, 'id')
        indice_unico(entradas, 'id')
        indice_unico(entradas, 'name')
        bases_por_id = indice_unico(bases, 'id')
        bases_por_nombre = indice_unico(bases, 'name')
        if len(set(mapping.values())) != len(mapping):
            raise ValueError('Dos fuentes apuntan al mismo workflow vivo')
        for base in bases:
            matches = [by_id[base['id']]] if base['id'] in by_id else by_name.get(base['name'], [])
            if len(matches) > 1:
                raise ValueError('Nombre de workflow base ambiguo')
            if matches:
                if base['id'] in mapping and mapping[base['id']] != matches[0]['id']:
                    raise ValueError('La identidad base contradice el mapping integrado')
                mapping[base['id']] = matches[0]['id']
        comparacion = {'base_sha256': digest(bases), 'componentes': []}
        if resoluciones is not None:
            comparacion.update({'resoluciones': copy.deepcopy(resoluciones), 'resoluciones_sha256': digest(resoluciones)})
    output, report = [], []
    preservados, nuevos_bloqueados, ajustes = [], [], []
    faltantes, bloqueos, disparadores = [], [], []
    # Los identificadores no son claves. Sustituye únicamente referencias conocidas.
    pattern = re.compile('|'.join(re.escape(k) for k in sorted(mapping, key=len, reverse=True)))
    for nuevo, actual in pairs:
        data = json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(nuevo, ensure_ascii=False)))
        if bases is not None:
            base = bases_por_id.get(nuevo['id'], bases_por_nombre.get(nuevo['name']))
            if base is not None:
                base = json.loads(pattern.sub(lambda m: mapping[m[0]], json.dumps(base, ensure_ascii=False)))
            data = conciliar_workflow(base, data, actual, metadata, comparacion['componentes'],
                                      ajustes=nuevo['id'] == 'FabAjustes000001', resoluciones=decisiones, usadas=usadas)
        data['active'] = False
        data['pinData'] = {}
        if bases is None:
            data['settings']['saveDataSuccessExecution'] = 'none'
            data['settings']['saveDataErrorExecution'] = 'none'
        anteriores = nodos_por_firma(actual['nodes']) if actual and conservar_disparadores else {}
        if conservar_disparadores:
            nodos_por_firma(data['nodes'])
            if nuevo['id'] == 'FabAjustes000001' and not actual:
                raise ValueError('Falta el workflow Ajustes real; no usar defaults')
            for node in data['nodes']:
                if entrada_externa(node):
                    old = anteriores.get((node['name'], node['type']))
                    node['disabled'] = bool(old.get('disabled')) if old else True
                    (preservados if old else nuevos_bloqueados).append({
                        'workflow': data['id'], 'nodo': node['name'], 'tipo': node['type'],
                        'deshabilitado': node['disabled']})
        if actual:
            previous_nodes = {n['name']: n for n in actual['nodes']}
            for node in data['nodes']:
                old = anteriores.get((node['name'], node['type'])) if conservar_disparadores else previous_nodes.get(node['name'])
                if old and node['type'] == old['type']:
                    node['id'] = old['id']
                    if bases is not None and 'position' in old:
                        node['position'] = copy.deepcopy(old['position'])
                    if old.get('credentials'):
                        node['credentials'] = copy.deepcopy(old['credentials'])
                    if 'webhookId' in old:
                        node['webhookId'] = old['webhookId']
                if nuevo['id'] == 'FabAjustes000001' and node['name'] == 'Ajustes':
                    if not old:
                        raise ValueError('Falta nodo Ajustes real; no usar defaults')
                    node['parameters'] = copy.deepcopy(old['parameters'])
                    if conservar_disparadores:
                        ajustes.append({'workflow': data['id'], 'nodo': node['name'], 'tipo': node['type'],
                                        'parametros_sha256': digest(node['parameters'])})
                    else:
                        js = node['parameters']['jsCode']
                        # Solo dominios de referencia; conserva todo otro ajuste/identificador.
                        js = re.sub(r'https://[a-z0-9-]+\.ngrok-free\.dev', origen, js)
                        node['parameters']['jsCode'] = js
        output.append(data)
        report.append({'id': data['id'], 'nombre': data['name'], 'nuevo': actual is None,
                       'antes_sha256': digest(actual) if actual else None, 'despues_sha256': digest(data),
                       'publicado_antes': bool(actual and actual['active']), 'publicado_entrada': False,
                       'nodos_antes': len(actual['nodes']) if actual else 0, 'nodos_despues': len(data['nodes'])})
        if conservar_disparadores:
            report[-1]['nodos_antes_sha256'] = digest(actual['nodes']) if actual else None
            report[-1]['estado_antes_sha256'] = digest(estado_cas(actual)) if actual else None
    if usadas != set(decisiones):
        raise ValueError('Resoluciones sobrantes o desconocidas')
    if comparacion and any(row['decision'].startswith('conflicto') for row in comparacion['componentes']):
        raise ConflictoConciliacion(comparacion)
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
                    if not conservar_disparadores and w['id'] in DEPENDENCIAS_SEGURAS and n['type'] in ('n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.webhook'):
                        n['disabled'] = True
                        disparadores.append({'workflow': w['id'], 'nodo': n['name'], 'tipo': n['type']})
        for w, r in zip(output, report):
            r['despues_sha256'] = digest(w)
    originales = [r['id'] for r in report if r['publicado_antes']]
    resultado = {'mapa_ids': mapping, 'flujos': report, 'credenciales_faltantes': faltantes,
                 'republicar_originales': originales, 'bloqueos_explicitos': bloqueos,
                 'disparadores_dependencias_pausados': disparadores}
    if comparacion is not None:
        resultado['conciliacion_tres_vias'] = comparacion
    if publicar_dependencias:
        if metadata is None:
            raise ValueError('Publicar dependencias exige inventario de referencias')
        if conservar_disparadores:
            deps = {wid: mapping.get(wid, wid) for wid in DEPENDENCIAS_SEGURAS}
            if not all(by_id.get(wid, {}).get('active') is True for wid in deps.values()):
                raise ValueError('Las dependencias deben estar ya activas; no reabrir flujos históricos')
            resultado.update({'politica_disparadores': POLITICA_DISPARADORES,
                              'disparadores_preservados': preservados,
                              'disparadores_nuevos_bloqueados': nuevos_bloqueados,
                              'ajustes_preservados': ajustes, 'dependencias_conservadas': deps})
            for w, row in zip(output, report):
                row['nodos_despues_sha256'] = digest(w['nodes'])
                if comparacion is not None:
                    row['contenido_despues_sha256'] = digest({key: w[key] for key in CAMPOS_CONTENIDO})
            resultado['plan_publicacion'] = plan_publicacion(output, originales, deps.values())
            validar_conservacion(output, resultado)
        else:
            resultado['plan_publicacion'] = plan_publicacion(output, originales)
    return output, resultado


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', dest='export', type=Path, required=True)
    parser.add_argument('--entrada', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    parser.add_argument('--metadata', type=Path)
    parser.add_argument('--base', type=Path, help='Directorio JSON de la base Git común; exige modo conservador')
    parser.add_argument('--resoluciones', type=Path,
                        help='Lista de conflictos revisados con tres hashes exactos, elección y motivo; exige --base')
    parser.add_argument('--publicar-dependencias-seguras', action='store_true')
    parser.add_argument('--conservar-disparadores', action='store_true',
                        help='Conserva las entradas existentes y bloquea entradas nuevas; no reactiva workflows')
    args = parser.parse_args()
    args.salida.mkdir(mode=0o700, parents=True, exist_ok=False)
    actuales = json.loads(args.export.read_text())
    entradas = [json.loads(p.read_text()) for p in sorted(args.entrada.glob('*.json'))]
    metadata = json.loads(args.metadata.read_text()) if args.metadata else None
    bases = [json.loads(p.read_text()) for p in sorted(args.base.glob('*.json'))] if args.base else None
    resoluciones = json.loads(args.resoluciones.read_text()) if args.resoluciones else None
    if args.base and not bases:
        raise ValueError('La base debe ser un directorio con workflows JSON')
    try:
        salida, diff = preparar(actuales, entradas, 'https://flujos.cooperestudio.com', metadata,
                               args.publicar_dependencias_seguras, args.conservar_disparadores, bases, resoluciones)
    except ConflictoConciliacion as exc:
        target = args.salida / 'conflictos.json'
        target.write_text(json.dumps(exc.comparacion, ensure_ascii=False, indent=2) + '\n')
        target.chmod(0o600)
        print(json.dumps({'estado': 'BLOQUEADO', 'comparacion': str(target)}))
        sys.exit(1)
    for name, data in [('entrada.json', salida), ('diff.json', diff)]:
        target = args.salida / name
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        target.chmod(0o600)
    print(json.dumps({'preparados': len(salida), 'inactivos': True, 'diff': str(args.salida / 'diff.json')}))


if __name__ == '__main__':
    main()
