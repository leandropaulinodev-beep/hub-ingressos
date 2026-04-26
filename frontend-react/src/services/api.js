import axios from 'axios';

/**
 * API Service para comunicação com o backend
 */

const API_BASE_URL = 'http://localhost/hub-ingressos/backend-php';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Processa a compra de ingressos
 * 
 * @param {number} eventId - ID do evento
 * @param {number} quantity - Quantidade de ingressos
 * @param {object} paymentData - Dados de pagamento
 * @returns {Promise} Resposta da API
 */
export const comprarIngressos = async (eventId, quantity, paymentData) => {
  try {
    const response = await apiClient.post('/api.php?route=compras', {
      event_id: eventId,
      quantity: quantity,
      payment_data: paymentData,
    });

    return {
      success: true,
      data: response.data,
      statusCode: response.status,
    };
  } catch (error) {
    // Tratamento de erros específicos
    if (error.response) {
      // Erro da API
      return {
        success: false,
        error: error.response.data?.error || 'Erro ao processar compra',
        statusCode: error.response.status,
      };
    } else if (error.request) {
      // Requisição feita mas sem resposta
      return {
        success: false,
        error: 'Servidor indisponível. Tente novamente mais tarde.',
        statusCode: 503,
      };
    } else {
      // Erro na configuração da requisição
      return {
        success: false,
        error: 'Erro ao processar requisição',
        statusCode: 500,
      };
    }
  }
};

/**
 * Cancela uma compra existente
 *
 * @param {number} vendaId - ID da venda
 * @returns {Promise} Resposta da API
 */
export const cancelarCompra = async (vendaId) => {
  try {
    const response = await apiClient.post('/api.php?route=cancelar', {
      venda_id: vendaId,
    });

    return {
      success: true,
      data: response.data,
      statusCode: response.status,
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || 'Erro ao cancelar compra',
        statusCode: error.response.status,
      };
    } else if (error.request) {
      return {
        success: false,
        error: 'Servidor indisponível. Tente novamente mais tarde.',
        statusCode: 503,
      };
    }

    return {
      success: false,
      error: 'Erro ao processar requisição de cancelamento',
      statusCode: 500,
    };
  }
};

/**
 * Obtém lista de eventos disponíveis
 */
export const listarEventos = async () => {
  try {
    const response = await apiClient.get('/api/eventos');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Busca os eventos mais recentes cadastrados no banco
 *
 * @param {number} limit - quantidade máxima de eventos
 * @returns {Promise} Resposta da API
 */
export const listarNovosEventos = async (limit = 10) => {
  try {
    const response = await apiClient.get(`/api.php?route=eventos-novos&limit=${limit}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || 'Erro ao buscar novos eventos',
      };
    }

    return {
      success: false,
      error: 'Servidor indisponível. Não foi possível carregar novos eventos.',
    };
  }
};

export default apiClient;
