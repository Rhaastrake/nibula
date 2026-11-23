// Node, PHP or none: each project gets only the files of its backend, a
// config generated from the example, and the matching .gitignore and
// dependencies. Server configs are always there.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ALL_COMBOS, REPO } = require('../helpers/env');
const { scaffoldOnce } = require('../helpers/project');
const { exists, read, readJson, listFiles } = require('../helpers/files');

const BACKEND = 'src/backend';

const SHARED_FILES = ['.htaccess', 'web.config', 'database/migrations/create_example_db.sql'];

const EXPECTED = {
    node: {
        extension: '.js',
        foreign: '.php',
        files: [
            'core/index.js', 'core/init.js', 'core/modules/Response.js', 'core/modules/Validate.js',
            'core/modules/RateLimiter.js', 'database/Database.js', 'endpoints/public/example-public.js',
            'endpoints/protected/example-protected.js', 'package.json', 'example.config.js', 'config.js',
        ],
        absent: ['core/composer.json', 'core/composer.lock', 'config.php', 'example.config.php'],
        config: ['config.js', 'example.config.js'],
    },
    php: {
        extension: '.php',
        foreign: '.js',
        files: [
            'core/index.php', 'core/init.php', 'core/modules/Response.php', 'core/modules/Validate.php',
            'core/modules/RateLimiter.php', 'database/Database.php', 'endpoints/public/example-public.php',
            'endpoints/protected/example-protected.php', 'core/composer.json', 'core/composer.lock',
            'example.config.php', 'config.php',
        ],
        absent: ['package.json', 'config.js', 'example.config.js'],
        config: ['config.php', 'example.config.php'],
    },
};

const GITIGNORE_BACKEND = ['src/backend/core/vendor/', 'src/backend/config.php', 'src/backend/config.js', 'src/backend/cache/'];

const COMBOS = ALL_COMBOS.filter((combo) => combo.lang === 'js' || combo.css === 'none');

for (const combo of COMBOS) {
    describe(`backends: ${combo.id}`, () => {
        const dir = scaffoldOnce(combo);
        const backendDir = path.join(dir, BACKEND);
        const pkg = readJson(path.join(dir, 'package.json'));
        const gitignore = read(path.join(dir, '.gitignore'));

        test('server configs are always there', () => {
            for (const file of ['nginx.conf', 'src/frontend/hosting/.htaccess', 'src/frontend/hosting/web.config']) {
                assert.ok(exists(path.join(dir, file)), `missing ${file}`);
                assert.equal(read(path.join(dir, file)), read(path.join(REPO, file)), `${file} differs from the template`);
            }
        });

        if (combo.backend === 'none') {
            test('has no backend folder', () => {
                assert.ok(!exists(backendDir));
            });
            test('.gitignore has no backend entries', () => {
                for (const entry of GITIGNORE_BACKEND) assert.ok(!gitignore.includes(entry), entry);
            });
            test('no backend dependencies', () => {
                assert.ok(!('mysql2' in (pkg.dependencies || {})));
            });
            return;
        }

        const expected = EXPECTED[combo.backend];
        const files = listFiles(backendDir);

        test(`has the ${combo.backend} files`, () => {
            for (const file of [...expected.files, ...SHARED_FILES]) {
                assert.ok(files.includes(file), `missing ${BACKEND}/${file}`);
            }
        });

        test(`has no files of the other backend`, () => {
            assert.deepEqual(files.filter((file) => file.endsWith(expected.foreign)), []);
            for (const file of expected.absent) assert.ok(!files.includes(file), `${BACKEND}/${file} should not exist`);
        });

        test('no runtime folders copied from the template', () => {
            assert.deepEqual(files.filter((file) => /(^|\/)(node_modules|vendor|cache|\.git)\//.test(file)), []);
        });

        test('config is a copy of the example', () => {
            const [config, example] = expected.config;
            assert.equal(read(path.join(backendDir, config)), read(path.join(backendDir, example)));
        });

        test('every template file of the backend is copied', () => {
            const template = listFiles(path.join(REPO, BACKEND), { skip: ['node_modules', 'vendor', 'cache', '.git'] })
                .filter((file) => !file.endsWith(expected.foreign))
                .filter((file) => !expected.absent.includes(file));
            assert.deepEqual(template.filter((file) => !files.includes(file)), []);
        });

        test('.gitignore has the backend entries', () => {
            for (const entry of GITIGNORE_BACKEND) assert.ok(gitignore.includes(entry), entry);
        });

        test('dependencies match the backend', () => {
            const deps = pkg.dependencies || {};
            if (combo.backend === 'node') {
                const backendPkg = readJson(path.join(REPO, BACKEND, 'package.json'));
                for (const [name, range] of Object.entries(backendPkg.dependencies)) {
                    assert.equal(deps[name], range, `root package.json should have ${name}@${range}`);
                }
            } else {
                assert.ok(!('mysql2' in deps));
            }
        });
    });
}
