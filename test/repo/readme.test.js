// README.md documents every command that `nib help` lists

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { REPO } = require('../helpers/env');
const { read } = require('../helpers/files');
const { repoNib } = require('../helpers/project');

describe('README.md', () => {
    const readme = read(path.join(REPO, 'README.md'));
    const help = repoNib(REPO, ['help']).output;
    const commands = [...new Set([...help.matchAll(/nib ([a-z]+)/g)].map((match) => match[1]))];

    test('nib help lists some commands', () => {
        assert.ok(commands.length >= 5, help);
    });

    for (const command of commands) {
        test(`documents nib ${command}`, () => {
            assert.match(readme, new RegExp(`\`nib ${command}\\b`));
        });
    }
});
