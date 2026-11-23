// Checks shared by the nginx and Apache tests: what a published site must
// serve, and what it must never serve

const assert = require('node:assert/strict');
const { request } = require('./server');

// Paths that must never be served as files. Each one exists in the output
// (or would, on a real server), and none of their content may leak.
const BLOCKED = [
    '/web.config',
    '/.htaccess',
    '/.git/config',
    '/backend/',
    '/backend/config.php',
    '/backend/config.js',
    '/backend/.htaccess',
    '/backend/web.config',
    '/backend/core/index.php',
    '/backend/core/index.js',
    '/backend/core/init.php',
    '/backend/core/composer.json',
    '/backend/core/vendor/autoload.php',
    '/backend/endpoints/public/example-public.php',
    '/backend/endpoints/public/example-public.js',
    '/backend/database/migrations/create_example_db.sql',
    '/backend/cache/',
];

// Text that would mean a source or config file was sent as it is
const LEAKS = [/GENERAL_API_KEY/, /<\?php/, /module\.exports/, /<configuration>/, /RewriteEngine/, /\[core\]/, /CREATE TABLE/i, /"require"\s*:/];

// The content of the file never reaches the client
async function assertBlocked(port, pathname) {
    const res = await request(port, pathname);
    for (const leak of LEAKS) assert.doesNotMatch(res.text, leak, `${pathname} leaked ${leak}`);
    return res;
}

// Blocked paths whose answer is a success status (a "soft 404")
async function successStatuses(port, paths = BLOCKED) {
    const wrong = [];
    for (const pathname of paths) {
        const res = await request(port, pathname);
        if (res.status < 400) wrong.push(`${pathname}: ${res.status}`);
    }
    return wrong;
}

// A client that sends a new X-Forwarded-For on every request is still rate
// limited: the backend must see the real address. Uses up the limit, so it
// runs last in its suite.
async function assertRateLimitHoldsAgainstSpoofing(port, limit = 60) {
    for (let i = 0; i <= limit; i++) {
        const res = await request(port, '/api/example-public', { headers: { 'X-Forwarded-For': `10.0.${Math.floor(i / 250)}.${i % 250}` } });
        if (res.status === 429) return;
    }
    assert.fail(`more than ${limit} requests passed with a different X-Forwarded-For each`);
}

async function assertNoListing(port, pathname) {
    const res = await request(port, pathname);
    assert.notEqual(res.status, 200, `${pathname} answered 200`);
    assert.doesNotMatch(res.text, /Index of/i);
}

async function assertApiWorks(port) {
    const pub = await request(port, '/api/example-public/a?x=1');
    assert.equal(pub.status, 200, pub.text);
    assert.equal(pub.json.status, 'success');
    assert.deepEqual(pub.json.data.params, ['a']);
    assert.deepEqual(pub.json.data.query, { x: '1' });

    const denied = await request(port, '/api/example-protected');
    assert.equal(denied.status, 401, denied.text);

    const allowed = await request(port, '/api/example-protected', { headers: { 'X-Api-Key': 'DEFAULT_KEY' } });
    assert.equal(allowed.status, 200, allowed.text);

    const posted = await request(port, '/api/example-public', { method: 'POST', body: { name: 'Ada', email: 'ada@example.com' } });
    assert.equal(posted.status, 201, posted.text);
}

module.exports = { BLOCKED, assertBlocked, successStatuses, assertRateLimitHoldsAgainstSpoofing, assertNoListing, assertApiWorks };
