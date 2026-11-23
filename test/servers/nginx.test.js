// The nginx.conf of a new project, run by a real nginx in Docker: static
// pages, the 404 page, blocked files, /api to Node and the PHP fallback.
// Only what a test machine cannot have is changed: certificates, ports and
// the php-fpm socket.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { requireTools } = require('../helpers/env');
const { builtProject } = require('../helpers/project');
const { parseCombo } = require('../helpers/env');
const { read } = require('../helpers/files');
const { freePort, request, waitForHttp, startProcess, stopProcess } = require('../helpers/server');
const { IMAGES, docker, uidArgs, startContainer, stopContainer, containerLogs, servedOutput, writeTemp } = require('../helpers/docker');
const { BLOCKED, assertBlocked, assertNoListing, assertApiWorks } = require('../helpers/web-cases');

const SITE_ROOT = '/var/www/site';

// Replaces text that must be in nginx.conf, and fails if it is not there
function replaceOnce(text, from, to) {
    const count = text.split(from).length - 1;
    assert.ok(count >= 1, `nginx.conf no longer contains: ${from}`);
    return text.split(from).join(to);
}

function testConfig(conf, ports) {
    let text = conf;
    text = replaceOnce(text, 'YOUR_DOMAIN', 'localhost');
    text = replaceOnce(text, '/var/www/SITE_FOLDER', SITE_ROOT);
    text = replaceOnce(text, 'listen      80;', `listen ${ports.http};`);
    text = replaceOnce(text, 'listen      [::]:80;', '');
    text = replaceOnce(text, 'listen      443 ssl;', `listen ${ports.https};`);
    text = replaceOnce(text, 'listen      [::]:443 ssl;', '');
    text = replaceOnce(text, 'http2       on;', '');
    text = replaceOnce(text, 'http://127.0.0.1:3000', `http://127.0.0.1:${ports.node}`);
    text = replaceOnce(text, 'unix:/run/php/php-fpm.sock', `127.0.0.1:${ports.fpm}`);
    text = text.split('\n').filter((line) => !/^\s*(ssl_certificate|ssl_certificate_key|ssl_dhparam|include\s+\/etc\/letsencrypt)/.test(line)).join('\n');
    return text;
}

async function startNginx(label, comboId, { withFpm }) {
    const ports = { http: await freePort(), https: await freePort(), node: await freePort(), fpm: await freePort() };
    const root = servedOutput(comboId, label);
    const conf = writeTemp(`nginx-${label}.conf`, testConfig(read(path.join(builtProject(parseCombo(comboId)), 'nginx.conf')), ports));
    const mounts = ['-v', `${conf}:/etc/nginx/conf.d/default.conf:ro`, '-v', `${root}:${SITE_ROOT}:ro`];

    const syntax = docker(['run', '--rm', '--network', 'host', ...mounts, IMAGES.nginx, 'nginx', '-t']);
    const containers = [];

    if (withFpm) {
        const pool = writeTemp(`fpm-${label}.conf`, `[global]\ndaemonize = no\n\n[www]\nlisten = 127.0.0.1:${ports.fpm}\n`);
        containers.push(startContainer([...uidArgs(), '-v', `${root}:${SITE_ROOT}`, '-v', `${pool}:/usr/local/etc/php-fpm.d/zz-docker.conf:ro`, IMAGES.phpFpm]));
    }
    containers.push(startContainer([...mounts, IMAGES.nginx]));
    await waitForHttp(ports.https, { timeout: 60000 });

    return {
        ports,
        root,
        syntax,
        logs: () => containers.map(containerLogs).join('\n'),
        stop: () => containers.forEach(stopContainer),
    };
}

describe('nginx: PHP backend (Node not running, PHP fallback)', { skip: requireTools('docker', 'composer') }, () => {
    let server;

    before(async () => {
        server = await startNginx('php', 'js-bootstrap-php', { withFpm: true });
    });

    after(() => server && server.stop());

    test('the config passes nginx -t', () => {
        assert.match(server.syntax.output, /syntax is ok/);
    });

    test('serves the homepage and assets', async () => {
        const home = await request(server.ports.https, '/');
        assert.equal(home.status, 200);
        assert.match(home.text, /<html/);
        const css = await request(server.ports.https, '/css/global.css');
        assert.equal(css.status, 200);
    });

    test('an unknown page gets the 404 page with status 404', async () => {
        const res = await request(server.ports.https, '/no-such-page/');
        assert.equal(res.status, 404);
        assert.equal(res.text, read(path.join(server.root, '404.html')));
    });

    test('security headers and no version in Server', async () => {
        const res = await request(server.ports.https, '/');
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
        assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
        assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
        assert.ok(res.headers['strict-transport-security']);
        assert.equal(res.headers.server, 'nginx');
    });

    test('/api falls back to PHP when Node is down', async () => {
        await assertApiWorks(server.ports.https);
    });

    for (const pathname of BLOCKED) {
        test(`never serves ${pathname}`, async () => {
            const res = await assertBlocked(server.ports.https, pathname);
            assert.equal(res.status, 404, `${pathname}: status ${res.status}`);
        });
    }

    test('no directory listing', async () => {
        await assertNoListing(server.ports.https, '/css/');
        await assertNoListing(server.ports.https, '/assets/brand/');
    });

    test('plain HTTP redirects to HTTPS', async () => {
        const res = await request(server.ports.http, '/some/page?x=1', { headers: { Host: 'localhost' } });
        assert.equal(res.status, 301);
        assert.equal(res.headers.location, 'https://localhost/some/page?x=1');
    });
});

describe('nginx: Node backend', { skip: requireTools('docker') }, () => {
    let server;
    let node;

    before(async () => {
        server = await startNginx('node', 'js-bootstrap-node', { withFpm: false });
        node = startProcess(process.execPath, [path.join(server.root, 'backend/core/index.js')], {
            env: { PORT: String(server.ports.node), HOST: '127.0.0.1' },
        });
        await waitForHttp(server.ports.node, { pathname: '/api/example-public', child: node });
    });

    after(async () => {
        await stopProcess(node);
        if (server) server.stop();
    });

    test('/api reaches Node', async () => {
        await assertApiWorks(server.ports.https);
    });

    for (const pathname of BLOCKED) {
        test(`never serves ${pathname}`, async () => {
            const res = await assertBlocked(server.ports.https, pathname);
            assert.equal(res.status, 404, `${pathname}: status ${res.status}`);
        });
    }
});
