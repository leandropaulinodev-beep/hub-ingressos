<?php
declare(strict_types=1);

namespace HubIngressos\Contracts;

interface DatabaseConnectionInterface
{
    public function execute(string $query, array $params = []): \PDOStatement;

    public function beginTransaction(): bool;

    public function commit(): bool;

    public function rollback(): bool;

    public function lastInsertId(): string;
}
