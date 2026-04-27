<?php
/**
 * API Endpoint - Serviço de Vendas
 * 
 * Este arquivo expõe os endpoints da API do serviço de vendas
 * Rota base: http://localhost/hub-ingressos/backend-php/api.php
 */

require_once 'config.php';
require_once 'autoload.php';

use HubIngressos\Application\VendaService;
use HubIngressos\Http\VendaController;
use HubIngressos\Infrastructure\CatalogGateway;
use HubIngressos\Infrastructure\CurlHttpClient;
use HubIngressos\Infrastructure\PdoDatabaseConnection;
use HubIngressos\Infrastructure\PdoEventoRepository;
use HubIngressos\Infrastructure\PdoVendaRepository;
use HubIngressos\Infrastructure\SimulatedPaymentProcessor;

// Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Version');

function getClientIpAddress(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function applyRateLimit(string $clientIp): void
{
    $maxRequests = max(1, RATE_LIMIT_MAX_REQUESTS);
    $windowSeconds = max(1, RATE_LIMIT_WINDOW_SECONDS);
    $currentWindow = (int) floor(time() / $windowSeconds);
    $resetAt = ($currentWindow + 1) * $windowSeconds;
    $storageFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'hub_ingressos_rate_limit_' . md5($clientIp) . '.json';

    $handle = fopen($storageFile, 'c+');
    if ($handle === false) {
        return;
    }

    $state = [
        'window' => $currentWindow,
        'count' => 0,
    ];

    try {
        if (!flock($handle, LOCK_EX)) {
            fclose($handle);
            return;
        }

        $contents = stream_get_contents($handle);
        if (is_string($contents) && $contents !== '') {
            $decoded = json_decode($contents, true);
            if (is_array($decoded)) {
                $state['window'] = (int) ($decoded['window'] ?? $currentWindow);
                $state['count'] = (int) ($decoded['count'] ?? 0);
            }
        }

        if ($state['window'] !== $currentWindow) {
            $state['window'] = $currentWindow;
            $state['count'] = 0;
        }

        $state['count']++;

        $remaining = max(0, $maxRequests - $state['count']);

        header('X-RateLimit-Limit: ' . $maxRequests);
        header('X-RateLimit-Remaining: ' . $remaining);
        header('X-RateLimit-Reset: ' . $resetAt);

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($state));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        if ($state['count'] > $maxRequests) {
            http_response_code(429);
            header('Retry-After: ' . max(1, $resetAt - time()));
            echo json_encode([
                'success' => false,
                'error' => 'Muitas requisições. Tente novamente em instantes.',
            ]);
            exit;
        }
    } catch (Throwable $e) {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}


if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

applyRateLimit(getClientIpAddress());

try {
    $databaseConnection = new PdoDatabaseConnection();
    $httpClient = new CurlHttpClient();
    $catalogGateway = new CatalogGateway($httpClient, CATALOG_SERVICE_URL);
    $paymentProcessor = new SimulatedPaymentProcessor();
    $vendaRepository = new PdoVendaRepository($databaseConnection);
    $eventoRepository = new PdoEventoRepository($databaseConnection);
    $vendaService = new VendaService(
        $databaseConnection,
        $catalogGateway,
        $paymentProcessor,
        $vendaRepository,
        $eventoRepository
    );

    $vendaController = new VendaController($vendaService);
    
    // Parse da requisição
    $method = $_SERVER['REQUEST_METHOD'];
    $route = $_GET['route'] ?? null;

    if ($method === 'GET' && $route === 'eventos-novos') {
        $limit = $_GET['limit'] ?? 10;
        $response = $vendaController->listarNovosEventos($limit);

        http_response_code($response['statusCode']);
        echo json_encode($response);
        exit;
    }

    if ($method === 'GET' && $route === 'catalogo-eventos') {
        $response = $vendaController->listarEventosCatalogo();

        http_response_code($response['statusCode']);
        echo json_encode($response);
        exit;
    }
    
    if ($method === 'POST' && $route === 'compras') {
        $inputData = json_decode(file_get_contents('php://input'), true);
        if (!$inputData) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid JSON'
            ]);
            exit;
        }
       
        $eventId = $inputData['event_id'] ?? ($inputData['id_evento'] ?? null);
        $quantity = $inputData['quantity'] ?? ($inputData['quantidade'] ?? null);
        $paymentData = $inputData['payment_data'] ?? null;
        
  
        $response = $vendaController->procesarCompra($eventId, $quantity, $paymentData);
        
        http_response_code($response['statusCode']);
        echo json_encode($response);
        exit;
    }

    if ($method === 'POST' && $route === 'cancelar') {
        $inputData = json_decode(file_get_contents('php://input'), true);
        if (!$inputData) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid JSON'
            ]);
            exit;
        }

        $vendaId = $inputData['venda_id'] ?? null;

        $response = $vendaController->cancelarCompra($vendaId);

        http_response_code($response['statusCode']);
        echo json_encode($response);
        exit;
    }

    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => 'Route not found'
    ]);
    
} catch (Exception $e) {
    error_log('API Error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => ENVIRONMENT === 'development' ? $e->getMessage() : 'Internal server error'
    ]);
}
