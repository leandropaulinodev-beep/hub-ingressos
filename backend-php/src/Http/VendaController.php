<?php
declare(strict_types=1);

namespace HubIngressos\Http;

use HubIngressos\Application\VendaService;

class VendaController
{
    private VendaService $vendaService;

    public function __construct(VendaService $vendaService)
    {
        $this->vendaService = $vendaService;
    }

    public function procesarCompra($eventId, $quantity, $paymentData): array
    {
        return $this->vendaService->processarCompra($eventId, $quantity, $paymentData);
    }

    public function cancelarCompra($vendaId): array
    {
        return $this->vendaService->cancelarCompra($vendaId);
    }

    public function listarNovosEventos($limit = 10): array
    {
        return $this->vendaService->listarNovosEventos($limit);
    }

    public function listarEventosCatalogo(): array
    {
        return $this->vendaService->listarEventosCatalogo();
    }
}
