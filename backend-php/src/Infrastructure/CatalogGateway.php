<?php
declare(strict_types=1);

namespace HubIngressos\Infrastructure;

use HubIngressos\Contracts\CatalogGatewayInterface;
use HubIngressos\Contracts\HttpClientInterface;

class CatalogGateway implements CatalogGatewayInterface
{
    private HttpClientInterface $httpClient;
    private string $catalogServiceUrl;

    public function __construct(HttpClientInterface $httpClient, string $catalogServiceUrl)
    {
        $this->httpClient = $httpClient;
        $this->catalogServiceUrl = rtrim($catalogServiceUrl, '/');
    }

    public function reservarIngresso(int $eventId, int $quantity): array
    {
        try {
            $response = $this->httpClient->request(
                'POST',
                $this->catalogServiceUrl . '/api/v1/catalogo/reservar',
                [
                    'event_id' => $eventId,
                    'quantity' => $quantity,
                ],
                (int) \HTTP_TIMEOUT,
                $this->internalHeaders()
            );

            if ($response['http_code'] === 200 && isset($response['data'])) {
                $responseData = json_decode((string) $response['data'], true);

                if ($responseData && isset($responseData['success']) && $responseData['success']) {
                    return [
                        'success' => true,
                        'statusCode' => 200,
                        'data' => $responseData['data'],
                    ];
                }
            }

            if ($response['http_code'] === 409) {
                return [
                    'success' => false,
                    'statusCode' => 409,
                    'error' => 'Estoque insuficiente para este evento',
                ];
            }

            if ($response['http_code'] === 404) {
                return [
                    'success' => false,
                    'statusCode' => 404,
                    'error' => 'Evento não encontrado no catálogo',
                ];
            }

            if ($response['http_code'] === 503) {
                return [
                    'success' => false,
                    'statusCode' => 503,
                    'error' => 'Serviço de Catálogo indisponível. Tente novamente mais tarde',
                ];
            }

            return [
                'success' => false,
                'statusCode' => 500,
                'error' => 'Erro ao comunicar com serviço de Catálogo',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'statusCode' => 500,
                'error' => 'Erro ao reservar ingresso: ' . $e->getMessage(),
            ];
        }
    }

    public function liberarReserva(string $reservaId): bool
    {
        try {
            $response = $this->httpClient->request(
                'PUT',
                $this->catalogServiceUrl . '/api/v1/catalogo/reservas/' . $reservaId . '/liberar',
                [],
                (int) \HTTP_TIMEOUT,
                $this->internalHeaders()
            );

            return $response['http_code'] === 200;
        } catch (\Exception $e) {
            error_log('Erro ao liberar reserva: ' . $e->getMessage());
            return false;
        }
    }

    public function confirmarReserva(string $reservaId): bool
    {
        try {
            $response = $this->httpClient->request(
                'PUT',
                $this->catalogServiceUrl . '/api/v1/catalogo/reservas/' . $reservaId . '/confirmar',
                [],
                (int) \HTTP_TIMEOUT,
                $this->internalHeaders()
            );

            return $response['http_code'] === 200;
        } catch (\Exception $e) {
            error_log('Erro ao confirmar reserva: ' . $e->getMessage());
            return false;
        }
    }

    private function internalHeaders(): array
    {
        return [
            'X-Internal-Service-Token: ' . \INTERNAL_SERVICE_TOKEN,
        ];
    }
}
