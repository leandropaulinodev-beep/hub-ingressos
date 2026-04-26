"""
Serviço de Catálogo - Backend em Python
Responsável por gerenciar eventos e controlar estoque de ingressos
"""

from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import uuid
import threading
import requests
from models import Catalogo, Evento, Reserva

app = Flask(__name__)

# Simulando um banco de dados em memória (para o teste)
catalogo = Catalogo()


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

# Inicializar alguns eventos de exemplo caso a sincronização falhe
if not sincronizar_eventos_do_banco():
    catalogo.adicionar_evento(
        evento_id=7,
        nome="Show da Banda X",
        preco=100.00,
        estoque=50
    )

    catalogo.adicionar_evento(
        evento_id=8,
        nome="Festival de Música 2026",
        preco=200.00,
        estoque=100
    )

    catalogo.adicionar_evento(
        evento_id=9,
        nome="Teatro - Peça Y",
        preco=80.00,
        estoque=200
    )


@app.route('/health', methods=['GET'])
def health_check():
    """Verifica se o serviço está disponível"""
    return jsonify({
        'status': 'online',
        'service': 'Catalogo Service',
        'timestamp': datetime.now().isoformat()
    }), 200


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
    
    Payload esperado:
    {
        "event_id": 1,
        "quantity": 2
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
        data = request.get_json()
        
        # Validação
        if not data or 'event_id' not in data or 'quantity' not in data:
            return jsonify({
                'success': False,
                'error': 'event_id e quantity são obrigatórios'
            }), 400
        
        event_id = data['event_id']
        quantity = data['quantity']
        
        # Validar tipos
        if not isinstance(event_id, int) or not isinstance(quantity, int):
            return jsonify({
                'success': False,
                'error': 'event_id e quantity devem ser inteiros'
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
