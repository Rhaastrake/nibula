// sitemap.xml, llms.txt and robots.txt of the built site

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { currentCombo } = require('../helpers/env');
const { builtProject } = require('../helpers/project');
const { read, readJson, frontMatter, listFiles } = require('../helpers/files');

const combo = currentCombo();

describe(`indexing files: ${combo.id}`, () => {
    let dir;
    let out;
    let site;
    let routes;

    before(() => {
        dir = builtProject(combo);
        out = path.join(dir, 'out');
        site = readJson(path.join(dir, 'src/frontend/data/site.json'));
        const pagesData = readJson(path.join(dir, 'src/frontend/data/pages.json'));
        routes = listFiles(path.join(dir, 'src/frontend/routes')).map((file) => {
            const { title, permalink } = frontMatter(path.join(dir, 'src/frontend/routes', file));
            return { title, url: `${site.url}${permalink}`, noindex: Boolean(pagesData[title]?.seo?.noindex), seo: pagesData[title]?.seo };
        });
    });

    function sitemapUrls() {
        const xml = read(path.join(out, 'sitemap.xml'));
        const data = new XMLParser().parse(xml);
        const entries = [data.urlset.url].flat().filter(Boolean);
        return entries.map((entry) => entry.loc);
    }

    test('sitemap.xml is well-formed XML with the sitemap namespace', () => {
        const xml = read(path.join(out, 'sitemap.xml'));
        assert.equal(XMLValidator.validate(xml.trim()), true);
        assert.match(xml, /^<\?xml/, 'the XML declaration must be the very first thing');
        assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    });

    test('sitemap lists every indexable page and no noindex page', () => {
        const urls = sitemapUrls();
        for (const route of routes) {
            assert.equal(urls.includes(route.url), !route.noindex, `${route.url} (noindex: ${route.noindex})`);
        }
    });

    test('sitemap URLs are absolute and unique', () => {
        const urls = sitemapUrls();
        for (const url of urls) assert.match(url, /^https?:\/\//);
        assert.equal(new Set(urls).size, urls.length);
    });

    test('llms.txt lists every indexable page and no noindex page', () => {
        const llms = read(path.join(out, 'llms.txt'));
        for (const route of routes) {
            assert.equal(llms.includes(`](${route.url})`), !route.noindex, `${route.url} (noindex: ${route.noindex})`);
        }
    });

    test('llms.txt has the site name, description, language and copyright', () => {
        const llms = read(path.join(out, 'llms.txt'));
        assert.match(llms, new RegExp(`^# ${site.siteName}`, 'm'));
        assert.ok(llms.includes(`> ${site.description}`));
        assert.ok(llms.includes(`- Language: ${site.lang}`));
        assert.ok(llms.includes(`- Copyright: © ${site.copyright.year} ${site.siteName}. ${site.copyright.text}`));
    });

    test('robots.txt allows crawling and points at the sitemap', () => {
        const robots = read(path.join(out, 'robots.txt'));
        assert.ok(robots.includes(`Sitemap: ${site.url}/sitemap.xml`));
        assert.match(robots, /^User-agent: \*$/m);
        assert.match(robots, /^Disallow:\s*$/m);
    });
});
