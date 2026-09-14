#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const settings = require('../tools/config/settings.json');
const { writeSync } = require('fs');
const { spawnSync } = require('child_process');
const { color } = require('../tools/lib/colors');

// ── PATHS ────────────────────────────────────────────────────────────────────

const targetDir  = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const templateDir = path.join(__dirname, '..');
const SELF_VERSION = require('../package.json').version;

// ── ENUMS ────────────────────────────────────────────────────────────────────

const LANGUAGE = Object.freeze({
    JAVASCRIPT: 'javascript',
    TYPESCRIPT: 'typescript',
});

const FRAMEWORK = Object.freeze({
    BOOTSTRAP:  'bootstrap',
    BULMA:      'bulma',
    NONE:       'none',
});

const BACKEND = Object.freeze({
    NODE: 'node',
    PHP:  'php',
});

const COMMENT_STYLE = Object.freeze({
    SLASH: { open: '// ', close: '' },
    NJK:   { open: '{# ', close: ' #}' },
});

// ── CHOICES ──────────────────────────────────────────────────────────────────

const LANGUAGE_CHOICES = [
    { label: 'JavaScript (recommended)', value: LANGUAGE.JAVASCRIPT },
    { label: 'TypeScript',           value: LANGUAGE.TYPESCRIPT },
];

const FRAMEWORK_CHOICES = [
    { label: 'Bootstrap',           value: FRAMEWORK.BOOTSTRAP  },
    { label: 'Bulma',               value: FRAMEWORK.BULMA      },
    { label: 'None',                value: FRAMEWORK.NONE       },
];

const BACKEND_CHOICES = [
    { label: 'Node.js (No composer required)', value: BACKEND.NODE },
    { label: 'PHP (Can run everywhere)',  value: BACKEND.PHP  },
];

// Runtime dependencies for the Node backend, read from the backend's own
// package.json so the two never drift. They are added to the ROOT package.json
// when Node is chosen, so they land in the root node_modules (never in
// src/backend).
const NODE_BACKEND_DEPENDENCIES = require(path.join(templateDir, 'src/backend/package.json')).dependencies;

// ── COPY CONFIG ───────────────────────────────────────────────────────────────

const MANDATORY_COPY = [
    '.eleventy.js',
    '.eleventyignore',
    'nginx.conf',
    'src/backend',
    'src/frontend',
];

const FRONTEND_EXCLUDE = {
    [LANGUAGE.JAVASCRIPT]: ['ts'],
    [LANGUAGE.TYPESCRIPT]: ['js'],
};

const CREATE_DIRS = [];

// Backend files that belong to exactly one backend, matched by basename.
// Everything else (migrations, .htaccess, web.config, README, ...) is shared.
const NODE_ONLY_FILES = new Set(['package.json']);
const PHP_ONLY_FILES  = new Set(['composer.json', 'composer.lock']);
const PHP_ONLY_DIRS   = new Set(['vendor']);
// Runtime artifacts that must never be copied from the template, either way.
const BACKEND_SKIP_DIRS = new Set(['node_modules', 'cache', '.git']);

// ── FRAMEWORK CONFIG ──────────────────────────────────────────────────────────

const ALL_FRAMEWORKS = Object.values(FRAMEWORK).filter(f => f !== FRAMEWORK.NONE);

const SCSS_FRAMEWORK_PREFIX = 'modules/frameworks/';

// Markers are substrings matched against whole lines, never full lines, so the
// surrounding syntax (Nunjucks url filter, passthrough copy mapping) can change
// without breaking the scaffolder.
const FRAMEWORKS = {
    [FRAMEWORK.BOOTSTRAP]: {
        scss:     'bootstrap',
        njk:      ['/js/bootstrap.bundle.min.js'],
        eleventy: ['bootstrap/dist/js/bootstrap.bundle.min.js', 'bootstrap-icons/font/fonts'],
    },
    [FRAMEWORK.BULMA]: {
        scss:     'bulma',
        njk:      [],
        eleventy: [],
    },
    [FRAMEWORK.NONE]: {
        scss:     null,
        njk:      [],
        eleventy: [],
    },
};

// ── GENERATED FILE CONTENTS ───────────────────────────────────────────────────

const GITIGNORE_CONTENT = `
node_modules/
src/backend/core/vendor/
out/
src/backend/config.php
src/backend/config.js
src/backend/cache/
`;


const PROJECT_PACKAGE = {
    name:      path.basename(targetDir),
    version:   '0.0.0',
    private:   true,
    outputDir: 'out',
    dependencies: {
        '@11ty/eleventy':     '^3.1.6',
        '@11ty/eleventy-img': '^7.0.0',
        '@11ty/eleventy-plugin-syntaxhighlight': '^5.0.2',
        'bootstrap':          '^5.3.8',
        'bootstrap-icons':    '^1.13.1',
        'bulma':              '^1.0.4',
        'markdown-it-anchor': '^9.2.1',
        'markdown-it-attrs':  '^5.0.1',
    },
    devDependencies: {
        'nibula': `^${SELF_VERSION}`,
        'concurrently':  '^9.2.4',
        'esbuild':       '^0.28.2',
        'sass':          '^1.103.1',
    },
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function projectScripts(language) {
    const { pages, extension } = settings.languages[language];
    const entries = `${pages}/*.${extension}`;

    return {
        'build:css': 'sass src/frontend/scss:out/css --no-source-map --style=compressed --quiet --load-path=node_modules',
        'build:js': `esbuild "${entries}" --bundle --outdir=out/js/pages --minify`,
        'build:11ty': 'eleventy',
        'build': 'npm run clean && npm run build:css && npm run build:js && npm run build:11ty',
        'serve:css': 'sass --watch src/frontend/scss:out/css --no-source-map --quiet --load-path=node_modules',
        'serve:js': `esbuild "${entries}" --bundle --outdir=out/js/pages --watch`,
        'serve:11ty': 'eleventy --serve --quiet',
        'clean': 'nib clean',
        'serve': 'npm run clean && concurrently "npm run serve:11ty" "npm run serve:css" "npm run serve:js"',
        'assistant': 'nib cli',
    };
}

function log(msg) {
    writeSync(1, msg + '\n');
}

function logAdd(name) {
    log(`${color.green}+${color.reset} ${name}`);
}

function copyRecursive(src, dest, exclude = []) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            if (child === '.git') continue;
            if (exclude.includes(child)) continue;
            copyRecursive(path.join(src, child), path.join(dest, child), exclude);
        }
    } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

/**
 * Decide whether a backend entry belongs to the chosen backend.
 * Returns false for entries that must be SKIPPED.
 */
function backendEntryKept(basename, isDir, backend) {
    // Never copy runtime artifacts from the template.
    if (isDir && BACKEND_SKIP_DIRS.has(basename)) return false;

    if (backend === BACKEND.NODE) {
        // Node project: drop every PHP artifact.
        if (basename.endsWith('.php')) return false;
        if (PHP_ONLY_FILES.has(basename)) return false;
        if (isDir && PHP_ONLY_DIRS.has(basename)) return false;
        return true;
    }

    // PHP project: drop every Node artifact.
    if (basename.endsWith('.js')) return false;
    if (NODE_ONLY_FILES.has(basename)) return false;
    return true;
}

/**
 * Copy src/backend into the project keeping only the chosen backend's files.
 * Shared files (SQL migrations, .htaccess, web.config, README, ...) are kept
 * for both. Empty directories left behind by filtering are not created.
 */
function copyBackend(src, dest, backend) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        for (const child of fs.readdirSync(src)) {
            const childSrc = path.join(src, child);
            const isDir    = fs.statSync(childSrc).isDirectory();
            if (!backendEntryKept(child, isDir, backend)) continue;
            copyBackend(childSrc, path.join(dest, child), backend);
        }
    } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

function splitLine(line) {
    const body = line.trim();
    if (!body) return { indent: line, body: '', trailing: '' };

    const start = line.indexOf(body);
    return {
        indent:   line.slice(0, start),
        body,
        trailing: line.slice(start + body.length),
    };
}

function uncommentLine(line, style) {
    const { indent, body, trailing } = splitLine(line);
    if (!body.startsWith(style.open)) return line;

    let inner = body.slice(style.open.length);
    if (style.close) {
        if (!inner.endsWith(style.close)) return line;
        inner = inner.slice(0, -style.close.length);
    }

    return indent + inner + trailing;
}

function commentLine(line, style) {
    const bare = uncommentLine(line, style);
    const { indent, body, trailing } = splitLine(bare);
    if (!body) return line;

    return indent + style.open + body + style.close + trailing;
}

function mapMarkedLines(content, marker, style, transform) {
    return content
        .split('\n')
        .map(line => (line.includes(marker) ? transform(line, style) : line))
        .join('\n');
}

function slashComment(content, marker) {
    return mapMarkedLines(content, marker, COMMENT_STYLE.SLASH, commentLine);
}

function slashUncomment(content, marker) {
    return mapMarkedLines(content, marker, COMMENT_STYLE.SLASH, uncommentLine);
}

function njkComment(content, marker) {
    return mapMarkedLines(content, marker, COMMENT_STYLE.NJK, commentLine);
}

function njkUncomment(content, marker) {
    return mapMarkedLines(content, marker, COMMENT_STYLE.NJK, uncommentLine);
}

function installDependencies(backend) {
    const backendCore = path.join(targetDir, 'src', 'backend', 'core');

    log(`${color.blue}\n>> Installing Node modules...${color.reset}`);
    const npm = spawnSync('npm', ['install'], {
        cwd: targetDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });

    if (npm.status !== 0) {
        log('\n(!) npm install failed. Finish manually:');
        if (process.argv[2]) log(`      cd ${process.argv[2]}`);
        log('      npm install\n');
        return false;
    }

    // Node backend: its runtime deps were added to the ROOT package.json and
    // installed above into the root node_modules — there is no separate install
    // inside src/backend, and Composer is never run.
    if (backend === BACKEND.NODE) {
        return true;
    }

    // --- PHP backend: install Composer dependencies (if present) ---
    if (!fs.existsSync(path.join(backendCore, 'composer.json'))) {
        return true;
    }

    const probe = spawnSync('composer', ['--version'], {
        stdio: 'ignore',
        shell: process.platform === 'win32',
    });

    if (probe.status !== 0) {
        log('\n(!) Composer not found — skipping backend dependencies.');
        log('    Install Composer, then run: cd src/backend/core && composer install\n');
        return true;
    }

    log(`\n${color.blue}>> Installing Composer modules...${color.reset}\n`);
    spawnSync('composer', ['install', '--quiet', '--no-interaction'], {
        cwd: backendCore,
        stdio: 'ignore',
        shell: process.platform === 'win32',
    });

    return true;
}

// ── APPLY ─────────────────────────────────────────────────────────────────────

function applyFramework(framework) {
    const config = FRAMEWORKS[framework];

    const globalScssPath = path.join(targetDir, 'src/frontend/scss/_global.scss');
    if (fs.existsSync(globalScssPath)) {
        let content = fs.readFileSync(globalScssPath, 'utf8');
        ALL_FRAMEWORKS.forEach(fw => {
            content = slashComment(content, `${SCSS_FRAMEWORK_PREFIX}${fw}`);
        });
        if (config.scss) {
            content = slashUncomment(content, `${SCSS_FRAMEWORK_PREFIX}${config.scss}`);
        }
        fs.writeFileSync(globalScssPath, content);
    }

    const baseNjkPath = path.join(targetDir, 'src/frontend/layouts/base.njk');
    if (fs.existsSync(baseNjkPath)) {
        let content = fs.readFileSync(baseNjkPath, 'utf8');
        ALL_FRAMEWORKS.forEach(fw => {
            FRAMEWORKS[fw].njk.forEach(marker => { content = njkComment(content, marker); });
        });
        config.njk.forEach(marker => { content = njkUncomment(content, marker); });
        fs.writeFileSync(baseNjkPath, content);
    }

    const eleventyPath = path.join(targetDir, '.eleventy.js');
    if (fs.existsSync(eleventyPath)) {
        let content = fs.readFileSync(eleventyPath, 'utf8');
        ALL_FRAMEWORKS.forEach(fw => {
            FRAMEWORKS[fw].eleventy.forEach(marker => { content = slashComment(content, marker); });
        });
        config.eleventy.forEach(marker => { content = slashUncomment(content, marker); });
        fs.writeFileSync(eleventyPath, content);
    }
}

// ── UI ────────────────────────────────────────────────────────────────────────

function askChoice(question, choices) {
    return new Promise((resolve) => {
        let selectedIndex = 0;

        log(`\n>> ${question} (Use arrow keys and press Enter):\n`);

        const render = (firstTime = false) => {
            if (!firstTime) process.stdout.write(`\x1B[${choices.length}A`);
            const output = choices.map((choice, index) =>
                index === selectedIndex
                    ? `  \x1b[36m◉ ${choice.label}\x1b[0m\x1B[K\n`
                    : `  * ${choice.label}\x1B[K\n`
            ).join('');
            process.stdout.write(output);
        };

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdin.resume();

        const onKeyPress = (str, key) => {
            if (key.ctrl && key.name === 'c') {
                process.exit();
            } else if (key.name === 'up') {
                selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : choices.length - 1;
                render();
            } else if (key.name === 'down') {
                selectedIndex = selectedIndex < choices.length - 1 ? selectedIndex + 1 : 0;
                render();
            } else if (key.name === 'return' || key.name === 'enter') {
                process.stdin.removeListener('keypress', onKeyPress);
                if (process.stdin.isTTY) process.stdin.setRawMode(false);
                process.stdin.pause();
                resolve(choices[selectedIndex].value);
            }
        };

        process.stdin.on('keypress', onKeyPress);
        render(true);
    });
}

// ── INIT ──────────────────────────────────────────────────────────────────────

async function init() {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    log(`\n>> ${color.magenta}Creating Nibula project in ${targetDir}\n${color.reset}`);

    const language  = await askChoice('Select a language',      LANGUAGE_CHOICES);
    const framework = await askChoice('Select a CSS framework', FRAMEWORK_CHOICES);
    const backend   = await askChoice('Select a backend',       BACKEND_CHOICES);

    log('');

    for (const target of MANDATORY_COPY) {
        const src  = path.join(templateDir, target);
        const dest = path.join(targetDir, target);
        if (!fs.existsSync(src)) continue;

        if (target === 'src/backend') {
            // Copy only the chosen backend's files (the other backend is omitted).
            copyBackend(src, dest, backend);
        } else {
            const exclude = target === 'src/frontend' ? FRONTEND_EXCLUDE[language] : [];
            copyRecursive(src, dest, exclude);
        }
        logAdd(target);
    }

    // Generate the local config only for the chosen backend. The other backend's
    // example file was not copied, so its guard below is simply skipped.
    const configDest    = path.join(targetDir, 'src/backend/config.php');
    const configExample = path.join(targetDir, 'src/backend/example.config.php');
    if (!fs.existsSync(configDest) && fs.existsSync(configExample)) {
        fs.copyFileSync(configExample, configDest);
        logAdd('src/backend/config.php');
    }

    const configJsDest    = path.join(targetDir, 'src/backend/config.js');
    const configJsExample = path.join(targetDir, 'src/backend/example.config.js');
    if (!fs.existsSync(configJsDest) && fs.existsSync(configJsExample)) {
        fs.copyFileSync(configJsExample, configJsDest);
        logAdd('src/backend/config.js');
    }

    // Build the project package.json. Clone the shared dependency maps so we
    // never mutate the PROJECT_PACKAGE constant.
    const pkg = { ...PROJECT_PACKAGE };
    pkg.scripts = projectScripts(language);
    pkg.dependencies    = { ...PROJECT_PACKAGE.dependencies };
    pkg.devDependencies = { ...PROJECT_PACKAGE.devDependencies };

    // Node backend deps live in the ROOT node_modules — add them to root deps
    // so `npm install` installs them there (never in src/backend).
    if (backend === BACKEND.NODE) {
        pkg.dependencies = { ...pkg.dependencies, ...NODE_BACKEND_DEPENDENCIES };
    }

    if (language === LANGUAGE.TYPESCRIPT) {
        const tsSrc  = path.join(templateDir, 'tsconfig.json');
        const tsDest = path.join(targetDir, 'tsconfig.json');
        fs.copyFileSync(tsSrc, tsDest);
        logAdd('tsconfig.json');
        pkg.devDependencies = { ...pkg.devDependencies, typescript: 'latest' };
    }

    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2));
    logAdd('package.json');

    fs.writeFileSync(path.join(targetDir, '.gitignore'), GITIGNORE_CONTENT);
    logAdd('.gitignore');

    for (const dir of CREATE_DIRS) {
        fs.mkdirSync(path.join(targetDir, dir), { recursive: true });
    }

    applyFramework(framework);

    installDependencies(backend);

    log(`\n${color.green}>> Done!${color.reset}`);
    log(`${color.yellow}\nNow run:\n${color.reset}`);
    if (process.argv[2]) log(`${color.yellow}> cd ${process.argv[2]}${color.reset}`);
    log(`${color.yellow}> nib run${color.reset}`);
    log('');
}

init();