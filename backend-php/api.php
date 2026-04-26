<?php
/**
 * API Endpoint - Serviço de Vendas
 * 
 * Este arquivo expõe os endpoints da API do serviço de vendas
 * Rota base: http://localhost/hub-ingressos/backend-php/api.php
 */

require_once 'config.php';
require_once 'bootstrap.php';

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

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

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
    
    // Rotear requisição
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

        $eventId = $inputData['event_id'] ?? null;
        $quantity = $inputData['quantity'] ?? null;
        $paymentData = $inputData['payment_data'] ?? null;
        
        // Procesar compra
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
    
    // Rota não encontrada
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
