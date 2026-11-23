// The nib commands that are not about pages: help, version, unknown command

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const { currentCombo, REPO_PACKAGE, TMP } = require('../helpers/env');
const { builtProject, nib, repoNib } = require('../helpers/project');

const combo = currentCombo();

describe('nib general commands', () => {
    let dir;

    before(() => {
        dir = builtProject(combo);
    });

    for (const flag of ['version', 'v', '-v', '--version']) {
        test(`nib ${flag} prints the version`, () => {
            const res = repoNib(TMP, [flag]);
            assert.equal(res.status, 0, res.output);
            assert.ok(res.output.includes(REPO_PACKAGE.version), res.output);
        });
    }

    for (const flag of ['help', '-h', '--help']) {
        test(`nib ${flag} lists the commands`, () => {
            const res = repoNib(TMP, [flag]);
            assert.equal(res.status, 0, res.output);
            for (const command of ['new', 'run', 'build', 'clean', 'update', 'cli', 'create', 'rename', 'remove', 'path']) {
                assert.match(res.output, new RegExp(`nib ${command}\\b`), `help does not list nib ${command}`);
            }
        });
    }

    test('an unknown command is an error', () => {
        const res = repoNib(TMP, ['frobnicate']);
        assert.equal(res.status, 1, res.output);
        assert.match(res.output, /Unknown command/);
    });

    test('page commands outside a project are an error', () => {
        const res = repoNib(TMP, ['create', 'page']);
        assert.notEqual(res.status, 0, res.output);
    });

    test('inside a project, nib runs the project version', () => {
        const res = nib(dir, ['--version']);
        assert.equal(res.status, 0, res.output);
        assert.ok(res.output.includes(REPO_PACKAGE.version));
    });
});
