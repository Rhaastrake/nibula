// What npm publishes: everything nib needs at runtime, nothing of the
// repo's own tooling

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { REPO, REPO_PACKAGE } = require('../helpers/env');
const { runOk } = require('../helpers/project');
const { read, listFiles } = require('../helpers/files');

function packedFiles() {
    const res = runOk('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: REPO });
    return JSON.parse(res.stdout)[0].files.map((file) => file.path).sort();
}

describe('npm package', () => {
    const files = packedFiles();

    test('includes the CLI, the tools and the template', () => {
        for (const file of [
            'bin/nibula.js', 'bin/create.js', 'bin/delegate.js', 'tools/commands.js', 'tools/lib/newFlags.js',
            'tools/config/settings.json', 'tools/res/templates/agents/AGENTS.md', '.eleventy.js', 'nginx.conf',
            'src/frontend/layouts/base.njk', 'src/backend/core/index.php', 'src/backend/core/index.js',
            'src/frontend/hosting/.htaccess', 'src/backend/.htaccess', 'LICENSE', 'README.md', 'CHANGELOG.md',
        ]) {
            assert.ok(files.includes(file), `${file} is not in the package`);
        }
    });

    test('leaves out tests, output, dependencies and repo tooling', () => {
        const unwanted = files.filter((file) => /^(test|out|node_modules|\.github|\.claude|docs)\//.test(file) || /(^|\/)vendor\//.test(file));
        assert.deepEqual(unwanted, []);
    });

    test('every local require in bin and tools resolves to a packed file', () => {
        const missing = [];
        for (const file of files.filter((name) => /^(bin|tools)\/.*\.js$/.test(name))) {
            const source = read(path.join(REPO, file));
            for (const [, target] of source.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
                const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
                const candidates = [base, `${base}.js`, `${base}.json`, `${base}/index.js`];
                if (!candidates.some((candidate) => files.includes(candidate))) missing.push(`${file} -> ${target}`);
            }
        }
        assert.deepEqual(missing, []);
    });

    test('every file of the template folders is packed', () => {
        for (const folder of ['src/frontend', 'tools/res/templates']) {
            const source = listFiles(path.join(REPO, folder)).map((file) => `${folder}/${file}`);
            assert.deepEqual(source.filter((file) => !files.includes(file)), [], folder);
        }
    });

    test('the bin entries exist and start with a shebang', () => {
        for (const bin of new Set(Object.values(REPO_PACKAGE.bin))) {
            assert.ok(files.includes(bin), bin);
            assert.match(fs.readFileSync(path.join(REPO, bin), 'utf8'), /^#!\/usr\/bin\/env node/);
        }
    });

    test('nibula has no runtime dependencies for npm to install', () => {
        assert.deepEqual(Object.keys(REPO_PACKAGE.dependencies || {}), []);
    });
});
