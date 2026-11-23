// Bootstrap, Bulma or none: create.js comments and uncomments lines in three
// files. Each framework line must be on or off as chosen, and every other
// line must stay exactly as in the template.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ALL_COMBOS, REPO } = require('../helpers/env');
const { scaffoldOnce, run } = require('../helpers/project');
const { read } = require('../helpers/files');

const SLASH = (code) => `// ${code}`;
const NJK = (code) => `{# ${code} #}`;

// The lines create.js switches, per file and per framework
const FILES = [
    {
        file: 'src/frontend/scss/global.scss',
        comment: SLASH,
        lines: {
            bootstrap: ['@import "modules/frameworks/bootstrap";'],
            bulma:     ['@import "modules/frameworks/bulma";'],
        },
    },
    {
        file: 'src/frontend/layouts/base.njk',
        comment: NJK,
        lines: {
            bootstrap: [`<script src="{{ '/js/bootstrap.bundle.min.js' | url }}" defer></script>`],
            bulma:     [],
        },
    },
    {
        file: '.eleventy.js',
        comment: SLASH,
        lines: {
            bootstrap: [
                '"node_modules/bootstrap/dist/js/bootstrap.bundle.min.js": "js/bootstrap.bundle.min.js",',
                '"node_modules/bootstrap-icons/font/fonts": "css/fonts",',
            ],
            bulma: [],
        },
    },
];

function lines(text) {
    return text.split(/\r?\n/);
}

// Combos that differ only in the framework are enough: language and backend
// do not touch these files
const COMBOS = ALL_COMBOS.filter((combo) => combo.backend === 'none' || combo.lang === 'ts');

for (const combo of COMBOS) {
    describe(`frameworks: ${combo.id}`, () => {
        const dir = scaffoldOnce(combo);

        for (const { file, comment, lines: frameworkLines } of FILES) {
            const generated = lines(read(path.join(dir, file)));
            const template = lines(read(path.join(REPO, file)));
            const allCodes = Object.values(frameworkLines).flat();

            for (const [framework, codes] of Object.entries(frameworkLines)) {
                for (const code of codes) {
                    const shouldBeOn = framework === combo.css;
                    test(`${file}: ${framework} line is ${shouldBeOn ? 'on' : 'off'}`, () => {
                        const matches = generated.filter((line) => line.includes(code));
                        assert.equal(matches.length, 1, `expected the line once:\n${code}`);
                        const expected = shouldBeOn ? code : comment(code);
                        assert.equal(matches[0].trim(), expected);
                    });
                }
            }

            test(`${file}: no other line changed`, () => {
                assert.equal(generated.length, template.length, 'line count differs from the template');
                const changed = generated
                    .map((line, index) => ({ line, original: template[index], number: index + 1 }))
                    .filter(({ line, original }) => line !== original)
                    .filter(({ line }) => !allCodes.some((code) => line.includes(code)));
                assert.deepEqual(changed, []);
            });
        }

        test('.eleventy.js is still valid JavaScript', () => {
            const res = run(process.execPath, ['--check', path.join(dir, '.eleventy.js')]);
            assert.equal(res.status, 0, res.output);
        });
    });
}
