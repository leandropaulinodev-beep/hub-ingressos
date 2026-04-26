<?php
declare(strict_types=1);

namespace HubIngressos\Infrastructure;

use HubIngressos\Contracts\DatabaseConnectionInterface;
use HubIngressos\Contracts\VendaRepositoryInterface;

class PdoVendaRepository implements VendaRepositoryInterface
{
    private DatabaseConnectionInterface $db;

    public function __construct(DatabaseConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function salvarVenda(array $vendaData): int
    {
        $query = "
            INSERT INTO vendas (
                event_id,
                quantity,
                unit_price,
                total_price,
                payment_transaction_id,
                catalog_reservation_id,
                status,
                created_at
            ) VALUES (
                :event_id,
                :quantity,
                :unit_price,
                :total_price,
                :payment_transaction_id,
                :catalog_reservation_id,
                :status,
                :created_at
            )
        ";

        $this->db->execute($query, $vendaData);
        return (int) $this->db->lastInsertId();
    }

    public function buscarVendaPorId(int $vendaId): ?array
    {
        $stmt = $this->db->execute(
            'SELECT id, status, event_id, quantity FROM vendas WHERE id = :venda_id LIMIT 1',
            ['venda_id' => $vendaId]
        );

        $venda = $stmt->fetch();
        return $venda ?: null;
    }

    public function cancelarVenda(int $vendaId, string $updatedAt): void
    {
        $this->db->execute(
            'UPDATE vendas SET status = :status, updated_at = :updated_at WHERE id = :venda_id',
            [
                'status' => 'CANCELADA',
                'updated_at' => $updatedAt,
                'venda_id' => $vendaId,
            ]
        );
    }
}
