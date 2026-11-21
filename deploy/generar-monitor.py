#!/usr/bin/env python3
"""Exporta el aviso interno inactivo; solo referencia la credencial Telegram existente."""
import argparse
import json
from pathlib import Path
import uuid

ROOT = Path(__file__).resolve().parent


def workflow(credential_id, credential_name, chat_id):
    def node(name, kind, version, parameters, x, **extra):
        return {'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'cooper-monitor/' + name)), 'name': name, 'type': 'n8n-nodes-base.' + kind, 'typeVersion': version, 'position': [x, 0], 'parameters': parameters, **extra}
    def edge(name):
        return {'node': name, 'type': 'main', 'index': 0}
    return {
        'id': 'CooperMonitor01', 'name': 'FX · Monitor de infraestructura', 'active': False,
        'nodes': [
            node('Aviso interno', 'webhook', 2, {'httpMethod': 'POST', 'path': 'cooper/v1/monitor', 'responseMode': 'responseNode', 'options': {}}, 0, webhookId='cooper-monitor-v1'),
            node('Validar aviso', 'code', 2, {'jsCode': (ROOT / 'monitor-validar.js').read_text()}, 220),
            node('¿Enviar?', 'if', 2.2, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'strict', 'version': 2}, 'conditions': [{'id': 'enviar', 'leftValue': '={{ $json.enviar }}', 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'options': {}}, 440),
            node('Avisar por Telegram', 'telegram', 1.2, {'resource': 'message', 'operation': 'sendMessage', 'chatId': chat_id, 'text': '={{ $json.texto }}', 'additionalFields': {'appendAttribution': False, 'disable_web_page_preview': True}}, 660, credentials={'telegramApi': {'id': credential_id, 'name': credential_name}}),
            node('Confirmar', 'respondToWebhook', 1.4, {'respondWith': 'json', 'responseBody': "={{ { ok: $('Validar aviso').first().json.ok, prueba: $('Validar aviso').first().json.prueba === true } }}", 'options': {'responseCode': "={{ $('Validar aviso').first().json.codigo }}"}}, 880),
        ],
        'connections': {'Aviso interno': {'main': [[edge('Validar aviso')]]}, 'Validar aviso': {'main': [[edge('¿Enviar?')]]}, '¿Enviar?': {'main': [[edge('Avisar por Telegram')], [edge('Confirmar')]]}, 'Avisar por Telegram': {'main': [[edge('Confirmar')]]}},
        'settings': {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False, 'callerPolicy': 'workflowsFromSameOwner'},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--credencial-id', required=True)
    parser.add_argument('--credencial-nombre', required=True)
    parser.add_argument('--chat-id', required=True)
    parser.add_argument('--salida', required=True, type=Path)
    args = parser.parse_args()
    args.salida.write_text(json.dumps(workflow(args.credencial_id, args.credencial_nombre, args.chat_id), ensure_ascii=False, indent=2) + '\n')
    print('PASS: workflow inactivo generado; ninguna credencial exportada')
