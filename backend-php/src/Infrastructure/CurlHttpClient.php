<?php
declare(strict_types=1);

namespace HubIngressos\Infrastructure;

use HubIngressos\Contracts\HttpClientInterface;

class CurlHttpClient implements HttpClientInterface
{
    public function request(string $method, string $url, array $data = [], int $timeout = 10, array $headers = []): array
    {
        $ch = curl_init();

        $httpHeaders = array_merge(
            [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-API-Version: ' . \API_VERSION,
            ],
            $headers
        );

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $httpHeaders,
        ]);

        if (in_array(strtoupper($method), ['POST', 'PUT'], true)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        if ($error) {
            throw new \Exception('Erro cURL: ' . $error);
        }

        return [
            'http_code' => $httpCode,
            'data' => $response,
        ];
    }
}
