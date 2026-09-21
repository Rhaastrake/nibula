#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { findProjectRoot } = require('../tools/lib/paths');
const { color } = require('../tools/lib/colors');
const { message } = require('../tools/lib/logger');
const { delegateToLocal } = require('./delegate');

const pkg = require('../package.json');

const [, , cmd, ...rest] = process.argv;

const CREATE = path.join(__dirname, 'create.js');
const ASSISTANT = path.join(__dirname, '..', 'tools', 'assistant.js');
const CLEAN     = path.join(__dirname, '..', 'tools', 'cleanOutput.js');

const REGISTRY = 'https://registry.npmjs.org/nibula/latest';
const CHECK_TIMEOUT = 2500;
const SKIP_FLAG = '--skip-update-check';

function run(script, args) {
    const res = spawnSync('node', [script, ...args], {
        stdio: 'inherit',
        cwd: process.cwd(),
    });
    process.exit(res.status ?? 0);
}

function requireProjectRoot() {
    const root = findProjectRoot(process.cwd());
    if (!root) {
        console.error(`\n${color.red}${message('project.notInside')}${color.reset}\n`);
        process.exit(1);
    }
    return root;
}

function requireOutsideProject() {
    const root = findProjectRoot(process.cwd());
    if (!root) return;

    console.error(`\n${color.red}${message('project.alreadyInside')}${color.reset}`);
    console.error(`${color.dim}${message('project.alreadyInsideHint')}${color.reset}\n`);
    process.exit(1);
}

function enterProject() {
    const root = requireProjectRoot();
    delegateToLocal(root);
    return root;
}

function runNpm(root, scriptName) {
    const res = spawnSync('npm', ['run', scriptName], {
        stdio: 'inherit',
        cwd: root,
        shell: process.platform === 'win32',
    });
    if (res.error) console.error(res.error.message);
    process.exit(res.status ?? 0);
}

function fetchLatest() {
    return new Promise((resolve) => {
        const req = https.get(REGISTRY, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                resolve(null);
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data).version ?? null);
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(CHECK_TIMEOUT, () => {
            req.destroy();
            resolve(null);
        });
    });
}

function isOlder(current, latest) {
    const parse = (v) => String(v).split('-')[0].split('.').map(Number);
    const a = parse(current);
    const b = parse(latest);
    for (let i = 0; i < 3; i++) {
        const na = a[i] || 0;
        const nb = b[i] || 0;
        if (na < nb) return true;
        if (na > nb) return false;
    }
    return false;
}

async function checkVersion() {
    const latest = await fetchLatest();
    return {
        current: pkg.version,
        latest,
        behind: latest !== null && isOlder(pkg.version, latest),
    };
}

function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

function updateGlobal(version) {
    const target = version ? `nibula@${version}` : 'nibula@latest';
    const res = spawnSync('npm', ['install', '-g', target, '--prefer-online'], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    return res.status ?? 0;
}

function globalNibulaPath() {
    const res = spawnSync('npm', ['root', '-g'], {
        encoding: 'utf8',
        shell: process.platform === 'win32',
    });
    if (res.status !== 0 || !res.stdout) return null;
    const candidate = path.join(res.stdout.trim(), 'nibula', 'bin', 'nibula.js');
    return fs.existsSync(candidate) ? candidate : null;
}

function reexecAfterUpdate(args) {
    const target = globalNibulaPath();
    if (!target) {
        console.error(`${color.red}Could not locate the updated Nibula installation.${color.reset}`);
        console.error(`Run "nib new ${args[1]}" again to continue.`);
        return 1;
    }
    const res = spawnSync(process.execPath, [target, ...args, SKIP_FLAG], {
        stdio: 'inherit',
        cwd: process.cwd(),
    });
    return res.status ?? 0;
}

function findExistingProject(baseDir, projectName) {
    let entries;
    try {
        entries = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
        return null;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pkgPath = path.join(baseDir, entry.name, 'package.json');
        if (!fs.existsSync(pkgPath)) continue;
        try {
            const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (data && data.name === projectName) {
                return path.join(baseDir, entry.name);
            }
        } catch {
            // ...
        }
    }
    return null;
}

function usage(currentVersion) {
    console.log(`

${color.bold}${color.cyan}Nibula (${currentVersion})${color.reset} ${color.bold}by Michele Garofalo${color.reset}

${color.yellow}nib new <project-name>${color.reset}   Create your new project
${color.yellow}nib cli${color.reset}                  Open the page-management assistant
${color.yellow}nib run${color.reset}                  Start the dev server and builds out folder runtime
${color.yellow}nib build${color.reset}                Build the site out folder to publish
${color.yellow}nib clean${color.reset}                Remove the output directory
${color.yellow}nib update${color.reset}               Update to the latest version

`);
}

async function main() {
    switch (cmd) {
        case 'new': {
            const args = rest.filter((a) => a !== SKIP_FLAG);
            const skipCheck = rest.includes(SKIP_FLAG);

            if (!args[0]) {
                console.error('Missing project name. Usage: nib new <project-name>');
                process.exit(1);
            }

            requireOutsideProject();

            if (!skipCheck) {
                const info = await checkVersion();
                if (info.behind) {
                    console.log(`\nA newer version of Nibula is available: ${info.current} → ${info.latest}`);
                    if (process.stdin.isTTY) {
                        const answer = await ask('Update before creating the project? [Y/n] ');
                        if (answer === '' || answer === 'y' || answer === 'yes') {
                            const code = updateGlobal(info.latest);
                            if (code !== 0) process.exit(code);
                            console.log(`\n${color.green}Updated.${color.reset} Continuing with the new version...\n`);
                            process.exit(reexecAfterUpdate(['new', args[0]]));
                        }
                    } else {
                        console.log('Run "nib update" to update.\n');
                    }
                }
            }

            const existing = findExistingProject(process.cwd(), args[0]);
            if (existing) {
                console.log(`\n${color.yellow}A project named "${args[0]}" already exists:${color.reset} ${existing}`);
                let overwrite = false;
                if (process.stdin.isTTY) {
                    const answer = await ask('Do you want to overwrite it? [y/N] ');
                    overwrite = (answer === 'y' || answer === 'yes');
                } else {
                    console.log('Run in a TTY to confirm overwrite.');
                }
                if (!overwrite) {
                    console.log('Stopped creating the new project');
                    process.exit(0);
                }
                try {
                    fs.rmSync(existing, { recursive: true, force: true });
                    console.log(`${color.green}Removed existing project.${color.reset}`);
                } catch (err) {
                    console.error(`${color.red}Failed to remove existing project:${color.reset} ${err.message}`);
                    process.exit(1);
                }
            }

            run(CREATE, [args[0]]);
            break;
        }
        case 'cli': {
            enterProject();
            run(ASSISTANT, []);
            break;
        }
        case 'run': {
            const root = enterProject();
            runNpm(root, 'serve');
            break;
        }
        case 'build': {
            const root = enterProject();
            runNpm(root, 'build');
            break;
        }
        case 'clean': {
            enterProject();
            run(CLEAN, []);
            break;
        }
        case 'update': {
            const info = await checkVersion();

            if (info.latest === null) {
                console.error(`\n${color.yellow}${message('update.unknownLatest')}${color.reset}\n`);
                process.exit(1);
            }

            if (!info.behind) {
                console.log(message('update.upToDate', { current: info.current }));
                process.exit(0);
            }

            console.log(`\n${message('update.current', { current: info.current })}`);
            console.log(`${color.green}${message('update.available', { latest: info.latest })}${color.reset}`);
            console.log(`${color.dim}${message('update.scopeNotice')}${color.reset}\n`);

            if (!process.stdin.isTTY) {
                console.error(message('update.nonInteractive'));
                process.exit(1);
            }

            const answer = await ask(message('update.confirm'));
            if (answer !== '' && answer !== 'y' && answer !== 'yes') {
                console.log(message('update.cancelled'));
                process.exit(0);
            }

            process.exit(updateGlobal(info.latest));
        }
        case undefined:
        case 'help':
        case '-help':
        case '--help':
        case 'h':
        case '-h': {
            usage(pkg.version);
            break;
        }
        case 'version':
        case 'v':
        case 'ver':
        case '-v':
        case '--version': {
            console.log(pkg.version);
            break;
        }
        default:
            console.error(`${color.red}\nUnknown command:${color.reset} ${cmd}`);
            usage(pkg.version);
            process.exit(1);
    }
}

main();