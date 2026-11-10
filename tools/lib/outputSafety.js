const fs = require('fs');
const path = require('path');
const settings = require('../config/settings.json');
const { PATHS, resolveFromProject } = require('./paths');
const { removeDirectory } = require('./files');
const { log } = require('./logger');

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

// What nib clean does: empties an output folder, unless it is protected.
// Folders outside the project are fine, that is where an output often lives.
function cleanOutputDirectory(target) {
    const resolved = path.resolve(PATHS.root, target);

    if (isProtectedOutput(resolved)) {
        log('output.refuseClean', {
            path: resolved,
            key: settings.packageJson.outputKey,
            file: settings.paths.packageJson,
        });
        return false;
    }

    if (removeDirectory(resolved)) {
        log('output.cleaned', { path: resolved });
    } else {
        log('output.nothingToClean', { path: resolved });
    }
    return true;
}

module.exports = { isProtectedOutput, cleanOutputDirectory };
