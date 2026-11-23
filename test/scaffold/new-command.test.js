// nib new itself: flags, errors, and replacing an existing project. A wrong
// flag must never cost the user an existing project.

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { TMP } = require('../helpers/env');
const { repoNib } = require('../helpers/project');
const { exists, read, snapshot } = require('../helpers/files');

const PARENT = path.join(TMP, 'new-command');
const BASE = ['--skip-update-check'];
const FULL = ['--lang', 'js', '--css', 'none', '--backend', 'none', '--no-install', ...BASE];

function create(name, args = FULL) {
    return repoNib(PARENT, ['new', name, ...args]);
}

describe('nib new', () => {
    beforeEach(() => {
        fs.rmSync(PARENT, { recursive: true, force: true });
        fs.mkdirSync(PARENT, { recursive: true });
    });

    test('creates a project with all three flags and no terminal', () => {
        const res = create('site');
        assert.equal(res.status, 0, res.output);
        assert.ok(exists(path.join(PARENT, 'site', 'package.json')));
    });

    test('accepts --flag=value and flags before the name', () => {
        const res = repoNib(PARENT, ['new', '--lang=ts', '--css=bulma', '--backend', 'php', 'site', '--no-install', ...BASE]);
        assert.equal(res.status, 0, res.output);
        assert.ok(exists(path.join(PARENT, 'site', 'tsconfig.json')));
        assert.ok(exists(path.join(PARENT, 'site', 'src/backend/core/index.php')));
    });

    test('accepts long names and any case', () => {
        const res = create('site', ['--lang', 'TypeScript', '--css', 'BULMA', '--backend', 'nodejs', '--no-install', ...BASE]);
        assert.equal(res.status, 0, res.output);
        assert.ok(exists(path.join(PARENT, 'site', 'src/backend/core/index.js')));
    });

    for (const [flag, value] of [['lang', 'python'], ['css', 'tailwind'], ['backend', 'ruby'], ['lang', 'constructor'], ['css', '']]) {
        test(`refuses --${flag} "${value}" before creating anything`, () => {
            const args = FULL.map((arg, index) => (FULL[index - 1] === `--${flag}` ? value : arg));
            const res = create('site', args);
            assert.equal(res.status, 1, res.output);
            assert.match(res.output, new RegExp(`--${flag}`));
            assert.ok(!exists(path.join(PARENT, 'site')));
        });
    }

    test('without a terminal, a missing flag is an error', () => {
        const res = create('site', ['--css', 'none', '--no-install', ...BASE]);
        assert.equal(res.status, 1, res.output);
        assert.match(res.output, /Missing --lang/);
        assert.ok(!exists(path.join(PARENT, 'site')));
    });

    test('an unknown option is an error', () => {
        const res = create('site', [...FULL, '--foo']);
        assert.equal(res.status, 1, res.output);
        assert.ok(!exists(path.join(PARENT, 'site')));
    });

    test('a missing name is an error', () => {
        const res = repoNib(PARENT, ['new', ...FULL]);
        assert.equal(res.status, 1, res.output);
        assert.match(res.output, /Missing project name/);
    });

    test('an existing project is kept without --overwrite', () => {
        assert.equal(create('site').status, 0);
        const before = snapshot(path.join(PARENT, 'site'));
        const res = create('site');
        assert.equal(res.status, 0, res.output);
        assert.match(res.output, /already exists/);
        assert.deepEqual(snapshot(path.join(PARENT, 'site')), before);
    });

    test('--overwrite replaces an existing project, old files and .git included', () => {
        assert.equal(create('site').status, 0);
        fs.writeFileSync(path.join(PARENT, 'site', 'leftover.txt'), 'old');
        fs.mkdirSync(path.join(PARENT, 'site', '.git', 'old-marker'), { recursive: true });

        const res = create('site', ['--overwrite', ...FULL]);
        assert.equal(res.status, 0, res.output);
        assert.ok(!exists(path.join(PARENT, 'site', 'leftover.txt')));
        assert.ok(!exists(path.join(PARENT, 'site', '.git', 'old-marker')));
        assert.ok(exists(path.join(PARENT, 'site', 'package.json')));
    });

    test('--overwrite with a wrong flag keeps the existing project', () => {
        assert.equal(create('site').status, 0);
        const before = snapshot(path.join(PARENT, 'site'));
        const res = create('site', ['--overwrite', '--lang', 'js', '--css', 'tailwind', '--backend', 'none', ...BASE]);
        assert.equal(res.status, 1, res.output);
        assert.deepEqual(snapshot(path.join(PARENT, 'site')), before);
    });

    test('--overwrite with a missing flag keeps the existing project', () => {
        assert.equal(create('site').status, 0);
        const before = snapshot(path.join(PARENT, 'site'));
        const res = create('site', ['--overwrite', '--css', 'none', ...BASE]);
        assert.equal(res.status, 1, res.output);
        assert.deepEqual(snapshot(path.join(PARENT, 'site')), before);
    });

    test('--no-install leaves no node_modules', () => {
        assert.equal(create('site').status, 0);
        assert.ok(!exists(path.join(PARENT, 'site', 'node_modules')));
    });

    test('refuses to run inside a project', () => {
        assert.equal(create('site').status, 0);
        const res = repoNib(path.join(PARENT, 'site'), ['new', 'inner', ...FULL]);
        assert.notEqual(res.status, 0, res.output);
        assert.ok(!exists(path.join(PARENT, 'site', 'inner')));
    });

    test('the end message names the project folder', () => {
        const res = create('site');
        assert.match(res.output, /cd site/);
        assert.match(read(path.join(PARENT, 'site', 'package.json')), /"name": "site"/);
    });
});
