// The .htaccess files of a new project, run by a real Apache with PHP in
// Docker: shared hosting without mod_proxy (/api goes to PHP), and a server
// with mod_proxy (/api goes to Node). Only the Node port is changed.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { requireTools } = require('../helpers/env');
const { read } = require('../helpers/files');
const { freePort, request, waitForHttp, startProcess, stopProcess } = require('../helpers/server');
const { apacheImage, startContainer, stopContainer, containerLogs, servedOutput } = require('../helpers/docker');
const { BLOCKED, assertBlocked, successStatuses, assertRateLimitHoldsAgainstSpoofing, assertNoListing, assertApiWorks } = require('../helpers/web-cases');

const DOCUMENT_ROOT = '/var/www/html';

async function startApache(label, comboId, { withProxy }) {
    const port = await freePort();
    const nodePort = await freePort();
    const root = servedOutput(comboId, label);

    const htaccess = path.join(root, '.htaccess');
    const original = read(htaccess);
    assert.ok(original.includes('127.0.0.1:3000'), '.htaccess no longer proxies to 127.0.0.1:3000');
    fs.writeFileSync(htaccess, original.split('127.0.0.1:3000').join(`127.0.0.1:${nodePort}`));

    const id = startContainer(['-e', `APACHE_PORT=${port}`, '-v', `${root}:${DOCUMENT_ROOT}`, apacheImage(withProxy)]);
    try {
        await waitForHttp(port, { timeout: 60000 });
    } catch (error) {
        const logs = containerLogs(id);
        stopContainer(id);
        throw new Error(`${error.message}\n${logs}`);
    }
    return { port, nodePort, root, logs: () => containerLogs(id), stop: () => stopContainer(id) };
}

describe('Apache without mod_proxy: PHP backend', { skip: requireTools('docker', 'composer') }, () => {
    let server;

    before(async () => {
        server = await startApache('plain', 'js-bootstrap-php', { withProxy: false });
    });

    after(() => server && server.stop());

    test('serves the homepage and assets', async () => {
        const home = await request(server.port, '/');
        assert.equal(home.status, 200, server.logs());
        assert.match(home.text, /<html/);
        assert.equal((await request(server.port, '/css/global.css')).status, 200);
    });

    test('an unknown page gets the 404 page with status 404', async () => {
        const res = await request(server.port, '/no-such-page/');
        assert.equal(res.status, 404);
        assert.equal(res.text, read(path.join(server.root, '404.html')));
    });

    test('/api reaches the PHP front controller', async () => {
        await assertApiWorks(server.port);
    });

    test('/api of an unknown endpoint is a 404', async () => {
        const res = await request(server.port, '/api/does-not-exist');
        assert.equal(res.status, 404);
    });

    for (const pathname of BLOCKED) {
        test(`never serves ${pathname}`, async () => {
            await assertBlocked(server.port, pathname);
        });
    }

    test('blocked paths answer with an error status, not 200', async () => {
        assert.deepEqual(await successStatuses(server.port), []);
    });

    test('blocked files show the 404 page with status 404', async () => {
        for (const pathname of ['/web.config', '/.git/config', '/.env']) {
            const res = await request(server.port, pathname);
            assert.equal(res.status, 404, pathname);
            assert.equal(res.text, read(path.join(server.root, '404.html')), pathname);
        }
    });

    test('no directory listing', async () => {
        await assertNoListing(server.port, '/css/');
        await assertNoListing(server.port, '/assets/brand/');
    });
});

describe('Apache with mod_proxy: Node backend', { skip: requireTools('docker') }, () => {
    let server;
    let node;

    before(async () => {
        server = await startApache('proxy', 'js-bootstrap-node', { withProxy: true });
        node = startProcess(process.execPath, [path.join(server.root, 'backend/core/index.js')], {
            env: { PORT: String(server.nodePort), HOST: '127.0.0.1' },
        });
        await waitForHttp(server.nodePort, { pathname: '/api/example-public', child: node });
    });

    after(async () => {
        await stopProcess(node);
        if (server) server.stop();
    });

    test('serves the homepage', async () => {
        const res = await request(server.port, '/');
        assert.equal(res.status, 200, `${res.text}\n${server.logs()}`);
    });

    test('/api reaches Node', async () => {
        await assertApiWorks(server.port);
    });

    for (const pathname of BLOCKED) {
        test(`never serves ${pathname}`, async () => {
            await assertBlocked(server.port, pathname);
        });
    }

    test('blocked paths answer with an error status, not 200', async () => {
        assert.deepEqual(await successStatuses(server.port), []);
    });

    test('a spoofed X-Forwarded-For does not get around the rate limit', async () => {
        await assertRateLimitHoldsAgainstSpoofing(server.port);
    });
});
