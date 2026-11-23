// Node and PHP must give the same answer to the same request: status,
// shared headers and JSON body. A project can switch backend without
// changing its frontend.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { requireTools } = require('../helpers/env');
const { CASES, SHARED_HEADERS } = require('../helpers/api-cases');
const { backendRoot, startBackend } = require('../helpers/backend');
const { send } = require('../helpers/backend-suite');

describe('backend parity: Node and PHP', { skip: requireTools('php', 'composer') }, () => {
    let node;
    let php;

    before(async () => {
        node = await startBackend('node', backendRoot('node', 'parity'));
        php = await startBackend('php', backendRoot('php', 'parity'));
    });

    after(async () => {
        if (node) await node.stop();
        if (php) await php.stop();
    });

    for (const item of CASES.filter((entry) => entry.parity !== false)) {
        test(item.name, async () => {
            const [a, b] = [await send(node.port, item), await send(php.port, item)];
            assert.equal(b.status, a.status, 'status (Node, then PHP)');
            for (const header of SHARED_HEADERS) {
                assert.equal(b.headers[header], a.headers[header], `header ${header}`);
            }
            assert.deepEqual(b.json, a.json, 'JSON body');
        });
    }
});
