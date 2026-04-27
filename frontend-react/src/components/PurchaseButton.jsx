import React, { useEffect, useState } from 'react';
import { comprarIngressos, cancelarCompra } from '../services/api';
import '../styles/PurchaseButton.css';

/**
 * Componente PurchaseButton
 * 
 * Exibe um botão para comprar ingressos
 * Gerencia estados de carregamento, erro e sucesso
 * Trata falhas de requisição com mensagens apropriadas
 */
const PurchaseButton = ({
  eventId,
  eventName,
  quantity = 1,
  maxQuantity = 5,
  isFinalized = false,
  isSoldOut = false,
  onPurchaseSuccess = () => {},
  onStockUnavailable = () => {},
}) => {
  const maxAllowedQuantity = Math.max(0, Math.min(10, Number(maxQuantity) || 0));
  const isBlocked = isFinalized || isSoldOut;
  const [selectedQuantity, setSelectedQuantity] = useState(
    Math.min(Math.max(quantity, 1), Math.max(1, maxAllowedQuantity))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null);
  const [success, setSuccess] = useState(false);
  const [purchaseData, setPurchaseData] = useState(null);

  useEffect(() => {
    if (selectedQuantity > maxAllowedQuantity) {
      setSelectedQuantity(maxAllowedQuantity);
    }
  }, [selectedQuantity, maxAllowedQuantity]);

  /**
   * Dados de pagamento simulados
   * Em produção, isso viria de um formulário seguro
   */
  const mockPaymentData = {
    metodo: 'cartao_credito',
    numero_cartao: '4111111111111111',
    validade: '12/25',
    cvv: '123',
  };

  /**
   * Handler para o clique no botão de compra
   * 
   * Fluxo:
   * 1. Habilita estado de carregamento
   * 2. Limpa erros e sucessos anteriores
   * 3. Faz a requisição de compra
   * 4. Trata sucesso ou erro
   */
  const handleCompra = async () => {
    if (isSoldOut) {
      setError(null);
      return;
    }

    if (isFinalized) {
      setError('Este show já foi finalizado e não aceita novas compras.');
      return;
    }

    // Reset estados anteriores
    setError(null);
    setCancelMessage(null);
    setSuccess(false);
    setIsLoading(true);

    if (selectedQuantity > maxAllowedQuantity) {
      setError(`Quantidade máxima disponível para este evento: ${maxAllowedQuantity}`);
      setIsLoading(false);
      return;
    }

    try {
      // Chamar API de compra
      const response = await comprarIngressos(
        eventId,
        selectedQuantity,
        mockPaymentData
      );

      if (response.success) {
        setSuccess(true);
        setPurchaseData(response.data.data);
        onPurchaseSuccess(
          eventId,
          Number(response.data?.data?.quantity ?? selectedQuantity)
        );
      } else {
        // Erro na compra
        setError(response.error);
        
        // Diferenciar mensagens por tipo de erro
        if (response.statusCode === 503) {
          setError('Serviço temporariamente indisponível. Tente novamente em alguns momentos.');
        } else if (response.statusCode === 402) {
          setError('Pagamento recusado. Verifique suas informações bancárias.');
        } else if (response.statusCode === 409) {
          onStockUnavailable(eventId);
          setError(null);
        }
      }
    } catch (err) {
      setError('Erro inesperado ao processar sua compra. Tente novamente.');
      console.error('Erro na compra:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handler para cancelar uma compra já concluída
   */
  const handleCancelar = async () => {
    if (!purchaseData?.venda_id) {
      return;
    }

    setError(null);
    setIsCancelling(true);

    try {
      const response = await cancelarCompra(purchaseData.venda_id);

      if (response.success) {
        setSuccess(false);
        setPurchaseData(null);
        setCancelMessage('Compra cancelada com sucesso!');

        setTimeout(() => {
          setCancelMessage(null);
        }, 5000);
      } else {
        setError(response.error || 'Não foi possível cancelar a compra.');
      }
    } catch (err) {
      setError('Erro inesperado ao cancelar a compra.');
      console.error('Erro no cancelamento:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="purchase-button-container">
      <div className="purchase-info">
        <h3>{eventName}</h3>
        {isSoldOut && (
          <div className="locked-message soldout">
            <p>Ingressos esgotados para este evento.</p>
          </div>
        )}
        {isFinalized && (
          <div className="locked-message">
            <p>Este show já foi finalizado. A compra está bloqueada.</p>
          </div>
        )}
        {!isBlocked && (
          <div className="quantity-control">
            <label htmlFor={`quantity-${eventId}`}>Quantidade</label>
            <select
              id={`quantity-${eventId}`}
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(Number(e.target.value))}
              disabled={isLoading || isCancelling || success || isBlocked}
            >
              {Array.from({ length: maxAllowedQuantity }, (_, index) => index + 1).map((qty) => (
                <option key={qty} value={qty}>
                  {qty} {qty === 1 ? 'ingresso' : 'ingressos'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Estado de Carregamento */}
      {isLoading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Processando sua compra...</p>
        </div>
      )}

      {/* Mensagem de Erro */}
      {error && !isLoading && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="error-dismiss"
          >
            Descartar
          </button>
        </div>
      )}

      {/* Mensagem de Sucesso */}
      {success && purchaseData && !isLoading && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          <div>
            <p>Compra realizada com sucesso!</p>
            <p className="purchase-details">
              Total pago: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(purchaseData.total_price) || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Mensagem de Cancelamento */}
      {cancelMessage && !isLoading && !isCancelling && (
        <div className="cancel-message">
          <span className="cancel-icon">↩</span>
          <p>{cancelMessage}</p>
        </div>
      )}

      {/* Botão de Compra */}
      {!isLoading && !success && (
        <button
          onClick={handleCompra}
          className="purchase-button"
          disabled={isLoading || isBlocked}
        >
          {isLoading ? 'Processando...' : isSoldOut ? 'Ingressos esgotados' : isFinalized ? 'Show finalizado' : 'Comprar Ingresso'}
        </button>
      )}

      {/* Botão de Cancelar após compra concluída */}
      {success && purchaseData && !isLoading && (
        <button
          onClick={handleCancelar}
          className="purchase-button cancel-button"
          disabled={isCancelling}
        >
          {isCancelling ? 'Cancelando...' : 'Cancelar Compra'}
        </button>
      )}

      {/* Botão para tentar novamente após erro */}
      {error && !isLoading && !isBlocked && (
        <button
          onClick={handleCompra}
          className="purchase-button retry-button"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  );
};

export default PurchaseButton;
