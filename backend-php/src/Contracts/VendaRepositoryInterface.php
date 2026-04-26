<?php
declare(strict_types=1);

namespace HubIngressos\Contracts;

interface VendaRepositoryInterface
{
    public function salvarVenda(array $vendaData): int;

    public function buscarVendaPorId(int $vendaId): ?array;

    public function cancelarVenda(int $vendaId, string $updatedAt): void;
}
