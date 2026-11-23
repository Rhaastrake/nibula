// The files every new project gets at its root: package.json, the agent
// files, .gitignore and the git repository

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ALL_COMBOS, REPO, REPO_PACKAGE } = require('../helpers/env');
const { scaffoldOnce } = require('../helpers/project');
const { exists, read, readJson } = require('../helpers/files');

const AGENT_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];

const SCRIPTS = ['build:css', 'build:js', 'build:11ty', 'build', 'serve:css', 'serve:js', 'serve:11ty', 'clean', 'serve', 'assistant'];

// Dependencies that exist only in generated projects, not in the repo
const PROJECT_ONLY = new Set(['nibula', 'typescript', 'mysql2']);

for (const combo of ALL_COMBOS) {
    describe(`project files: ${combo.id}`, () => {
        const dir = scaffoldOnce(combo);
        const pkg = readJson(path.join(dir, 'package.json'));

        test('package.json basics', () => {
            assert.equal(pkg.name, combo.id);
            assert.equal(pkg.version, '0.0.0');
            assert.equal(pkg.private, true);
            assert.equal(pkg.outputDir, 'out');
        });

        test('depends on this version of nibula', () => {
            assert.equal(pkg.devDependencies.nibula, `^${REPO_PACKAGE.version}`);
        });

        test('dependency ranges match the repo', () => {
            const repoDeps = { ...REPO_PACKAGE.dependencies, ...REPO_PACKAGE.devDependencies };
            const all = { ...pkg.dependencies, ...pkg.devDependencies };
            for (const [name, range] of Object.entries(all)) {
                if (PROJECT_ONLY.has(name)) continue;
                assert.equal(range, repoDeps[name], `${name}: project ${range}, repo ${repoDeps[name]}`);
            }
        });

        test('no removed dependencies', () => {
            const all = { ...pkg.dependencies, ...pkg.devDependencies };
            assert.ok(!('@11ty/eleventy-img' in all));
        });

        test('install scripts are approved', () => {
            assert.deepEqual(pkg.allowScripts, { esbuild: true, '@parcel/watcher': true });
        });

        test('has every script', () => {
            assert.deepEqual(Object.keys(pkg.scripts).sort(), [...SCRIPTS].sort());
            assert.equal(pkg.scripts.clean, 'nib clean');
            assert.equal(pkg.scripts.assistant, 'nib cli');
        });

        test('agent files are copies of the templates', () => {
            for (const file of AGENT_FILES) {
                assert.ok(exists(path.join(dir, file)), `missing ${file}`);
                assert.equal(read(path.join(dir, file)), read(path.join(REPO, 'tools/res/templates/agents', file)));
            }
        });

        test('.gitignore ignores dependencies and output', () => {
            const gitignore = read(path.join(dir, '.gitignore'));
            assert.ok(gitignore.includes('node_modules/'));
            assert.ok(gitignore.includes('out/'));
        });

        test('starts as a git repository', { skip: !require('../helpers/env').hasCommand('git') && 'needs git' }, () => {
            assert.ok(exists(path.join(dir, '.git')));
        });

        test('pages.json and site.json are valid JSON', () => {
            readJson(path.join(dir, 'src/frontend/data/pages.json'));
            readJson(path.join(dir, 'src/frontend/data/site.json'));
        });
    });
}
