// Values set in pages.json reach the built page: title, description,
// keywords, canonical and noindex

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { workingCopy, nib, buildProject } = require('../helpers/project');
const { read, readJson } = require('../helpers/files');
const { loadPage, meta, linkHref, jsonLdBlocks } = require('../helpers/html');

const combo = currentCombo();

describe(`SEO overrides: ${combo.id}`, () => {
    let out;
    let site;

    before(() => {
        const dir = workingCopy(combo, 'seo-overrides');
        for (const name of ['about-us', 'secret']) {
            const res = nib(dir, ['create', name]);
            assert.equal(res.status, 0, res.output);
        }

        const pagesPath = path.join(dir, 'src/frontend/data/pages.json');
        const pages = readJson(pagesPath);
        pages.aboutUs.seo = { ...pages.aboutUs.seo, title: 'About us', description: 'Who we are', keywords: 'team, history', canonical: 'https://example.org/about' };
        pages.secret.seo = { ...pages.secret.seo, noindex: true };
        fs.writeFileSync(pagesPath, JSON.stringify(pages, null, 2));

        const res = buildProject(dir);
        assert.equal(res.status, 0, res.output);
        out = path.join(dir, 'out');
        site = readJson(path.join(dir, 'src/frontend/data/site.json'));
    });

    test('title, description and keywords come from pages.json', () => {
        const doc = loadPage(path.join(out, 'about-us/index.html'));
        assert.equal(doc.querySelector('title').text, 'About us');
        assert.equal(meta(doc, 'description'), 'Who we are');
        assert.equal(meta(doc, 'keywords'), 'team, history');
        assert.equal(meta(doc, 'og:title'), 'About us');
    });

    test('no keywords meta when keywords is empty', () => {
        const doc = loadPage(path.join(out, 'index.html'));
        assert.equal(meta(doc, 'keywords'), undefined);
    });

    test('a custom canonical is used everywhere', () => {
        const doc = loadPage(path.join(out, 'about-us/index.html'));
        assert.equal(linkHref(doc, 'canonical'), 'https://example.org/about');
        assert.equal(meta(doc, 'og:url'), 'https://example.org/about');
        const webpage = JSON.parse(jsonLdBlocks(doc)[0])['@graph'][1];
        assert.equal(webpage.url, 'https://example.org/about');
    });

    test('a noindex page has the robots meta and is left out of sitemap and llms.txt', () => {
        const doc = loadPage(path.join(out, 'secret/index.html'));
        assert.equal(meta(doc, 'robots'), 'noindex, follow');
        assert.ok(!read(path.join(out, 'sitemap.xml')).includes(`${site.url}/secret/`));
        assert.ok(!read(path.join(out, 'llms.txt')).includes(`${site.url}/secret/`));
    });

    test('llms.txt uses the page title and description', () => {
        assert.ok(read(path.join(out, 'llms.txt')).includes(`- [About us](${site.url}/about-us/): Who we are`));
    });

    test('the new indexable page is in the sitemap', () => {
        assert.ok(read(path.join(out, 'sitemap.xml')).includes(`<loc>${site.url}/about-us/</loc>`));
    });
});
