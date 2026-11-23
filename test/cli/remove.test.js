// nib remove: files and pages.json entry go away, the build no longer has
// the page; protected pages and a missing confirmation are refused

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { workingCopy, nib, buildProject } = require('../helpers/project');
const { exists, snapshot } = require('../helpers/files');
const { pageFiles, pagesJson, pageInconsistencies } = require('../helpers/pages');

const combo = currentCombo();

describe(`nib remove: ${combo.id}`, () => {
    let dir;

    before(() => {
        dir = workingCopy(combo, 'cli-remove');
        for (const name of ['gone-page', 'kept-page']) {
            const res = nib(dir, ['create', name]);
            assert.equal(res.status, 0, res.output);
        }
        assert.equal(buildProject(dir).status, 0);
    });

    test('without -y and without a terminal it refuses and changes nothing', () => {
        const before = snapshot(dir);
        const res = nib(dir, ['remove', 'gone-page']);
        assert.equal(res.status, 1, res.output);
        assert.deepEqual(snapshot(dir), before);
    });

    test('with -y it removes every file and the pages.json entry', () => {
        const res = nib(dir, ['remove', 'gone-page', '-y']);
        assert.equal(res.status, 0, res.output);
        const files = pageFiles(dir, 'gone-page', combo.lang);
        for (const key of ['route', 'style', 'script']) assert.ok(!exists(files[key]), `${files[key]} still exists`);
        assert.ok(!pagesJson(dir).gonePage);
    });

    test('other pages are untouched', () => {
        const files = pageFiles(dir, 'kept-page', combo.lang);
        for (const key of ['route', 'style', 'script']) assert.ok(exists(files[key]));
        assert.ok(pagesJson(dir).keptPage);
    });

    test('pages.json stays valid and consistent', () => {
        assert.deepEqual(pageInconsistencies(dir, combo.lang), []);
    });

    test('the build no longer has the page', () => {
        const res = buildProject(dir);
        assert.equal(res.status, 0, res.output);
        assert.ok(!exists(path.join(dir, 'out/gone-page')));
        assert.ok(!exists(path.join(dir, 'out/css/pages/gonePage.css')));
        assert.ok(!exists(path.join(dir, 'out/js/pages/gonePage.js')));
        assert.ok(exists(path.join(dir, 'out/kept-page/index.html')));
    });

    const REFUSED = [
        ['a page that does not exist', ['remove', 'missing-page', '-y']],
        ['the homepage', ['remove', 'homepage', '-y']],
        ['the 404 page', ['remove', '404', '-y']],
        ['a missing name', ['remove', '-y']],
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
