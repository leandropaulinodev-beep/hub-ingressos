<?php
declare(strict_types=1);

namespace HubIngressos\Contracts;

interface CatalogGatewayInterface
{
    public function reservarIngresso(int $eventId, int $quantity): array;

    public function liberarReserva(string $reservaId): bool;

    public function confirmarReserva(string $reservaId): bool;
}
