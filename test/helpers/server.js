// Starts servers for the backend and web-server tests and sends raw HTTP
// requests to them. Raw requests keep paths such as /api/../x as typed.

const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const { IS_WINDOWS } = require('./env');

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// A long-running process. Its output is kept for error messages.
function startProcess(command, args, { cwd, env } = {}) {
    const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: IS_WINDOWS && command !== process.execPath,
    });
    child.output = '';
    child.stdout.on('data', (chunk) => { child.output += chunk; });
    child.stderr.on('data', (chunk) => { child.output += chunk; });
    child.exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
    return child;
}

async function stopProcess(child) {
    if (!child || child.exitCode !== null) return;
    child.kill();
    await Promise.race([child.exited, sleep(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
}

function request(port, pathname, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
        const req = http.request({
            host: '127.0.0.1',
            port,
            path: pathname,
            method,
            headers: {
                ...(payload !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers,
            },
        }, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { text += chunk; });
            res.on('end', () => {
                let json;
                try { json = JSON.parse(text); } catch { json = undefined; }
                resolve({ status: res.statusCode, headers: res.headers, text, json });
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => req.destroy(new Error(`Timeout on ${method} ${pathname}`)));
        if (payload !== undefined) req.write(payload);
        req.end();
    });
}

// Waits until something answers HTTP on the port
async function waitForHttp(port, { pathname = '/', timeout = 30000, child } = {}) {
    const end = Date.now() + timeout;
    let lastError;
    while (Date.now() < end) {
        if (child && child.exitCode !== null) {
            throw new Error(`Server exited with code ${child.exitCode}\n${child.output}`);
        }
        try {
            return await request(port, pathname);
        } catch (error) {
            lastError = error;
            await sleep(250);
        }
    }
    throw new Error(`Nothing answered on port ${port}: ${lastError && lastError.message}\n${child ? child.output : ''}`);
}

module.exports = { freePort, sleep, startProcess, stopProcess, request, waitForHttp };
