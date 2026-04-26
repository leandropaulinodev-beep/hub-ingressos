<?php
declare(strict_types=1);

namespace HubIngressos\Infrastructure;

use HubIngressos\Contracts\PaymentProcessorInterface;

class SimulatedPaymentProcessor implements PaymentProcessorInterface
{
    public function process(array $paymentData, float $amount): array
    {
        try {
            if (!isset($paymentData['metodo']) || !isset($paymentData['numero_cartao'])) {
                return [
                    'success' => false,
                    'statusCode' => 400,
                    'error' => 'Dados de pagamento incompletos',
                ];
            }

            $sucesso = (rand(1, 100) <= 95);
            if (!$sucesso) {
                return [
                    'success' => false,
                    'statusCode' => 402,
                    'error' => 'Pagamento recusado. Verifique seus dados',
                ];
            }

            return [
                'success' => true,
                'statusCode' => 200,
                'data' => [
                    'transacao_id' => 'TXN-' . uniqid() . '-' . time(),
                    'amount' => $amount,
                    'status' => 'APROVADO',
                    'timestamp' => date('Y-m-d H:i:s'),
                ],
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'statusCode' => 500,
                'error' => 'Erro ao processar pagamento: ' . $e->getMessage(),
            ];
        }
    }
}
