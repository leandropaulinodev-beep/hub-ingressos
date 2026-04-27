<?php
declare(strict_types=1);

namespace HubIngressos\Contracts;

interface HttpClientInterface
{
    public function request(string $method, string $url, array $data = [], int $timeout = 10, array $headers = []): array;
}
