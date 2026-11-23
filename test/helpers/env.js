// Shared settings for every test: where the repo is, where generated projects
// go, which combinations exist and which one this run builds.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const REPO_PACKAGE = require(path.join(REPO, 'package.json'));

// Outside the repo on purpose: a project created inside a git repository
// would not get its own `git init`
const TMP_ROOT = process.env.NIBULA_TEST_TMP || path.join(os.tmpdir(), 'nibula-tests');

const LANGS = ['js', 'ts'];
const CSS = ['bootstrap', 'bulma', 'none'];
const BACKENDS = ['node', 'php', 'none'];

const ALL_COMBOS = LANGS.flatMap((lang) =>
    CSS.flatMap((css) => BACKENDS.map((backend) => ({ lang, css, backend, id: `${lang}-${css}-${backend}` }))));

const DEFAULT_COMBO = 'js-bootstrap-node';

const IS_CI = Boolean(process.env.CI);
const IS_WINDOWS = process.platform === 'win32';

function parseCombo(id) {
    const combo = ALL_COMBOS.find((item) => item.id === id);
    if (!combo) throw new Error(`Unknown combination "${id}". Use <js|ts>-<bootstrap|bulma|none>-<node|php|none>`);
    return combo;
}

// The combination built by the build, seo and cli tests (NIBULA_COMBO)
function currentCombo() {
    return parseCombo(process.env.NIBULA_COMBO || DEFAULT_COMBO);
}

// Files whose content shapes a generated project. Their hash names the cache
// folder, so a change to the template never reuses an old project.
const SOURCE_ENTRIES = ['bin', 'tools', 'src', '.eleventy.js', '.eleventyignore', 'nginx.conf', 'tsconfig.json', 'package.json'];
const SOURCE_SKIP = new Set(['node_modules', 'vendor', 'cache', '.git']);

function hashSources() {
    const hash = crypto.createHash('sha1');
    const walk = (entry) => {
        const full = path.join(REPO, entry);
        if (!fs.existsSync(full)) return;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            for (const child of fs.readdirSync(full).sort()) {
                if (!SOURCE_SKIP.has(child)) walk(path.join(entry, child));
            }
            return;
        }
        hash.update(entry.split(path.sep).join('/'));
        hash.update(fs.readFileSync(full));
    };
    SOURCE_ENTRIES.forEach(walk);
    return hash.digest('hex').slice(0, 12);
}

const RUN_ID = hashSources();
const TMP = path.join(TMP_ROOT, RUN_ID);

// Old caches from a previous version of the sources
function removeStaleCaches() {
    if (!fs.existsSync(TMP_ROOT)) return;
    for (const entry of fs.readdirSync(TMP_ROOT)) {
        if (entry !== RUN_ID) fs.rmSync(path.join(TMP_ROOT, entry), { recursive: true, force: true });
    }
}

function hasCommand(command, args = ['--version']) {
    const res = spawnSync(command, args, { stdio: 'ignore', shell: IS_WINDOWS });
    return !res.error && res.status === 0;
}

// Tools that only CI is sure to have (php, composer, docker). Locally a
// missing one skips the test with a reason; in CI it is a failure.
function requireTools(...commands) {
    const missing = commands.filter((command) => !hasCommand(command));
    if (missing.length === 0) return false;
    const reason = `needs ${missing.join(', ')}`;
    if (IS_CI) throw new Error(`Missing in CI: ${missing.join(', ')}`);
    return reason;
}

module.exports = {
    REPO, REPO_PACKAGE, TMP, TMP_ROOT, ALL_COMBOS, LANGS, CSS, BACKENDS,
    IS_CI, IS_WINDOWS, parseCombo, currentCombo, removeStaleCaches, hasCommand, requireTools,
};
