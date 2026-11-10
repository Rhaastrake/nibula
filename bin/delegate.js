const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PACKAGE_NAME = 'nibula';
const NODE_MODULES = 'node_modules';
const ENTRY_FILE = path.join('bin', 'nibula.js');
const PACKAGE_FILE = 'package.json';
const LOCAL_FLAG = 'NIBULA_LOCAL';
const LOCAL_FLAG_VALUE = '1';
const GLOBAL_VERSION_FLAG = 'NIBULA_GLOBAL_VERSION';

const globalVersion = require(`../${PACKAGE_FILE}`).version;

function realPath(target) {
    try {
        return fs.realpathSync(target);
    } catch {
        return null;
    }
}

// The project's own copy of Nibula, when the command has to be handed over to
// it: null if this already is that copy or the project has none.
function localPackageRoot(projectRoot) {
    if (process.env[LOCAL_FLAG] === LOCAL_FLAG_VALUE) return null;

    const localRoot = realPath(path.join(projectRoot, NODE_MODULES, PACKAGE_NAME));
    const selfRoot = realPath(path.join(__dirname, '..'));

    if (!localRoot || localRoot === selfRoot) return null;
    if (!fs.existsSync(path.join(localRoot, ENTRY_FILE))) return null;

    return localRoot;
}

function delegateToLocal(projectRoot) {
    const localRoot = localPackageRoot(projectRoot);
    if (!localRoot) return;

    const localEntry = path.join(localRoot, ENTRY_FILE);
    const result = spawnSync(process.execPath, [localEntry, ...process.argv.slice(2)], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, [LOCAL_FLAG]: LOCAL_FLAG_VALUE, [GLOBAL_VERSION_FLAG]: globalVersion },
    });

    process.exit(result.status ?? 0);
}

module.exports = { delegateToLocal, localPackageRoot };