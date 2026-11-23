// JSON-LD of every built page: valid JSON, and a WebSite + WebPage graph
// that agrees with the rest of the <head>

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { builtProject } = require('../helpers/project');
const { readJson } = require('../helpers/files');
const { outputPages, jsonLdBlocks, linkHref, meta } = require('../helpers/html');

const combo = currentCombo();

describe(`JSON-LD: ${combo.id}`, () => {
    let site;
    let pages;

    before(() => {
        const dir = builtProject(combo);
        site = readJson(path.join(dir, 'src/frontend/data/site.json'));
        pages = outputPages(path.join(dir, 'out'));
    });

    function graphOf(page) {
        const blocks = jsonLdBlocks(page.doc);
        assert.equal(blocks.length, 1, `${page.url} should have one JSON-LD block`);
        return JSON.parse(blocks[0]);
    }

    test('one block per page, and it is valid JSON', () => {
        for (const page of pages) graphOf(page);
    });

    test('a WebSite and a WebPage node', () => {
        for (const page of pages) {
            const data = graphOf(page);
            assert.equal(data['@context'], 'https://schema.org');
            assert.deepEqual(data['@graph'].map((node) => node['@type']), ['WebSite', 'WebPage']);
        }
    });

    test('WebSite describes the site', () => {
        for (const page of pages) {
            const [website] = graphOf(page)['@graph'];
            assert.equal(website['@id'], `${site.url}/#website`);
            assert.equal(website.name, site.siteName);
            assert.equal(website.url, `${site.url}/`);
            assert.equal(website.inLanguage, site.lang);
        }
    });

    test('WebPage agrees with the page head and links to the WebSite', () => {
        for (const page of pages) {
            const [website, webpage] = graphOf(page)['@graph'];
            assert.equal(webpage.name, page.doc.querySelector('title').text, page.url);
            assert.equal(webpage.description, meta(page.doc, 'description'), page.url);
            assert.equal(webpage.url, linkHref(page.doc, 'canonical'), page.url);
            assert.equal(webpage.inLanguage, site.lang);
            assert.deepEqual(webpage.isPartOf, { '@id': website['@id'] });
        }
    });

    test('no author or publisher left over', () => {
        for (const page of pages) {
            for (const node of graphOf(page)['@graph']) {
                assert.ok(!('author' in node) && !('publisher' in node), page.url);
            }
        }
    });
});
