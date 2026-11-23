// nib path: the output folder moves, every file that names it is updated,
// the build goes there, and folders that would be emptied by mistake are refused

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { workingCopy, nib, buildProject } = require('../helpers/project');
const { exists, read, readJson, readJsonc, snapshot } = require('../helpers/files');

const combo = currentCombo();

function outputDir(dir) {
    return read(path.join(dir, '.eleventy.js')).match(/const OUTPUT_DIR = "([^"]*)";/)[1];
}

describe(`nib path: ${combo.id}`, () => {
    let dir;
    let name;

    before(() => {
        dir = workingCopy(combo, 'cli-path');
        name = path.basename(dir);
    });

    test('without a folder it shows the current one and changes nothing', () => {
        const before = snapshot(dir);
        const res = nib(dir, ['path']);
        assert.equal(res.status, 0, res.output);
        assert.deepEqual(snapshot(dir), before);
    });

    test('moves the output and updates every file that names it', () => {
        const res = nib(dir, ['path', '../moved']);
        assert.equal(res.status, 0, res.output);
        const expected = `../moved/${name}-out`;

        assert.equal(outputDir(dir), expected);
        const pkg = readJson(path.join(dir, 'package.json'));
        assert.equal(pkg.outputDir, expected);
        for (const script of ['build:css', 'serve:css']) assert.ok(pkg.scripts[script].includes(`${expected}/css`), pkg.scripts[script]);
        for (const script of ['build:js', 'serve:js']) assert.ok(pkg.scripts[script].includes(`${expected}/js/pages`), pkg.scripts[script]);
        if (combo.lang === 'ts') {
            const tsconfig = readJsonc(path.join(dir, 'tsconfig.json'));
            assert.equal(path.posix.normalize(tsconfig.compilerOptions.outDir), `${expected}/ts`);
        }
    });

    test('the old output folder is removed', () => {
        assert.ok(!exists(path.join(dir, 'out')));
    });

    test('the build writes to the new folder', () => {
        const res = buildProject(dir);
        assert.equal(res.status, 0, res.output);
        const target = path.resolve(dir, `../moved/${name}-out`);
        for (const file of ['index.html', 'css/global.css', 'js/pages/homepage.js', 'sitemap.xml']) {
            assert.ok(exists(path.join(target, file)), `missing ${file} in ${target}`);
        }
        assert.ok(!exists(path.join(dir, 'out')));
    });

    test('nib clean empties the new folder only', () => {
        const res = nib(dir, ['clean']);
        assert.equal(res.status, 0, res.output);
        assert.ok(!exists(path.resolve(dir, `../moved/${name}-out`)));
        assert.ok(exists(path.join(dir, 'src')));
    });

    test('"." restores the default folder', () => {
        const res = nib(dir, ['path', '.']);
        assert.equal(res.status, 0, res.output);
        assert.equal(outputDir(dir), 'out');
        assert.equal(readJson(path.join(dir, 'package.json')).outputDir, 'out');
        assert.equal(buildProject(dir).status, 0);
        assert.ok(exists(path.join(dir, 'out/index.html')));
    });

    const REFUSED = [
        ['inside src', 'src'],
        ['inside node_modules', 'node_modules'],
        ['inside .git', '.git'],
        ['a path with spaces', 'my folder'],
        ['a path with shell characters', 'out;rm'],
        ['a path with quotes', '"out"'],
    ];

    for (const [label, folder] of REFUSED) {
        test(`refuses ${label} and changes nothing`, () => {
            const before = snapshot(dir);
            const res = nib(dir, ['path', folder]);
            assert.equal(res.status, 1, res.output);
            assert.deepEqual(snapshot(dir), before);
            assert.ok(exists(path.join(dir, 'src/frontend')));
        });
    }

    test('nib clean refuses an output folder that is the project', () => {
        const pkgPath = path.join(dir, 'package.json');
        const pkg = readJson(pkgPath);
        const original = JSON.stringify(pkg, null, 2);
        pkg.outputDir = '.';
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        try {
            nib(dir, ['clean']);
            assert.ok(exists(path.join(dir, 'src/frontend')), 'the project was emptied');
        } finally {
            fs.writeFileSync(pkgPath, original);
        }
    });
});
