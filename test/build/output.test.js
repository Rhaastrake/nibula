// npm install and npm run build on a real project (NIBULA_COMBO), then the
// output folder: pages, assets, framework, backend, server configs

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { currentCombo } = require('../helpers/env');
const { builtProject, buildProject } = require('../helpers/project');
const { exists, read, readJson, listFiles, frontMatter } = require('../helpers/files');
const { outputPages, localReferences } = require('../helpers/html');

const combo = currentCombo();

// Footer links to pages each site writes for itself: not in a new project on purpose
const PLACEHOLDER_LINKS = new Set(['/privacy/', '/cookies/', '/terms/']);

describe(`build: ${combo.id}`, () => {
    let dir;
    let out;

    before(() => {
        dir = builtProject(combo);
        out = path.join(dir, 'out');
    });

    test('every page of pages.json is built at its permalink', () => {
        const pages = Object.keys(readJson(path.join(dir, 'src/frontend/data/pages.json')));
        const routes = listFiles(path.join(dir, 'src/frontend/routes'));
        for (const route of routes) {
            const { title, permalink } = frontMatter(path.join(dir, 'src/frontend/routes', route));
            assert.ok(pages.includes(title), `route ${route} has no entry in pages.json`);
            const file = permalink.endsWith('/') ? `${permalink}index.html` : permalink;
            assert.ok(exists(path.join(out, file)), `missing ${file} for ${route}`);
        }
    });

    test('partials are not built as pages', () => {
        const files = listFiles(out);
        assert.deepEqual(files.filter((file) => /json-ld|components\/|layouts\/|indexing\//.test(file)), []);
    });

    test('page CSS and JS exist for every page', () => {
        const pages = Object.keys(readJson(path.join(dir, 'src/frontend/data/pages.json')));
        for (const page of pages) {
            assert.ok(exists(path.join(out, 'css/pages', `${page}.css`)), `missing css/pages/${page}.css`);
            assert.ok(exists(path.join(out, 'js/pages', `${page}.js`)), `missing js/pages/${page}.js`);
        }
        assert.ok(exists(path.join(out, 'css/global.css')));
        assert.ok(exists(path.join(out, 'css/prism.css')));
    });

    test('every local href and src points to a file that exists', () => {
        const broken = [];
        for (const page of outputPages(out)) {
            for (const ref of localReferences(page.doc)) {
                const clean = ref.split(/[?#]/)[0];
                if (PLACEHOLDER_LINKS.has(clean)) continue;
                const target = clean.startsWith('/')
                    ? path.join(out, clean)
                    : path.join(path.dirname(page.file), clean);
                const candidates = clean.endsWith('/') ? [path.join(target, 'index.html')] : [target, `${target}.html`, path.join(target, 'index.html')];
                if (!candidates.some(exists)) broken.push(`${page.url} -> ${ref}`);
            }
        }
        assert.deepEqual(broken, []);
    });

    test(`global.css contains ${combo.css === 'none' ? 'no framework' : combo.css}`, () => {
        const css = read(path.join(out, 'css/global.css'));
        assert.equal(css.includes('--bs-'), combo.css === 'bootstrap', 'Bootstrap variables');
        assert.equal(css.includes('--bulma-'), combo.css === 'bulma', 'Bulma variables');
    });

    test('Bootstrap JS and icon fonts only with Bootstrap', () => {
        const isBootstrap = combo.css === 'bootstrap';
        assert.equal(exists(path.join(out, 'js/bootstrap.bundle.min.js')), isBootstrap);
        assert.equal(exists(path.join(out, 'css/fonts')), isBootstrap);
    });

    test('compiled page scripts are plain JavaScript', () => {
        for (const file of listFiles(path.join(out, 'js/pages'))) {
            const res = require('child_process').spawnSync(process.execPath, ['--check', path.join(out, 'js/pages', file)], { encoding: 'utf8' });
            assert.equal(res.status, 0, `${file}: ${res.stderr}`);
        }
    });

    test('assets and server configs are copied', () => {
        for (const file of ['assets/brand/og-image.png', 'assets/brand/favicon.svg', 'assets/brand/logo.svg', '.htaccess', 'web.config']) {
            assert.ok(exists(path.join(out, file)), `missing ${file}`);
        }
        assert.equal(read(path.join(out, '.htaccess')), read(path.join(dir, 'src/frontend/hosting/.htaccess')));
        assert.equal(read(path.join(out, 'web.config')), read(path.join(dir, 'src/frontend/hosting/web.config')));
    });

    test('indexing files are generated', () => {
        for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
            assert.ok(exists(path.join(out, file)), `missing ${file}`);
        }
    });

    test(`backend in the output: ${combo.backend}`, () => {
        const backend = path.join(out, 'backend');
        if (combo.backend === 'none') {
            assert.ok(!exists(backend));
            return;
        }
        const entry = combo.backend === 'node' ? 'core/index.js' : 'core/index.php';
        assert.ok(exists(path.join(backend, entry)), `missing backend/${entry}`);
        assert.ok(exists(path.join(backend, '.htaccess')));
        assert.ok(exists(path.join(backend, 'web.config')));
        const sources = listFiles(path.join(dir, 'src/backend'), { skip: ['.git'] });
        const copied = listFiles(backend, { skip: ['.git'] });
        assert.deepEqual(sources.filter((file) => !copied.includes(file)), [], 'files missing from out/backend');
    });

    test('nothing named .git ends up in the output', () => {
        const files = listFiles(out, { skip: [] });
        assert.deepEqual(files.filter((file) => /(^|\/)\.git(\/|$)/.test(file)), []);
    });

    test('a second build gives the same files', () => {
        const first = listFiles(out, { skip: [] });
        const res = buildProject(dir);
        assert.equal(res.status, 0, res.output);
        assert.deepEqual(listFiles(out, { skip: [] }), first);
    });
});
