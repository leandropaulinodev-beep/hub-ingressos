<?php
declare(strict_types=1);

namespace HubIngressos\Contracts;

interface EventoRepositoryInterface
{
    public function listarNovosEventos(int $limit): array;

    public function listarEventosCatalogo(): array;

    public function buscarEventoPorId(int $eventId): ?array;
}
