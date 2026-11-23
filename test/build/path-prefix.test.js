// A site published under a subfolder (Eleventy pathPrefix): every internal
// link and asset must carry the prefix, through the | url filter

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { workingCopy, run } = require('../helpers/project');
const { outputPages, localReferences } = require('../helpers/html');

const combo = currentCombo();
const PREFIX = '/sub/';

describe(`path prefix: ${combo.id}`, () => {
    let pages;

    before(() => {
        const dir = workingCopy(combo, 'path-prefix');
        const res = run('npx', ['@11ty/eleventy', `--pathprefix=${PREFIX}`, '--quiet'], { cwd: dir });
        assert.equal(res.status, 0, res.output);
        pages = outputPages(path.join(dir, 'out'));
    });

    test('every root-relative link and asset starts with the prefix', () => {
        const missing = [];
        for (const page of pages) {
            for (const ref of localReferences(page.doc)) {
                if (ref.startsWith('/') && !ref.startsWith(PREFIX)) missing.push(`${page.url} -> ${ref}`);
            }
        }
        assert.deepEqual(missing, []);
    });
});
