// Runs the Node and PHP backends of a new project, laid out as they are
// once published: <root>/backend/... next to <root>/404.html

const fs = require('fs');
const path = require('path');
const { TMP, parseCombo } = require('./env');
const { scaffold, runOk, phase } = require('./project');
const { freePort, startProcess, stopProcess, waitForHttp } = require('./server');

const NOT_FOUND_PAGE = '<!doctype html><title>Not found</title><h1>nibula-test-404</h1>';

// A published-like folder for the backend. Fresh on every call, so the rate
// limiter starts from zero.
function backendRoot(kind, label) {
    const source = path.join(TMP, 'backend-source', kind);
    if (!fs.existsSync(path.join(source, 'src/backend'))) {
        scaffold(path.join(TMP, 'backend-source'), kind, parseCombo(`js-none-${kind}`));
        if (kind === 'php') {
            phase('composer install');
            runOk('composer', ['install', '--no-interaction', '--no-progress'], { cwd: path.join(source, 'src/backend/core') });
        }
    }

    const root = path.join(TMP, 'backend-run', `${kind}-${label}`);
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    fs.cpSync(path.join(source, 'src/backend'), path.join(root, 'backend'), { recursive: true });
    fs.writeFileSync(path.join(root, '404.html'), NOT_FOUND_PAGE);
    return root;
}

async function startBackend(kind, root) {
    const port = await freePort();
    const child = kind === 'node'
        ? startProcess(process.execPath, [path.join(root, 'backend/core/index.js')], { env: { PORT: String(port), HOST: '127.0.0.1' } })
        : startProcess('php', ['-S', `127.0.0.1:${port}`, '-t', root, path.join(root, 'backend/core/index.php')]);
    await waitForHttp(port, { pathname: '/api/example-public', child });
    return { port, child, stop: () => stopProcess(child) };
}

module.exports = { backendRoot, startBackend, NOT_FOUND_PAGE };
