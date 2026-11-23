// npm install of a new project: it works and npm has nothing to warn about

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { builtProject } = require('../helpers/project');
const { exists, read } = require('../helpers/files');

const combo = currentCombo();

describe(`install: ${combo.id}`, () => {
    let dir;
    let log;

    before(() => {
        dir = builtProject(combo);
        log = read(path.join(dir, '.nibula-test-logs', 'npm-install.log'));
    });

    test('installs the local nibula', () => {
        assert.ok(exists(path.join(dir, 'node_modules/nibula/bin/nibula.js')));
        assert.ok(exists(path.join(dir, 'node_modules/.bin', process.platform === 'win32' ? 'nib.cmd' : 'nib')));
    });

    test('no deprecation warnings', () => {
        assert.doesNotMatch(log, /npm warn deprecated/i);
    });

    test('no warnings about install scripts', () => {
        assert.doesNotMatch(log, /install script|allowScripts|allow-scripts/i);
    });

    test('no npm warnings at all', () => {
        const warnings = log.split(/\r?\n/).filter((line) => /^npm warn/i.test(line));
        assert.deepEqual(warnings, []);
    });

    if (combo.backend === 'php') {
        test('Composer dependencies are installed', (t) => {
            if (!exists(path.join(dir, '.nibula-test-logs', 'composer-install.log'))) {
                t.skip('Composer not available');
                return;
            }
            assert.ok(exists(path.join(dir, 'src/backend/core/vendor/autoload.php')));
        });
    }
});
