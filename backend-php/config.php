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

// Ambiente
if (!defined('ENVIRONMENT')) {
	define('ENVIRONMENT', $env('ENVIRONMENT', 'development'));
}
