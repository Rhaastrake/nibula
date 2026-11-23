// CHANGELOG.md agrees with package.json and keeps its format: the newest
// dated release is the current version, undated releases (??) sit on top

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { REPO, REPO_PACKAGE } = require('../helpers/env');
const { read } = require('../helpers/files');

const SECTION = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2}|\?\?)$/;
// Keep a Changelog kinds, plus Breaking, Migration and Notes used by majors
const KINDS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security', 'Breaking', 'Migration', 'Notes'];

function sections() {
    const lines = read(path.join(REPO, 'CHANGELOG.md')).split(/\r?\n/);
    const result = [];
    for (const line of lines) {
        if (line.startsWith('## ')) {
            const match = line.match(SECTION);
            assert.ok(match, `malformed release heading: ${line}`);
            result.push({ version: match[1], date: match[2], kinds: [] });
        } else if (line.startsWith('### ') && result.length) {
            result[result.length - 1].kinds.push(line.slice(4));
        }
    }
    return result;
}

function compare(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
}

describe('CHANGELOG.md', () => {
    const all = sections();

    test('the newest dated release is the package.json version', () => {
        const dated = all.find((section) => section.date !== '??');
        assert.equal(dated.version, REPO_PACKAGE.version);
    });

    test('undated releases come only before the dated ones', () => {
        const firstDated = all.findIndex((section) => section.date !== '??');
        assert.deepEqual(all.slice(firstDated).filter((section) => section.date === '??').map((s) => s.version), []);
    });

    test('versions go down, without repeats', () => {
        for (let i = 1; i < all.length; i++) {
            assert.ok(compare(all[i - 1].version, all[i].version) > 0, `${all[i - 1].version} should be newer than ${all[i].version}`);
        }
    });

    test('dates never go up', () => {
        const dated = all.filter((section) => section.date !== '??');
        for (let i = 1; i < dated.length; i++) {
            assert.ok(dated[i - 1].date >= dated[i].date, `${dated[i - 1].version} is dated before ${dated[i].version}`);
        }
    });

    test('every release has at least one standard subsection', () => {
        for (const section of all) {
            assert.ok(section.kinds.length > 0, `${section.version} has no ### subsection`);
            for (const kind of section.kinds) assert.ok(KINDS.includes(kind), `${section.version}: unknown subsection "${kind}"`);
        }
    });
});
