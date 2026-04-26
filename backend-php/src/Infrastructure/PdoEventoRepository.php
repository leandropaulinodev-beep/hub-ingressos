<?php
declare(strict_types=1);

namespace HubIngressos\Infrastructure;

use HubIngressos\Contracts\DatabaseConnectionInterface;
use HubIngressos\Contracts\EventoRepositoryInterface;

class PdoEventoRepository implements EventoRepositoryInterface
{
    private DatabaseConnectionInterface $db;

    public function __construct(DatabaseConnectionInterface $db)
    {
        $this->db = $db;
    }

    public function listarNovosEventos(int $limit): array
    {
        $safeLimit = max(1, min(30, $limit));

        $stmt = $this->db->execute(
            "SELECT id, nome, descricao, data_evento, local, preco, estoque_total, criado_em
             FROM eventos
             ORDER BY criado_em DESC, id DESC
             LIMIT {$safeLimit}"
        );

        return $stmt->fetchAll();
    }

    public function listarEventosCatalogo(): array
    {
        $stmt = $this->db->execute(
            "SELECT
                e.id AS event_id,
                e.nome,
                e.descricao,
                e.data_evento,
                e.local,
                e.preco,
                GREATEST(
                    e.estoque_total - COALESCE((
                        SELECT SUM(v.quantity)
                        FROM vendas v
                        WHERE v.event_id = e.id AND v.status = 'CONFIRMADA'
                    ), 0),
                    0
                ) AS estoque_disponivel
             FROM eventos e
             ORDER BY e.id ASC"
        );

        return $stmt->fetchAll();
    }
}
