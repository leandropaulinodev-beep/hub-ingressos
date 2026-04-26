"""
Modelos para o Serviço de Catálogo
"""

from datetime import datetime, timedelta
import uuid
from threading import Lock


class Evento:
    """Representa um evento no sistema"""
    
    def __init__(self, evento_id, nome, preco, estoque):
        self.evento_id = evento_id
        self.nome = nome
        self.preco = preco
        self.estoque_total = estoque
        self.estoque_disponivel = estoque
        self.estoque_reservado = 0
        self.criado_em = datetime.now()
    
    def to_dict(self):
        return {
            'evento_id': self.evento_id,
            'nome': self.nome,
            'preco': self.preco,
            'estoque_total': self.estoque_total,
            'estoque_disponivel': self.estoque_disponivel,
            'estoque_reservado': self.estoque_reservado,
            'criado_em': self.criado_em.isoformat()
        }


class Reserva:
    """Representa uma reserva temporária de ingressos"""
    
    def __init__(self, event_id, quantity, preco_unitario, duracao_minutos=10):
        self.reserva_id = f"RES-{uuid.uuid4().hex[:8].upper()}"
        self.event_id = event_id
        self.quantity = quantity
        self.preco_unitario = preco_unitario
        self.criado_em = datetime.now()
        self.expires_at = self.criado_em + timedelta(minutes=duracao_minutos)
        self.confirmada = False
    
    def esta_expirada(self):
        return datetime.now() > self.expires_at
    
    def to_dict(self):
        return {
            'reserva_id': self.reserva_id,
            'event_id': self.event_id,
            'quantity': self.quantity,
            'preco_unitario': self.preco_unitario,
            'confirmada': self.confirmada,
            'criado_em': self.criado_em.isoformat(),
            'expires_at': self.expires_at.isoformat()
        }


class Catalogo:
    """Gerencia eventos, estoque e reservas"""
    
    def __init__(self):
        self.eventos = {}  # event_id -> Evento
        self.reservas = {}  # reserva_id -> Reserva
        self.lock = Lock()  # Para garantir thread-safety
    
    def adicionar_evento(self, evento_id, nome, preco, estoque):
        """Adiciona um novo evento ao catálogo"""
        with self.lock:
            self.eventos[evento_id] = Evento(evento_id, nome, preco, estoque)
    
    def listar_eventos(self):
        """Lista todos os eventos"""
        with self.lock:
            return [evento.to_dict() for evento in self.eventos.values()]
    
    def obter_evento(self, evento_id):
        """Obtém um evento específico"""
        with self.lock:
            evento = self.eventos.get(evento_id)
            return evento.to_dict() if evento else None
    
    def reservar_ingressos(self, event_id, quantity):
        """
        Reserva uma quantidade de ingressos para um evento
        
        Segurança:
        - Usa Lock para evitar race conditions
        - Verifica estoque disponível
        - Cria reserva temporária
        
        Retorna Reserva se bem-sucedida, None se estoque insuficiente
        """
        with self.lock:
            evento = self.eventos.get(event_id)
            
            if not evento:
                raise ValueError(f'Evento {event_id} não encontrado')
            
            # Verificar estoque
            if evento.estoque_disponivel < quantity:
                return None
            
            # Criar reserva
            reserva = Reserva(event_id, quantity, evento.preco)
            
            # Deduzir do estoque disponível (reservar)
            evento.estoque_disponivel -= quantity
            evento.estoque_reservado += quantity
            
            # Armazenar reserva
            self.reservas[reserva.reserva_id] = reserva
            
            return reserva
    
    def confirmar_reserva(self, reserva_id):
        """
        Confirma uma reserva após pagamento bem-sucedido
        Reduz permanentemente o estoque total
        """
        with self.lock:
            reserva = self.reservas.get(reserva_id)
            
            if not reserva:
                return False
            
            if reserva.esta_expirada():
                # Liberar automaticamente se expirada
                self.liberar_reserva_interno(reserva)
                return False
            
            # Marcar como confirmada
            reserva.confirmada = True
            
            # Reduzir estoque total (venda confirmada)
            evento = self.eventos.get(reserva.event_id)
            if evento:
                evento.estoque_total -= reserva.quantity
                evento.estoque_reservado -= reserva.quantity
            
            return True
    
    def liberar_reserva(self, reserva_id):
        """
        Libera uma reserva (por exemplo, pagamento falhou)
        Devolve ingressos ao estoque disponível
        """
        with self.lock:
            reserva = self.reservas.get(reserva_id)
            if not reserva:
                return False
            
            return self.liberar_reserva_interno(reserva)
    
    def liberar_reserva_interno(self, reserva):
        """Método interno para liberar reserva (já dentro do lock)"""
        evento = self.eventos.get(reserva.event_id)
        if evento:
            evento.estoque_disponivel += reserva.quantity
            evento.estoque_reservado -= reserva.quantity
        
        del self.reservas[reserva.reserva_id]
        return True
    
    def limpar_reservas_expiradas(self):
        """Remove reservas expiradas e devolve estoque"""
        with self.lock:
            expiradas = [
                rid for rid, res in self.reservas.items()
                if res.esta_expirada()
            ]
            
            for rid in expiradas:
                self.liberar_reserva_interno(self.reservas[rid])
            
            return len(expiradas)
