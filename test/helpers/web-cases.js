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

module.exports = { BLOCKED, assertBlocked, assertNoListing, assertApiWorks };
