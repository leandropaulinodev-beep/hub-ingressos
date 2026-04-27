"""
Serviço de Catálogo - Backend em Python
Responsável por gerenciar eventos e controlar estoque de ingressos
"""

from flask import Flask, request, jsonify
from datetime import datetime
from pathlib import Path
import os
import requests
from models import Catalogo

app = Flask(__name__)

SERVICE_TOKEN_HEADER = 'X-Internal-Service-Token'


def load_root_env():
    env_path = Path(__file__).resolve().parents[1] / '.env'
    env_data = {}

    if not env_path.exists():
        return env_data

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        env_data[key.strip()] = value.strip().strip('"\'')

    return env_data


ENV_DATA = load_root_env()
INTERNAL_SERVICE_TOKEN = os.getenv('INTERNAL_SERVICE_TOKEN', ENV_DATA.get('INTERNAL_SERVICE_TOKEN', '')).strip()

# Simulando um banco de dados em memória (para o teste)
catalogo = Catalogo()


def require_internal_service_auth():
    if not INTERNAL_SERVICE_TOKEN:
        return jsonify({
            'success': False,
            'error': 'Token interno não configurado'
        }), 500

    received_token = request.headers.get(SERVICE_TOKEN_HEADER, '').strip()
    if received_token != INTERNAL_SERVICE_TOKEN:
        return jsonify({
            'success': False,
            'error': 'Acesso interno não autorizado'
        }), 401

    return None


def sincronizar_eventos_do_banco():
    """Carrega eventos do banco via API PHP para o catálogo em memória."""
    try:
        response = requests.get(
            'http://localhost/hub-ingressos/backend-php/api.php?route=catalogo-eventos',
            timeout=5
        )
        response.raise_for_status()
        payload = response.json()

        eventos = payload.get('data', {}).get('eventos', [])
        if not eventos:
            return False

        catalogo.eventos = {}
        catalogo.reservas = {}

        for evento in eventos:
            catalogo.adicionar_evento(
                evento_id=int(evento['event_id']),
                nome=evento['nome'],
                preco=float(evento['preco']),
                estoque=int(evento['estoque_disponivel'])
            )

        return True
    except Exception as e:
        print(f'Falha ao sincronizar eventos do banco: {e}')
        return False

@app.route('/api/v1/catalogo/eventos', methods=['GET'])
def listar_eventos():
    """
    Lista todos os eventos disponíveis
    """
    try:
        eventos = catalogo.listar_eventos()
        
        return jsonify({
            'success': True,
            'data': eventos,
            'total': len(eventos)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/v1/catalogo/eventos/<int:event_id>', methods=['GET'])
def obter_evento(event_id):
    """
    Obtém detalhes de um evento específico
    """
    try:
        evento = catalogo.obter_evento(event_id)
        
        if not evento:
            return jsonify({
                'success': False,
                'error': f'Evento {event_id} não encontrado'
            }), 404
        
        return jsonify({
            'success': True,
            'data': evento
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/v1/catalogo/reservar', methods=['POST'])
def reservar_ingresso():
    """
    Reserva uma quantidade de ingressos para um evento
    
    Payload esperado (aceita ambos formatos):
    {
        "event_id": 1,
        "quantity": 2
    }
    ou
    {
        "id_evento": 1,
        "quantidade": 2
    }
    
    Resposta de sucesso:
    {
        "success": true,
        "data": {
            "reserva_id": "RES-xxxxx",
            "event_id": 1,
            "quantity": 2,
            "preco_unitario": 100.00,
            "expires_at": "2026-04-26T15:30:00"
        }
    }
    """
    try:
        unauthorized_response = require_internal_service_auth()
        if unauthorized_response is not None:
            return unauthorized_response

        data = request.get_json()
    
        if not data:
            return jsonify({
                'success': False,
                'error': 'event_id/id_evento e quantity/quantidade são obrigatórios'
            }), 400

        event_id = data.get('event_id', data.get('id_evento'))
        quantity = data.get('quantity', data.get('quantidade'))

        if event_id is None or quantity is None:
            return jsonify({
                'success': False,
                'error': 'event_id/id_evento e quantity/quantidade são obrigatórios'
            }), 400
        
        # Validar tipos
        if not isinstance(event_id, int) or not isinstance(quantity, int):
            return jsonify({
                'success': False,
                'error': 'event_id/id_evento e quantity/quantidade devem ser inteiros'
            }), 400
        
        # Tentar reservar; se o evento ainda não existir no catálogo, sincroniza e tenta novamente
        try:
            reserva = catalogo.reservar_ingressos(event_id, quantity)
        except ValueError:
            sincronizar_eventos_do_banco()
            reserva = catalogo.reservar_ingressos(event_id, quantity)
        
        if not reserva:
            return jsonify({
                'success': False,
                'error': f'Estoque insuficiente para o evento {event_id}'
            }), 409
        
        return jsonify({
            'success': True,
            'data': {
                'reserva_id': reserva.reserva_id,
                'event_id': reserva.event_id,
                'quantity': reserva.quantity,
                'preco_unitario': reserva.preco_unitario,
                'expires_at': reserva.expires_at.isoformat()
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': f'Erro de validação: {str(e)}'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Erro ao processar reserva: {str(e)}'
        }), 500


@app.route('/api/v1/catalogo/reservas/<reserva_id>/liberar', methods=['PUT'])
def liberar_reserva(reserva_id):
    """
    Libera uma reserva (por exemplo, se o pagamento falhar)
    """
    try:
        unauthorized_response = require_internal_service_auth()
        if unauthorized_response is not None:
            return unauthorized_response

        sucesso = catalogo.liberar_reserva(reserva_id)
        
        if not sucesso:
            return jsonify({
                'success': False,
                'error': f'Reserva {reserva_id} não encontrada'
            }), 404
        
        return jsonify({
            'success': True,
            'message': f'Reserva {reserva_id} liberada com sucesso'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/v1/catalogo/reservas/<reserva_id>/confirmar', methods=['PUT'])
def confirmar_reserva(reserva_id):
    """
    Confirma uma reserva após o pagamento bem-sucedido
    """
    try:
        unauthorized_response = require_internal_service_auth()
        if unauthorized_response is not None:
            return unauthorized_response

        sucesso = catalogo.confirmar_reserva(reserva_id)
        
        if not sucesso:
            return jsonify({
                'success': False,
                'error': f'Reserva {reserva_id} não encontrada ou expirada'
            }), 404
        
        return jsonify({
            'success': True,
            'message': f'Reserva {reserva_id} confirmada com sucesso'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/v1/catalogo/estoque/<int:event_id>', methods=['GET'])
def obter_estoque(event_id):
    """
    Obtém informações de estoque de um evento
    """
    try:
        evento = catalogo.obter_evento(event_id)
        
        if not evento:
            return jsonify({
                'success': False,
                'error': f'Evento {event_id} não encontrado'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'event_id': event_id,
                'estoque_disponivel': evento['estoque_disponivel'],
                'estoque_total': evento['estoque_total'],
                'estoque_reservado': evento['estoque_reservado'],
                'percentual_disponivel': (evento['estoque_disponivel'] / evento['estoque_total'] * 100) if evento['estoque_total'] > 0 else 0
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Tratamento de rota não encontrada"""
    return jsonify({
        'success': False,
        'error': 'Rota não encontrada'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Tratamento de erro interno"""
    return jsonify({
        'success': False,
        'error': 'Erro interno do servidor'
    }), 500


if __name__ == '__main__':
    print("Iniciando Serviço de Catálogo na porta 5000...")
    app.run(host='127.0.0.1', port=5000, debug=True)
