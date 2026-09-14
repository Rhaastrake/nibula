<?php

declare(strict_types=1);

class Response
{
    private const STATUS_OK = 200;
    private const STATUS_BAD_REQUEST = 400;
    private const STATUS_NO_CONTENT = 204;

    private const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public static function success(mixed $data = null, int $code = self::STATUS_OK): never
    {
        http_response_code($code);
        echo json_encode([
            'status' => 'success',
            'data'   => $data,
        ], self::JSON_FLAGS);
        exit;
    }

    public static function error(string $message, int $code = self::STATUS_BAD_REQUEST, mixed $details = null): never
    {
        http_response_code($code);

        $body = [
            'status'  => 'error',
            'message' => $message,
            'code'    => $code,
        ];

        if ($details !== null) {
            $body['details'] = $details;
        }

        echo json_encode($body, self::JSON_FLAGS);
        exit;
    }

    public static function noContent(): never
    {
        http_response_code(self::STATUS_NO_CONTENT);
        exit;
    }
}