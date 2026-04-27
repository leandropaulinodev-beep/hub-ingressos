<?php
declare(strict_types=1);

namespace HubIngressos\Application;

use HubIngressos\Contracts\CatalogGatewayInterface;
use HubIngressos\Contracts\DatabaseConnectionInterface;
use HubIngressos\Contracts\EventoRepositoryInterface;
use HubIngressos\Contracts\PaymentProcessorInterface;
use HubIngressos\Contracts\VendaRepositoryInterface;

class VendaService
{
    private DatabaseConnectionInterface $db;
    private CatalogGatewayInterface $catalogGateway;
    private PaymentProcessorInterface $paymentProcessor;
    private VendaRepositoryInterface $vendaRepository;
    private EventoRepositoryInterface $eventoRepository;

    public function __construct(
        DatabaseConnectionInterface $db,
        CatalogGatewayInterface $catalogGateway,
        PaymentProcessorInterface $paymentProcessor,
        VendaRepositoryInterface $vendaRepository,
        EventoRepositoryInterface $eventoRepository
    ) {
        $this->db = $db;
        $this->catalogGateway = $catalogGateway;
        $this->paymentProcessor = $paymentProcessor;
        $this->vendaRepository = $vendaRepository;
        $this->eventoRepository = $eventoRepository;
    }

    public function processarCompra($eventId, $quantity, $paymentData): array
    {
        $transactionStarted = false;

        try {
            if (!is_numeric($eventId) || (int) $eventId <= 0) {
                return $this->errorResponse('ID do evento inválido', 400);
            }

            if (!is_numeric($quantity) || (int) $quantity <= 0) {
                return $this->errorResponse('Quantidade deve ser maior que zero', 400);
            }

            $eventId = (int) $eventId;
            $quantity = (int) $quantity;

            $evento = $this->eventoRepository->buscarEventoPorId($eventId);
            if (!$evento) {
                return $this->errorResponse('Evento não encontrado', 404);
            }

            $estoqueDisponivel = (int) ($evento['estoque_disponivel'] ?? 0);
            if ($estoqueDisponivel <= 0) {
                return $this->errorResponse('Ingressos esgotados para este evento', 409);
            }

            if ($quantity > $estoqueDisponivel) {
                return $this->errorResponse(
                    "Estoque insuficiente. Disponível: {$estoqueDisponivel} ingresso(s)",
                    409
                );
            }

            $dataEvento = new \DateTimeImmutable((string) $evento['data_evento']);
            $agora = new \DateTimeImmutable();
            if ($dataEvento < $agora) {
                return $this->errorResponse('Este show já foi finalizado e não aceita novas compras', 409);
            }

            $this->db->beginTransaction();
            $transactionStarted = true;

            $reservaResponse = $this->catalogGateway->reservarIngresso($eventId, $quantity);
            if (!$reservaResponse['success']) {
                $this->db->rollback();
                return $reservaResponse;
            }

            $reservaId = $reservaResponse['data']['reserva_id'];
            $precoUnitario = (float) $reservaResponse['data']['preco_unitario'];
            $precoTotal = $precoUnitario * $quantity;

            $pagamentoResponse = $this->paymentProcessor->process((array) $paymentData, $precoTotal);
            if (!$pagamentoResponse['success']) {
                $this->catalogGateway->liberarReserva($reservaId);
                $this->db->rollback();
                return $pagamentoResponse;
            }

            $transacaoId = $pagamentoResponse['data']['transacao_id'];

            $vendaId = $this->vendaRepository->salvarVenda([
                'event_id' => $eventId,
                'quantity' => $quantity,
                'unit_price' => $precoUnitario,
                'total_price' => $precoTotal,
                'payment_transaction_id' => $transacaoId,
                'catalog_reservation_id' => $reservaId,
                'status' => 'CONFIRMADA',
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            if (!$this->catalogGateway->confirmarReserva($reservaId)) {
                $this->db->rollback();
                return $this->errorResponse('Não foi possível confirmar a reserva no catálogo', 503);
            }

            $this->db->commit();

            return $this->successResponse([
                'venda_id' => $vendaId,
                'event_id' => $eventId,
                'quantity' => $quantity,
                'total_price' => $precoTotal,
                'status' => 'CONFIRMADA',
                'message' => 'Compra realizada com sucesso!',
            ], 201);
        } catch (\Exception $e) {
            if ($transactionStarted) {
                $this->db->rollback();
            }

            return $this->errorResponse('Erro ao processar compra: ' . $e->getMessage(), 500);
        }
    }

    public function cancelarCompra($vendaId): array
    {
        $transactionStarted = false;

        try {
            if (!is_numeric($vendaId) || (int) $vendaId <= 0) {
                return $this->errorResponse('ID da venda inválido', 400);
            }

            $vendaId = (int) $vendaId;

            $this->db->beginTransaction();
            $transactionStarted = true;

            $venda = $this->vendaRepository->buscarVendaPorId($vendaId);
            if (!$venda) {
                $this->db->rollback();
                return $this->errorResponse('Venda não encontrada', 404);
            }

            if ($venda['status'] === 'CANCELADA') {
                $this->db->rollback();
                return $this->errorResponse('Esta compra já foi cancelada', 409);
            }

            $this->vendaRepository->cancelarVenda($vendaId, date('Y-m-d H:i:s'));
            $this->db->commit();

            return $this->successResponse([
                'venda_id' => $vendaId,
                'event_id' => (int) $venda['event_id'],
                'quantity' => (int) $venda['quantity'],
                'status' => 'CANCELADA',
                'message' => 'Compra cancelada com sucesso!',
            ]);
        } catch (\Exception $e) {
            if ($transactionStarted) {
                $this->db->rollback();
            }

            return $this->errorResponse('Erro ao cancelar compra: ' . $e->getMessage(), 500);
        }
    }

    public function listarNovosEventos($limit = 10): array
    {
        try {
            $eventos = $this->eventoRepository->listarNovosEventos((int) $limit);

            return $this->successResponse([
                'eventos' => $eventos,
                'total' => count($eventos),
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse('Erro ao listar novos eventos: ' . $e->getMessage(), 500);
        }
    }

    public function listarEventosCatalogo(): array
    {
        try {
            $eventos = $this->eventoRepository->listarEventosCatalogo();
            return $this->successResponse(['eventos' => $eventos]);
        } catch (\Exception $e) {
            return $this->errorResponse('Erro ao listar eventos do catálogo: ' . $e->getMessage(), 500);
        }
    }

    private function successResponse(array $data, int $statusCode = 200): array
    {
        return [
            'success' => true,
            'statusCode' => $statusCode,
            'data' => $data,
        ];
    }

    private function errorResponse(string $message, int $statusCode = 400): array
    {
        return [
            'success' => false,
            'statusCode' => $statusCode,
            'error' => $message,
        ];
    }
}
