<?php
/**
 * Configurações da aplicação
 */

$envData = [];
$envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';

if (file_exists($envPath) && is_readable($envPath)) {
	$lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

	foreach ($lines as $line) {
		$trimmed = trim($line);

		if ($trimmed === '' || strpos($trimmed, '#') === 0) {
			continue;
		}

		$parts = explode('=', $trimmed, 2);
		if (count($parts) !== 2) {
			continue;
		}

		$key = trim($parts[0]);
		$value = trim($parts[1]);

		// Remove aspas opcionais no valor.
		if ((strpos($value, '"') === 0 && substr($value, -1) === '"') ||
			(strpos($value, "'") === 0 && substr($value, -1) === "'")) {
			$value = substr($value, 1, -1);
		}

		$envData[$key] = $value;
	}
}

$env = static function ($key, $default = null) use ($envData) {
	if (array_key_exists($key, $envData)) {
		return $envData[$key];
	}

	$systemValue = getenv($key);
	if ($systemValue !== false) {
		return $systemValue;
	}

	return $default;
};

$requiredPositiveIntEnv = static function ($key) use ($env) {
	$value = $env($key);

	if ($value === null || $value === '') {
		throw new RuntimeException("Variável de ambiente obrigatória ausente: {$key}");
	}

	if (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value < 1) {
		throw new RuntimeException("Variável de ambiente inválida: {$key}");
	}

	return (int) $value;
};

$requiredStringEnv = static function ($key) use ($env) {
	$value = $env($key);

	if ($value === null || trim((string) $value) === '') {
		throw new RuntimeException("Variável de ambiente obrigatória ausente: {$key}");
	}

	return trim((string) $value);
};

// Configurações do banco de dados local
if (!defined('DB_HOST')) {
	define('DB_HOST', $env('DB_HOST', 'localhost'));
}
if (!defined('DB_USER')) {
	define('DB_USER', $env('DB_USER', 'root'));
}
if (!defined('DB_PASS')) {
	define('DB_PASS', $env('DB_PASS', ''));
}
if (!defined('DB_NAME')) {
	define('DB_NAME', $env('DB_NAME', 'hub_ingressos'));
}

// URL do serviço de Catálogo (Python)
if (!defined('CATALOG_SERVICE_URL')) {
	define('CATALOG_SERVICE_URL', $env('CATALOG_SERVICE_URL', 'http://localhost:5000'));
}

// Timeout para requisições HTTP (em segundos)
if (!defined('HTTP_TIMEOUT')) {
	define('HTTP_TIMEOUT', intval($env('HTTP_TIMEOUT', 10)));
}

// Headers padrão para requisições
if (!defined('API_VERSION')) {
	define('API_VERSION', $env('API_VERSION', 'v1'));
}

// Token interno para comunicação entre serviços
if (!defined('INTERNAL_SERVICE_TOKEN')) {
	define('INTERNAL_SERVICE_TOKEN', $requiredStringEnv('INTERNAL_SERVICE_TOKEN'));
}

// Rate limit simples por IP
if (!defined('RATE_LIMIT_MAX_REQUESTS')) {
	define('RATE_LIMIT_MAX_REQUESTS', $requiredPositiveIntEnv('RATE_LIMIT_MAX_REQUESTS'));
}
if (!defined('RATE_LIMIT_WINDOW_SECONDS')) {
	define('RATE_LIMIT_WINDOW_SECONDS', $requiredPositiveIntEnv('RATE_LIMIT_WINDOW_SECONDS'));
}

// Ambiente
if (!defined('ENVIRONMENT')) {
	define('ENVIRONMENT', $env('ENVIRONMENT', 'development'));
}
