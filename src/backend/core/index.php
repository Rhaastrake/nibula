<?php

declare(strict_types=1);

define('CORE_PATH', __DIR__);

const DEBUG_HEADER = 'Debug-Mode';
const DEBUG_HEADER_VALUE = 'true';

const URL_PREFIX = '/api';
const ENDPOINT_EXTENSION = '.php';
const ERROR_PAGE = '404.html';
const ENDPOINTS_FOLDER = 'endpoints';
const PUBLIC_FOLDER = 'public';
const PROTECTED_FOLDER = 'protected';

const RATE_LIMIT_REQUESTS = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const STATUS_NO_CONTENT = 204;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const STATUS_METHOD_NOT_ALLOWED = 405;

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, X-Api-Key';
const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';
const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

require_once __DIR__ . '/init.php';
require_once __DIR__ . '/modules/Response.php';
require_once __DIR__ . '/modules/RateLimiter.php';
require_once __DIR__ . '/modules/Validate.php';

$basePublic    = __DIR__ . '/../' . ENDPOINTS_FOLDER . '/' . PUBLIC_FOLDER . '/';
$baseProtected = __DIR__ . '/../' . ENDPOINTS_FOLDER . '/' . PROTECTED_FOLDER . '/';

function parseSegments(string $pathname): array
{
    $uri = rtrim(preg_replace('#^' . URL_PREFIX . '#', '', $pathname), '/');

    return array_values(array_filter(explode('/', $uri)));
}

function resolveEndpoint(array $segments, string $basePublic, string $baseProtected): ?array
{
    $remaining = $segments;
    $params    = [];

    while (count($remaining) > 0) {
        $relativePath = implode('/', $remaining) . ENDPOINT_EXTENSION;

        if (file_exists($basePublic . $relativePath)) {
            return [
                'file'        => $basePublic . $relativePath,
                'base'        => $basePublic,
                'isProtected' => false,
                'params'      => $params,
            ];
        }

        if (file_exists($baseProtected . $relativePath)) {
            return [
                'file'        => $baseProtected . $relativePath,
                'base'        => $baseProtected,
                'isProtected' => true,
                'params'      => $params,
            ];
        }

        array_unshift($params, array_pop($remaining));
    }

    return null;
}

function toEndpointKey(string $file, string $base): string
{
    $normalizedBase = str_replace('\\', '/', $base);
    $normalizedFile = str_replace('\\', '/', $file);

    return preg_replace('#\\' . ENDPOINT_EXTENSION . '$#', '', str_replace($normalizedBase, '', $normalizedFile));
}

function sendErrorPage(): never
{
    http_response_code(STATUS_NOT_FOUND);
    header_remove('WWW-Authenticate');
    header_remove('X-Powered-By');
    header('Content-Type: ' . HTML_CONTENT_TYPE);

    $errorPage = ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/' . ERROR_PAGE;

    if (!file_exists($errorPage)) {
        $errorPage = __DIR__ . '/../../' . ERROR_PAGE;
    }

    echo file_exists($errorPage)
        ? file_get_contents($errorPage)
        : '<h1>404 Not Found</h1>The requested URL was not found on this server.';

    exit;
}

function applySecurityHeaders(bool $isDebug): void
{
    header('Content-Type: ' . JSON_CONTENT_TYPE);
    header_remove('WWW-Authenticate');
    header_remove('X-Powered-By');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Access-Control-Allow-Methods: ' . ALLOWED_METHODS);
    header('Access-Control-Allow-Headers: ' . ALLOWED_HEADERS);

    if ($isDebug) {
        header(DEBUG_HEADER . ': ' . DEBUG_HEADER_VALUE);
    }
}

function applyCors(array $config, string $endpointKey, string $origin): void
{
    $allowedOrigins = $config['CUSTOM_ENDPOINT_ORIGINS'][$endpointKey]
        ?? $config['GENERAL_ALLOWED_ORIGINS']
        ?? [];

    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');

        return;
    }

    if (in_array('*', $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: *');
    }
}

function authorize(array $config, string $endpointKey, string $givenKey): void
{
    $validKey = $config['CUSTOM_ENDPOINT_KEYS'][$endpointKey] ?? $config['GENERAL_API_KEY'] ?? '';

    if ($validKey === '' || !hash_equals($validKey, $givenKey)) {
        Response::error('Unauthorized. X-Api-Key is incorrect or missing', STATUS_UNAUTHORIZED);
    }
}

function dispatch(string $endpointFile, array $request): void
{
    $handlers = require $endpointFile;

    if (!is_array($handlers)) {
        return;
    }

    $methodHandler = $handlers[strtolower($request['method'])] ?? null;

    if (!is_callable($methodHandler)) {
        Response::error('Method not allowed', STATUS_METHOD_NOT_ALLOWED);
    }

    $methodHandler($request);
}

$method   = $_SERVER['REQUEST_METHOD'];
$segments = parseSegments(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

foreach ($segments as $segment) {
    if ($segment === '.' || $segment === '..') {
        Response::error('Bad Request', STATUS_BAD_REQUEST);
    }
}

$endpoint = resolveEndpoint($segments, $basePublic, $baseProtected);

if ($endpoint === null) {
    sendErrorPage();
}

$endpointKey = toEndpointKey($endpoint['file'], $endpoint['base']);

applySecurityHeaders($isDebug);
applyCors($config, $endpointKey, $_SERVER['HTTP_ORIGIN'] ?? '');

if ($method === 'OPTIONS') {
    http_response_code(STATUS_NO_CONTENT);
    exit;
}

RateLimiter::check($_SERVER['REMOTE_ADDR'] ?? '', RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS);

if ($endpoint['isProtected']) {
    authorize($config, $endpointKey, $_SERVER['HTTP_X_API_KEY'] ?? '');
}

$rawBody = file_get_contents('php://input');

dispatch($endpoint['file'], [
    'method'        => $method,
    'requestParams' => $endpoint['params'],
    'query'         => $_GET,
    'body'          => json_decode($rawBody, true) ?? [],
    'rawBody'       => $rawBody,
    'headers'       => function_exists('getallheaders') ? getallheaders() : [],
    'config'        => $config,
]);