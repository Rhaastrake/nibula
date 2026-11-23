// nib rename: every file, the pages.json key and the front matter move to
// the new name, the SEO values stay, and nothing of the old name is left

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { workingCopy, nib, buildProject } = require('../helpers/project');
const { exists, read, frontMatter, snapshot, listFiles } = require('../helpers/files');
const { pageFiles, pagesJson, pageInconsistencies } = require('../helpers/pages');

const combo = currentCombo();

describe(`nib rename: ${combo.id}`, () => {
    let dir;

    before(() => {
        dir = workingCopy(combo, 'cli-rename');
        for (const name of ['old-page', 'other-page']) {
            const res = nib(dir, ['create', name]);
            assert.equal(res.status, 0, res.output);
        }
        const pagesPath = path.join(dir, 'src/frontend/data/pages.json');
        const pages = pagesJson(dir);
        pages.oldPage.seo.description = 'Kept after rename';
        fs.writeFileSync(pagesPath, JSON.stringify(pages, null, 2));
        assert.equal(buildProject(dir).status, 0);
    });

    test('renames every file and the pages.json key', () => {
        const res = nib(dir, ['rename', 'old-page', 'new-page']);
        assert.equal(res.status, 0, res.output);

        const oldFiles = pageFiles(dir, 'old-page', combo.lang);
        const newFiles = pageFiles(dir, 'new-page', combo.lang);
        for (const key of ['route', 'style', 'script']) {
            assert.ok(!exists(oldFiles[key]), `${oldFiles[key]} still exists`);
            assert.ok(exists(newFiles[key]), `missing ${newFiles[key]}`);
        }
        const pages = pagesJson(dir);
        assert.ok(!pages.oldPage);
        assert.ok(pages.newPage);
    });

    test('SEO values are kept', () => {
        assert.equal(pagesJson(dir).newPage.seo.description, 'Kept after rename');
    });

    test('front matter points to the new name', () => {
        const { title, permalink } = frontMatter(pageFiles(dir, 'new-page', combo.lang).route);
        assert.equal(title, 'newPage');
        assert.equal(permalink, '/new-page/');
    });

    test('no source mentions the old name', () => {
        const sources = listFiles(path.join(dir, 'src/frontend'));
        const leftovers = sources.filter((file) => /old-page|oldPage/.test(read(path.join(dir, 'src/frontend', file))));
        assert.deepEqual(leftovers, []);
    });

    test('pages.json stays valid and consistent', () => {
        assert.deepEqual(pageInconsistencies(dir, combo.lang), []);
    });

    test('the build has the new page and not the old one', () => {
        const res = buildProject(dir);
        assert.equal(res.status, 0, res.output);
        assert.ok(exists(path.join(dir, 'out/new-page/index.html')));
        assert.ok(!exists(path.join(dir, 'out/old-page')));
        assert.ok(!exists(path.join(dir, 'out/css/pages/oldPage.css')));
        assert.ok(!exists(path.join(dir, 'out/js/pages/oldPage.js')));
    });

    const REFUSED = [
        ['a page that does not exist', ['rename', 'missing-page', 'something']],
        ['to an existing page', ['rename', 'new-page', 'other-page']],
        ['to the same name', ['rename', 'new-page', 'new-page']],
        ['the homepage', ['rename', 'homepage', 'home']],
        ['the 404 page', ['rename', '404', 'not-found']],
        ['to a reserved name', ['rename', 'new-page', 'api']],
        ['to an invalid name', ['rename', 'new-page', 'bad$name']],
        ['with a missing new name', ['rename', 'new-page']],
        ['with too many names', ['rename', 'new-page', 'a', 'b']],
    ];

    for (const [label, args] of REFUSED) {
        test(`refuses ${label} and changes nothing`, () => {
            const before = snapshot(dir);
            const res = nib(dir, args);
            assert.equal(res.status, 1, res.output);
            assert.deepEqual(snapshot(dir), before);
        });
    }
});
