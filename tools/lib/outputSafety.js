const fs = require('fs');
const path = require('path');
const settings = require('../config/settings.json');
const { PATHS, resolveFromProject } = require('./paths');

const PARENT_DIRECTORY = '..';

function isInside(target, directory) {
    const relative = path.relative(directory, target);
    if (relative === '') return true;
    if (path.isAbsolute(relative)) return false;
    return relative !== PARENT_DIRECTORY && !relative.startsWith(`${PARENT_DIRECTORY}${path.sep}`);
}

// The output folder is emptied before every build, so it must never be the
// project itself, one of its parents, a folder holding sources or a file.
function isProtectedOutput(target) {
    const resolved = path.resolve(PATHS.root, target);

    if (isInside(PATHS.root, resolved)) return true;

    const overlapsSources = settings.project.protectedDirectories
        .some((directory) => isInside(resolved, resolveFromProject(directory)));
    if (overlapsSources) return true;

    return fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory();
}

module.exports = { isProtectedOutput };
