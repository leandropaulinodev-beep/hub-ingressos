<?php
declare(strict_types=1);

namespace HubIngressos\Infrastructure;

use HubIngressos\Contracts\DatabaseConnectionInterface;

class PdoDatabaseConnection implements DatabaseConnectionInterface
{
    private \PDO $connection;

    public function __construct()
    {
        $this->connect();
    }

    private function connect(): void
    {
        try {
            $this->connection = new \PDO(
                'mysql:host=' . \DB_HOST . ';dbname=' . \DB_NAME,
                \DB_USER,
                \DB_PASS,
                [
                    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                    \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                    //prepared statements nativos para reduzir risco de SQL injection.
                    \PDO::ATTR_EMULATE_PREPARES => false,
                    \PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4'
                ]
            );
        } catch (\PDOException $e) {
            if (\ENVIRONMENT === 'development') {
                throw new \RuntimeException('Erro na conexão com banco: ' . $e->getMessage());
            }

            throw new \RuntimeException('Erro ao conectar ao banco de dados');
        }
    }

    public function execute(string $query, array $params = []): \PDOStatement
    {
        try {
            $stmt = $this->connection->prepare($query);
            $stmt->execute($params);
            return $stmt;
        } catch (\PDOException $e) {
            throw new \Exception('Erro ao executar query: ' . $e->getMessage());
        }
    }

    public function beginTransaction(): bool
    {
        return $this->connection->beginTransaction();
    }

    public function commit(): bool
    {
        return $this->connection->commit();
    }

    public function rollback(): bool
    {
        if (!$this->connection->inTransaction()) {
            return true;
        }

        return $this->connection->rollBack();
    }

    public function lastInsertId(): string
    {
        return $this->connection->lastInsertId();
    }
}
