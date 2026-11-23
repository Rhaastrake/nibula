// Every JavaScript file parses and every JSON file is valid

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { REPO } = require('../helpers/env');
const { readJson, readJsonc, listFiles } = require('../helpers/files');
const { run } = require('../helpers/project');

const SKIP = ['node_modules', '.git', 'vendor', 'out', 'cache'];

function filesIn(folders, extension) {
    return folders.flatMap((folder) => listFiles(path.join(REPO, folder), { skip: SKIP })
        .filter((file) => file.endsWith(extension))
        .map((file) => path.join(folder, file)));
}

describe('syntax', () => {
    const scripts = [...filesIn(['bin', 'tools', 'src/backend', 'src/frontend/js', 'test'], '.js'), '.eleventy.js'];
    const jsons = [...filesIn(['tools', 'src'], '.json'), 'package.json'];

    for (const file of scripts) {
        test(`${file} parses`, () => {
            const res = run(process.execPath, ['--check', path.join(REPO, file)]);
            assert.equal(res.status, 0, res.output);
        });
    }

    test('tsconfig.json is valid JSON with comments', () => {
        readJsonc(path.join(REPO, 'tsconfig.json'));
    });

    for (const file of jsons) {
        test(`${file} is valid JSON`, () => {
            readJson(path.join(REPO, file));
        });
    }
});
