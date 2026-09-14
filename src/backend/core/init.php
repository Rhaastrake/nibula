<?php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/modules/Response.php';

const CONFIG_FILE = 'config.php';
const EXAMPLE_CONFIG_FILE = 'example.config.php';
const DEFAULT_ENVIRONMENT = 'production';

$backendRoot = dirname(__DIR__);
$configPath  = $backendRoot . '/' . CONFIG_FILE;

if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'status'  => 'error',
        'message' => 'Missing ' . CONFIG_FILE . '. Copy ' . EXAMPLE_CONFIG_FILE . ' to ' . CONFIG_FILE . ' in ' . $backendRoot . ' and fill in your values.',
        'code'    => 500,
    ]);
    exit;
}

$config  = require $configPath;
$isDebug = ($config['APP_ENV'] ?? DEFAULT_ENVIRONMENT) !== DEFAULT_ENVIRONMENT;

set_exception_handler(function (Throwable $exception) use ($isDebug) {
    Response::error(
        $isDebug ? $exception->getMessage() : 'Internal server error',
        500,
        $isDebug ? [
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'warning' => 'Error details are exposed. Set APP_ENV to "production" in config.php before publishing.',
        ] : null
    );
});

set_error_handler(function (int $severity, string $message, string $file, int $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

if ($isDebug) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(0);
}