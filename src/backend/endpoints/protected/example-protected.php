<?php

declare(strict_types=1);

require_once CORE_PATH . '/modules/Response.php';
require_once CORE_PATH . '/modules/Validate.php';

/**
 * Return one closure per HTTP method you want to support. Any other method
 * gets an automatic 405, so you never have to check the method yourself.
 *
 * Each closure receives $request, an array with:
 *   method         the HTTP method, as a string
 *   requestParams  extra URL segments after the endpoint path
 *   query          query string values: ?page=2 gives ['page' => '2']
 *   body           the JSON body, already decoded into an array
 *   rawBody        the body as a raw string, if you need it
 *   headers        the request headers
 *   config         everything from config.php
 *
 * Response::success($data, $code) and Response::error($message, $code) send the
 * answer and stop the request: nothing after them runs.
 */

return [
    'get' => function (array $request) {
        Response::success([
            'message' => 'Endpoint is working',
            'params'  => $request['requestParams'],
            'query'   => $request['query'],
        ]);
    },

    'post' => function (array $request) {
        $body = $request['body'];

        // Validate:: stops the request with a 422 when a value is missing or
        // malformed, so the returned value is always safe to use.
        $name  = Validate::required($body['name'] ?? null, 'name');
        $email = Validate::email($body['email'] ?? null, 'email');

        Response::success([
            'name'  => $name,
            'email' => $email,
        ], 201);
    },
];