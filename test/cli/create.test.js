// nib create: files, pages.json entry, front matter, build; and every name
// that must be refused without touching the project

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { workingCopy, nib, buildProject } = require('../helpers/project');
const { exists, read, frontMatter, snapshot } = require('../helpers/files');
const { pageFiles, pagesJson, pageInconsistencies } = require('../helpers/pages');

const combo = currentCombo();

describe(`nib create: ${combo.id}`, () => {
    let dir;

    before(() => {
        dir = workingCopy(combo, 'cli-create');
    });

    test('creates route, style, script and pages.json entry', () => {
        const res = nib(dir, ['create', 'about-us']);
        assert.equal(res.status, 0, res.output);

        const files = pageFiles(dir, 'about-us', combo.lang);
        for (const file of [files.route, files.style, files.script]) assert.ok(exists(file), `missing ${file}`);

        const entry = pagesJson(dir).aboutUs;
        assert.ok(entry, 'no aboutUs in pages.json');
        assert.deepEqual(Object.keys(entry.seo).sort(), ['canonical', 'description', 'keywords', 'noindex', 'title']);
        assert.deepEqual(entry.cdn, { css: [], js: [] });
    });

    test('front matter has the camelCase title, permalink and layout', () => {
        const { title, permalink, layout } = frontMatter(pageFiles(dir, 'about-us', combo.lang).route);
        assert.equal(title, 'aboutUs');
        assert.equal(permalink, '/about-us/');
        assert.equal(layout, 'base.njk');
    });

    test('-l picks the layout', () => {
        const res = nib(dir, ['create', 'contact', '-l', 'base']);
        assert.equal(res.status, 0, res.output);
        assert.equal(frontMatter(pageFiles(dir, 'contact', combo.lang).route).layout, 'base.njk');
    });

    test('uppercase and underscores become kebab-case', () => {
        const res = nib(dir, ['create', 'Our_Team']);
        assert.equal(res.status, 0, res.output);
        assert.ok(exists(pageFiles(dir, 'our-team', combo.lang).route));
        assert.ok(pagesJson(dir).ourTeam);
    });

    test('pages.json stays valid and consistent', () => {
        assert.deepEqual(pageInconsistencies(dir, combo.lang), []);
    });

    test('the new pages build, with their CSS and JS', () => {
        const res = buildProject(dir);
        assert.equal(res.status, 0, res.output);
        for (const [slug, camel] of [['about-us', 'aboutUs'], ['contact', 'contact'], ['our-team', 'ourTeam']]) {
            assert.ok(exists(path.join(dir, 'out', slug, 'index.html')), `missing out/${slug}/index.html`);
            assert.ok(exists(path.join(dir, 'out/css/pages', `${camel}.css`)));
            assert.ok(exists(path.join(dir, 'out/js/pages', `${camel}.js`)));
        }
        const html = read(path.join(dir, 'out/about-us/index.html'));
        assert.ok(html.includes('/css/pages/aboutUs.css'));
        assert.ok(html.includes('/js/pages/aboutUs.js'));
    });

    const REFUSED = [
        ['a name with spaces', ['create', 'about us']],
        ['a quoted name with spaces', ['create', 'about us page']],
        ['accented letters', ['create', 'perché']],
        ['symbols', ['create', 'a$b']],
        ['a leading digit', ['create', '1page']],
        ['a protected name', ['create', 'homepage']],
        ['the 404 page', ['create', '404']],
        ['a reserved name', ['create', 'api']],
        ['another reserved name', ['create', 'assets']],
        ['an existing page', ['create', 'about-us']],
        ['a name with the same camelCase', ['create', 'about_us']],
        ['a missing name', ['create']],
        ['an unknown layout', ['create', 'blog', '-l', 'nope']],
        ['an unknown option', ['create', 'blog', '--nope']],
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
