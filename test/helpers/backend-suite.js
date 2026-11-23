// The same suite for both backends: every API case, the rate limiter, and a
// missing config. node.test.js and php.test.js only pick the backend.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { CASES } = require('./api-cases');
const { backendRoot, startBackend } = require('./backend');
const { request, freePort, startProcess, stopProcess, waitForHttp, sleep } = require('./server');

const RATE_LIMIT = 60;

function send(port, item) {
    return request(port, item.path, { method: item.method, headers: item.headers, body: item.body });
}

function backendSuite(kind, { skip } = {}) {
    describe(`backend: ${kind}`, { skip }, () => {
        let server;

        before(async () => {
            server = await startBackend(kind, backendRoot(kind, 'cases'));
        });

        after(async () => {
            if (server) await server.stop();
        });

        for (const item of CASES) {
            test(item.name, async () => {
                const res = await send(server.port, item);
                if (item.statusIn) assert.ok(item.statusIn.includes(res.status), `status ${res.status}, expected one of ${item.statusIn}\n${res.text}`);
                else assert.equal(res.status, item.status, res.text);
                if (item.check) item.check(res);
            });
        }
    });

    describe(`backend: ${kind} rate limit`, { skip }, () => {
        let server;

        before(async () => {
            server = await startBackend(kind, backendRoot(kind, 'rate-limit'));
        });

        after(async () => {
            if (server) await server.stop();
        });

        test(`answers 429 after ${RATE_LIMIT} requests a minute`, async () => {
            // startBackend already sent one request while waiting for the server
            for (let i = 1; i < RATE_LIMIT; i++) {
                const res = await request(server.port, '/api/example-public');
                assert.equal(res.status, 200, `request ${i + 1} was refused early`);
            }
            const res = await request(server.port, '/api/example-public');
            assert.equal(res.status, 429);
            assert.equal(res.json.status, 'error');
            assert.equal(res.headers['retry-after'], '60');
        });
    });

    describe(`backend: ${kind} without config`, { skip }, () => {
        test('stops with a clear message instead of answering', async () => {
            const root = backendRoot(kind, 'no-config');
            fs.rmSync(path.join(root, 'backend', kind === 'node' ? 'config.js' : 'config.php'));

            if (kind === 'node') {
                const port = await freePort();
                const child = startProcess(process.execPath, [path.join(root, 'backend/core/index.js')], { env: { PORT: String(port) } });
                const code = await Promise.race([child.exited, sleep(10000).then(() => 'timeout')]);
                await stopProcess(child);
                assert.notEqual(code, 0, 'the server should not start');
                assert.match(child.output, /Missing config\.js/);
                return;
            }

            const port = await freePort();
            const child = startProcess('php', ['-S', `127.0.0.1:${port}`, '-t', root, path.join(root, 'backend/core/index.php')]);
            try {
                const res = await waitForHttp(port, { pathname: '/api/example-public', child });
                assert.equal(res.status, 500);
                assert.equal(res.json.status, 'error');
                assert.match(res.json.message, /Missing config\.php/);
            } finally {
                await stopProcess(child);
            }
        });
    });
}

module.exports = { backendSuite, send };
