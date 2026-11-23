// JS or TS: each project gets the files of its language, in the right
// folders, and none of the other one

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ALL_COMBOS, REPO } = require('../helpers/env');
const { scaffoldOnce } = require('../helpers/project');
const { exists, readJson, listFiles } = require('../helpers/files');

const FRONTEND = 'src/frontend';

const EXPECTED = {
    js: {
        folder: 'js',
        other: 'ts',
        files: ['js/global.js', 'js/pages/homepage.js', 'js/pages/404.js', 'js/modules/exampleModule.js'],
    },
    ts: {
        folder: 'ts',
        other: 'js',
        files: ['ts/global.ts', 'ts/pages/homepage.ts', 'ts/pages/404.ts', 'ts/modules/exampleModule.ts'],
    },
};

for (const combo of ALL_COMBOS) {
    describe(`languages: ${combo.id}`, () => {
        const dir = scaffoldOnce(combo);
        const expected = EXPECTED[combo.lang];
        const pkg = readJson(path.join(dir, 'package.json'));

        test(`has the ${combo.lang} files`, () => {
            for (const file of expected.files) {
                assert.ok(exists(path.join(dir, FRONTEND, file)), `missing ${FRONTEND}/${file}`);
            }
        });

        test(`has no ${expected.other} folder or files`, () => {
            assert.ok(!exists(path.join(dir, FRONTEND, expected.other)), `${FRONTEND}/${expected.other} should not exist`);
            const strays = listFiles(path.join(dir, FRONTEND)).filter((file) => file.endsWith(`.${expected.other}`));
            assert.deepEqual(strays, []);
        });

        test('every page has a script in the language folder', () => {
            const pages = Object.keys(readJson(path.join(dir, FRONTEND, 'data/pages.json')));
            for (const page of pages) {
                const script = path.join(dir, FRONTEND, expected.folder, 'pages', `${page}.${combo.lang}`);
                assert.ok(exists(script), `missing script for page ${page}`);
            }
        });

        test('every other template file of src/frontend is copied', () => {
            const templateFiles = listFiles(path.join(REPO, FRONTEND))
                .filter((file) => !file.startsWith(`${expected.other}/`));
            const missing = templateFiles.filter((file) => !exists(path.join(dir, FRONTEND, file)));
            assert.deepEqual(missing, []);
        });

        test('tsconfig.json and typescript only for TS', () => {
            assert.equal(exists(path.join(dir, 'tsconfig.json')), combo.lang === 'ts');
            assert.equal('typescript' in pkg.devDependencies, combo.lang === 'ts');
        });

        test('build scripts point at the language folder', () => {
            const entries = `src/frontend/${expected.folder}/pages/*.${combo.lang}`;
            assert.ok(pkg.scripts['build:js'].includes(entries), pkg.scripts['build:js']);
            assert.ok(pkg.scripts['serve:js'].includes(entries), pkg.scripts['serve:js']);
        });
    });
}
