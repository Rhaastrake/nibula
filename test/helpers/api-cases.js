// The requests sent to both backends, with what each must answer. The same
// list drives the Node test, the PHP test and the parity test.

const assert = require('node:assert/strict');
const { NOT_FOUND_PAGE } = require('./backend');

const DEFAULT_KEY = 'DEFAULT_KEY';
const JSON_TYPE = 'application/json; charset=UTF-8';

// Headers every JSON answer carries, compared between the two backends
const SHARED_HEADERS = [
    'content-type', 'x-content-type-options', 'x-frame-options', 'referrer-policy',
    'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers',
];

function isError(code) {
    return (res) => {
        assert.equal(res.json.status, 'error');
        assert.equal(res.json.code, code);
        assert.equal(typeof res.json.message, 'string');
    };
}

const CASES = [
    {
        name: 'GET a public endpoint',
        path: '/api/example-public',
        status: 200,
        check: (res) => assert.deepEqual(res.json, { status: 'success', data: { message: 'Endpoint is working', params: [], query: {} } }),
    },
    {
        name: 'extra segments become params, query string is parsed',
        path: '/api/example-public/a/b?x=1&y=two',
        status: 200,
        check: (res) => assert.deepEqual(res.json.data, { message: 'Endpoint is working', params: ['a', 'b'], query: { x: '1', y: 'two' } }),
    },
    {
        name: 'trailing slash is accepted',
        path: '/api/example-public/',
        status: 200,
    },
    {
        name: 'POST with a valid body',
        method: 'POST',
        path: '/api/example-public',
        body: { name: 'Ada', email: 'ada@example.com' },
        status: 201,
        check: (res) => assert.deepEqual(res.json, { status: 'success', data: { name: 'Ada', email: 'ada@example.com' } }),
    },
    {
        name: 'POST without a required field',
        method: 'POST',
        path: '/api/example-public',
        body: { email: 'ada@example.com' },
        status: 422,
        check: isError(422),
    },
    {
        name: 'POST with an invalid email',
        method: 'POST',
        path: '/api/example-public',
        body: { name: 'Ada', email: 'not-an-email' },
        status: 422,
        check: isError(422),
    },
    {
        name: 'POST with malformed JSON is treated as an empty body',
        method: 'POST',
        path: '/api/example-public',
        body: '{"name": ',
        status: 422,
        check: isError(422),
    },
    {
        name: 'a method the endpoint does not export',
        method: 'PUT',
        path: '/api/example-public',
        status: 405,
        check: isError(405),
    },
    {
        name: 'DELETE is not exported either',
        method: 'DELETE',
        path: '/api/example-public',
        status: 405,
        check: isError(405),
    },
    {
        name: 'protected endpoint without a key',
        path: '/api/example-protected',
        status: 401,
        check: isError(401),
    },
    {
        name: 'protected endpoint with a wrong key',
        path: '/api/example-protected',
        headers: { 'X-Api-Key': 'wrong' },
        status: 401,
        check: isError(401),
    },
    {
        name: 'protected endpoint with a key of a different length',
        path: '/api/example-protected',
        headers: { 'X-Api-Key': 'DEFAULT_KEY_AND_MORE' },
        status: 401,
        check: isError(401),
    },
    {
        name: 'protected endpoint with the right key',
        path: '/api/example-protected',
        headers: { 'X-Api-Key': DEFAULT_KEY },
        status: 200,
        check: (res) => assert.equal(res.json.status, 'success'),
    },
    {
        name: 'CORS preflight',
        method: 'OPTIONS',
        path: '/api/example-public',
        headers: { Origin: 'https://other.example', 'Access-Control-Request-Method': 'POST' },
        status: 204,
        check: (res) => {
            assert.equal(res.text, '');
            assert.equal(res.headers['access-control-allow-origin'], '*');
            assert.match(res.headers['access-control-allow-methods'], /POST/);
            assert.match(res.headers['access-control-allow-headers'], /X-Api-Key/);
        },
    },
    {
        name: 'any origin is allowed by default',
        path: '/api/example-public',
        headers: { Origin: 'https://other.example' },
        status: 200,
        check: (res) => assert.equal(res.headers['access-control-allow-origin'], '*'),
    },
    {
        name: 'security headers on JSON answers',
        path: '/api/example-public',
        status: 200,
        check: (res) => {
            assert.equal(res.headers['content-type'], JSON_TYPE);
            assert.equal(res.headers['x-content-type-options'], 'nosniff');
            assert.equal(res.headers['x-frame-options'], 'DENY');
            assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
            assert.equal(res.headers['debug-mode'], undefined, 'debug header in production');
        },
    },
    {
        name: 'an unknown endpoint answers with the site 404 page',
        path: '/api/does-not-exist',
        status: 404,
        check: (res) => {
            assert.match(res.headers['content-type'], /^text\/html/);
            assert.equal(res.text, NOT_FOUND_PAGE);
        },
    },
    {
        name: 'the API root is not an endpoint',
        path: '/api/',
        status: 404,
    },
    {
        name: '".." segments never reach a file',
        path: '/api/../backend/config',
        statusIn: [400, 404],
        parity: false,
    },
    {
        name: 'encoded ".." segments never reach a file',
        path: '/api/%2e%2e/config',
        statusIn: [400, 404],
        parity: false,
    },
    {
        name: 'endpoint source code is never served',
        path: '/api/example-public.js',
        statusIn: [404],
        check: (res) => assert.doesNotMatch(res.text, /module\.exports|<\?php/),
    },
];

module.exports = { CASES, SHARED_HEADERS, DEFAULT_KEY };
