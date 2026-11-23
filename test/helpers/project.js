// Creates, installs and builds Nibula projects the way a user would, but from
// the local sources: `npm pack` turns the repo into the same tarball npm
// would publish, and the project installs that instead of the registry version.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { REPO, REPO_PACKAGE, TMP, IS_WINDOWS, hasCommand } = require('./env');

const NIBULA_BIN = path.join(REPO, 'bin', 'nibula.js');
const BUILT_MARKER = '.nibula-test-built';
const LOG_DIR = '.nibula-test-logs';

// Runs a command and returns its result. Output is captured, never printed,
// so a failing assertion can show it.
function run(command, args, { cwd, env, input = '', timeout = 10 * 60 * 1000 } = {}) {
    const useShell = IS_WINDOWS && !path.isAbsolute(command);
    const res = spawnSync(command, args, {
        cwd,
        env: { ...process.env, ...env },
        input,
        encoding: 'utf8',
        timeout,
        shell: useShell,
        maxBuffer: 64 * 1024 * 1024,
    });
    return {
        status: res.status,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        output: `${res.stdout || ''}${res.stderr || ''}`,
        error: res.error,
    };
}

// Throws with the full output when the command fails
function runOk(command, args, options) {
    const res = run(command, args, options);
    if (res.status !== 0) {
        throw new Error(`"${command} ${args.join(' ')}" failed (exit ${res.status})\n${res.output}${res.error ? res.error.message : ''}`);
    }
    return res;
}

function writeLog(dir, name, content) {
    const logDir = path.join(dir, LOG_DIR);
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `${name}.log`), content);
}

// ── PACK ────────────────────────────────────────────────────────────────────

function packNibula() {
    const tarball = path.join(TMP, `nibula-${REPO_PACKAGE.version}.tgz`);
    if (fs.existsSync(tarball)) return tarball;

    fs.mkdirSync(TMP, { recursive: true });
    runOk('npm', ['pack', '--silent', '--pack-destination', TMP], { cwd: REPO });
    if (!fs.existsSync(tarball)) throw new Error(`npm pack did not write ${tarball}`);
    return tarball;
}

// ── CREATE ──────────────────────────────────────────────────────────────────

// `nib new` without installing anything. Returns the project folder.
function scaffold(parent, name, combo, extraArgs = []) {
    fs.mkdirSync(parent, { recursive: true });
    const dir = path.join(parent, name);
    fs.rmSync(dir, { recursive: true, force: true });

    runOk(process.execPath, [
        NIBULA_BIN, 'new', name,
        '--lang', combo.lang, '--css', combo.css, '--backend', combo.backend,
        '--no-install', '--skip-update-check', ...extraArgs,
    ], { cwd: parent });
    return dir;
}

// Projects created once per run and only read by the tests
function scaffoldOnce(combo) {
    const parent = path.join(TMP, 'scaffold');
    const dir = path.join(parent, combo.id);
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    return scaffold(parent, combo.id, combo);
}

// ── INSTALL AND BUILD ───────────────────────────────────────────────────────

function installProject(dir, combo) {
    const tarball = packNibula();
    const pkgPath = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.devDependencies.nibula = `file:${tarball.split(path.sep).join('/')}`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    const npm = runOk('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir });
    writeLog(dir, 'npm-install', npm.output);

    // Same step create.js runs after npm install for a PHP backend
    if (combo.backend === 'php' && hasCommand('composer')) {
        const composer = runOk('composer', ['install', '--no-interaction', '--no-progress'], {
            cwd: path.join(dir, 'src', 'backend', 'core'),
        });
        writeLog(dir, 'composer-install', composer.output);
    }
    return npm;
}

function buildProject(dir) {
    const res = run('npm', ['run', 'build'], { cwd: dir });
    writeLog(dir, 'build', res.output);
    return res;
}

// A project installed and built once per run, for tests that only read it
function builtProject(combo) {
    const parent = path.join(TMP, 'built');
    const dir = path.join(parent, combo.id);
    if (fs.existsSync(path.join(dir, BUILT_MARKER))) return dir;

    scaffold(parent, combo.id, combo);
    installProject(dir, combo);
    const build = buildProject(dir);
    if (build.status !== 0) throw new Error(`Build failed for ${combo.id}\n${build.output}`);
    fs.writeFileSync(path.join(dir, BUILT_MARKER), '');
    return dir;
}

// A copy of the built project that a test may change. node_modules is linked,
// not copied, so the copy is fast and installs nothing.
function workingCopy(combo, label) {
    const source = builtProject(combo);
    const dir = path.join(TMP, 'work', `${combo.id}-${label}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    for (const entry of fs.readdirSync(source)) {
        if (entry === 'node_modules' || entry === BUILT_MARKER || entry === LOG_DIR) continue;
        fs.cpSync(path.join(source, entry), path.join(dir, entry), { recursive: true });
    }
    fs.symlinkSync(path.join(source, 'node_modules'), path.join(dir, 'node_modules'), IS_WINDOWS ? 'junction' : 'dir');
    return dir;
}

// ── COMMANDS ────────────────────────────────────────────────────────────────

// The project's own nib (the packed version), with no terminal attached
function nib(dir, args) {
    const bin = path.join(dir, 'node_modules', 'nibula', 'bin', 'nibula.js');
    return run(process.execPath, [bin, ...args], { cwd: dir });
}

// The repo's nib, for commands run outside a project (nib new)
function repoNib(cwd, args) {
    return run(process.execPath, [NIBULA_BIN, ...args], { cwd });
}

module.exports = {
    run, runOk, packNibula, scaffold, scaffoldOnce, installProject, buildProject,
    builtProject, workingCopy, nib, repoNib,
};
