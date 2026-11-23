// SEO tags in the <head> of every built page

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { builtProject } = require('../helpers/project');
const { exists, readJson } = require('../helpers/files');
const { outputPages, meta, linkHref } = require('../helpers/html');

const combo = currentCombo();

describe(`SEO meta: ${combo.id}`, () => {
    let out;
    let site;
    let pagesData;
    let pages;

    before(() => {
        const dir = builtProject(combo);
        out = path.join(dir, 'out');
        site = readJson(path.join(dir, 'src/frontend/data/site.json'));
        pagesData = readJson(path.join(dir, 'src/frontend/data/pages.json'));
        pages = outputPages(out);
    });

    // The pages.json entry of a built page, found through its <title>
    function entryFor(page) {
        const title = page.doc.querySelector('title').text;
        const key = Object.keys(pagesData).find((name) => (pagesData[name].seo.title || name) === title);
        assert.ok(key, `no pages.json entry for "${title}" (${page.url})`);
        return pagesData[key];
    }

    test('html lang and theme come from site.json', () => {
        for (const page of pages) {
            const html = page.doc.querySelector('html');
            assert.equal(html.getAttribute('lang'), site.lang, page.url);
            assert.equal(html.getAttribute('data-theme'), site.theme, page.url);
            assert.equal(html.getAttribute('data-bs-theme'), site.theme, page.url);
        }
    });

    test('title and description are never empty', () => {
        for (const page of pages) {
            assert.ok(page.doc.querySelector('title').text.trim(), `empty title on ${page.url}`);
            assert.ok((meta(page.doc, 'description') || '').trim(), `empty description on ${page.url}`);
        }
    });

    test('title and description come from pages.json, or site.json as fallback', () => {
        for (const page of pages) {
            const entry = entryFor(page);
            assert.equal(meta(page.doc, 'description'), entry.seo.description || site.description, page.url);
            assert.equal(meta(page.doc, 'og:title'), page.doc.querySelector('title').text, page.url);
            assert.equal(meta(page.doc, 'twitter:title'), page.doc.querySelector('title').text, page.url);
            assert.equal(meta(page.doc, 'og:description'), meta(page.doc, 'description'), page.url);
            assert.equal(meta(page.doc, 'twitter:description'), meta(page.doc, 'description'), page.url);
        }
    });

    test('canonical and og:url are absolute and point at the page', () => {
        for (const page of pages) {
            const entry = entryFor(page);
            const canonical = linkHref(page.doc, 'canonical');
            const expected = entry.seo.canonical || `${site.url}${page.url}`;
            assert.equal(canonical, expected, page.url);
            assert.match(canonical, /^https?:\/\//);
            assert.equal(meta(page.doc, 'og:url'), canonical, page.url);
        }
    });

    test('og:image and twitter:image are absolute and the image exists', () => {
        assert.ok(exists(path.join(out, 'assets/brand/og-image.png')));
        for (const page of pages) {
            const image = `${site.url}/assets/brand/og-image.png`;
            assert.equal(meta(page.doc, 'og:image'), image, page.url);
            assert.equal(meta(page.doc, 'twitter:image'), image, page.url);
            assert.equal(meta(page.doc, 'og:image:width'), '1200');
            assert.equal(meta(page.doc, 'og:image:height'), '630');
            assert.ok(meta(page.doc, 'og:image:alt'));
            assert.ok(meta(page.doc, 'twitter:image:alt'));
            assert.equal(meta(page.doc, 'twitter:card'), 'summary_large_image');
            assert.equal(meta(page.doc, 'og:site_name'), site.siteName);
        }
    });

    test('noindex pages, and only those, have the robots meta', () => {
        for (const page of pages) {
            const entry = entryFor(page);
            const robots = meta(page.doc, 'robots');
            if (entry.seo.noindex) assert.equal(robots, 'noindex, follow', page.url);
            else assert.equal(robots, undefined, page.url);
        }
    });

    test('favicons point to files that exist', () => {
        for (const page of pages) {
            for (const node of page.doc.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')) {
                assert.ok(exists(path.join(out, node.getAttribute('href'))), node.getAttribute('href'));
            }
        }
    });
});
