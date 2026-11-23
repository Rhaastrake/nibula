// The two web.config files for IIS. IIS cannot run on the test machines, so
// the rules are read and their patterns applied the way URL Rewrite would:
// first matching rule with stopProcessing wins, URLs without the leading slash.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { REPO } = require('../helpers/env');
const { read } = require('../helpers/files');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => ['rule', 'error', 'remove'].includes(name) });

function loadConfig(file) {
    const xml = read(path.join(REPO, file));
    const valid = XMLValidator.validate(xml);
    assert.equal(valid, true, JSON.stringify(valid));
    return parser.parse(xml).configuration['system.webServer'];
}

// The first rule whose pattern matches the URL, as URL Rewrite picks it
function firstRule(rules, url) {
    return rules.find((rule) => new RegExp(rule.match.url, rule.match.ignoreCase === 'true' ? 'i' : '').test(url));
}

describe('IIS: site web.config', () => {
    const config = loadConfig('src/frontend/hosting/web.config');
    const rules = config.rewrite.rules.rule;

    for (const url of ['web.config', 'WEB.CONFIG', '.htaccess', '.git/config', '.env']) {
        test(`blocks ${url} with a 404`, () => {
            const rule = firstRule(rules, url);
            assert.ok(rule, `no rule matches ${url}`);
            assert.equal(rule.action.type, 'CustomResponse');
            assert.equal(rule.action.statusCode, '404');
        });
    }

    test('/api goes to the PHP front controller by default', () => {
        const rule = firstRule(rules, 'api/example-public');
        assert.equal(rule.name, 'ApiToPhp');
        assert.equal(rule.action.type, 'Rewrite');
        assert.equal(rule.action.url, 'backend/core/index.php');
        assert.equal(rule.action.appendQueryString, 'true');
    });

    test('the front controller it points to exists in the template', () => {
        assert.ok(read(path.join(REPO, 'src/backend/core/index.php')));
    });

    test('the Node rule is present but commented out', () => {
        const xml = read(path.join(REPO, 'src/frontend/hosting/web.config'));
        assert.match(xml, /<!--[\s\S]*name="ApiToNode"[\s\S]*-->/);
        assert.ok(!rules.some((rule) => rule.name === 'ApiToNode'));
    });

    test('normal pages are not caught by any blocking rule', () => {
        for (const url of ['', 'about-us/', 'css/global.css', 'assets/brand/logo.svg', 'sitemap.xml']) {
            const rule = firstRule(rules, url);
            assert.ok(!rule || rule.action.type !== 'CustomResponse', `${url} would be blocked by ${rule && rule.name}`);
        }
    });

    test('rules stop processing once matched', () => {
        for (const rule of rules) assert.equal(rule.stopProcessing, 'true', rule.name);
    });

    test('no directory browsing', () => {
        assert.equal(config.directoryBrowse.enabled, 'false');
    });

    test('404 and 403 show the site 404 page', () => {
        const errors = config.httpErrors.error;
        for (const code of ['404', '403']) {
            const entry = errors.find((error) => error.statusCode === code);
            assert.ok(entry, `no error page for ${code}`);
            assert.equal(entry.path, '/404.html');
        }
    });
});

describe('IIS: backend web.config', () => {
    const config = loadConfig('src/backend/web.config');
    const rules = config.rewrite.rules.rule;

    test('the front controller itself passes through', () => {
        const rule = firstRule(rules, 'core/index.php');
        assert.equal(rule.action.type, 'None');
    });

    for (const url of ['config.php', 'core/init.php', 'core/vendor/autoload.php', 'endpoints/public/example-public.php', 'database/migrations/create_example_db.sql', '.htaccess']) {
        test(`${url} is answered by the front controller, never served`, () => {
            const rule = firstRule(rules, url);
            assert.equal(rule.action.type, 'Rewrite', `${url} matched ${rule && rule.name}`);
            assert.equal(rule.action.url, 'core/index.php');
        });
    }

    test('API errors keep their JSON body', () => {
        assert.equal(config.httpErrors.existingResponse, 'PassThrough');
    });

    test('no directory browsing', () => {
        assert.equal(config.directoryBrowse.enabled, 'false');
    });
});
