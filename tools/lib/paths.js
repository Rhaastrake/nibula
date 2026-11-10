const fs = require('fs');
const path = require('path');
const settings = require('../config/settings.json');
const { paint } = require('./colors');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const PATH_SEPARATOR = '/';

let cachedProjectRoot = null;

function findProjectRoot(start) {
    let directory = path.resolve(start ?? process.cwd());
    while (true) {
        if (fs.existsSync(path.join(directory, settings.project.marker))) return directory;
        const parent = path.dirname(directory);
        if (parent === directory) return null;
        directory = parent;
    }
}

function projectRoot() {
    if (cachedProjectRoot) return cachedProjectRoot;
    const root = findProjectRoot();
    if (!root) {
        console.error(paint('red', require('./logger').message('project.notInside')));
        process.exit(1);
    }
    cachedProjectRoot = root;
    return root;
}

function resolveFromProject(relativePath) {
    return path.join(projectRoot(), ...relativePath.split(PATH_SEPARATOR));
}

function resolveFromPackage(relativePath) {
    return path.join(PACKAGE_ROOT, ...relativePath.split(PATH_SEPARATOR));
}

const PATHS = Object.freeze({
    get root()             { return projectRoot(); },
    get eleventyConfig()   { return resolveFromProject(settings.paths.eleventyConfig); },
    get packageJson()      { return resolveFromProject(settings.paths.packageJson); },
    get typescriptConfig() { return resolveFromProject(settings.paths.typescriptConfig); },
    get routes()           { return resolveFromProject(settings.paths.routes); },
    get stylePages()       { return resolveFromProject(settings.paths.stylePages); },
    get siteData()         { return resolveFromProject(settings.paths.siteData); },
    get pagesData()        { return resolveFromProject(settings.paths.pagesData); },
    get templates()        { return resolveFromPackage(settings.paths.templates); },
    get layouts()          { return resolveFromProject(settings.paths.layouts); },
});

module.exports = {
    PATHS,
    PACKAGE_ROOT,
    findProjectRoot,
    resolveFromProject,
    resolveFromPackage,
};