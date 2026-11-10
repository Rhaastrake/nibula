const path = require('path');
const settings = require('../config/settings.json');
const { PATHS } = require('./paths');
const { exists, readText, writeText, copyFile, moveFile, removeFile, removeDirectoryIfEmpty } = require('./files');
const { log } = require('./logger');
const { formatText } = require('./text');
const { languageSettings } = require('./project');
const { getPageArtifacts, pageExists, pageConflicts } = require('./pageArtifacts');
const { readPagesData, addPageData, removePageData, renamePageData } = require('./pagesData');

const FRONT_MATTER_PATTERNS = Object.freeze({
    title:     /^title:.*$/m,
    permalink: /^permalink:.*$/m,
    layout:    /^layout:.*$/m,
});

const ROUTE_FRONT_MATTER_KEYS = ['title', 'permalink'];
const RENAME_FRONT_MATTER_KEYS = ['title', 'permalink'];
const LAYOUT_KEY = 'layout';
const PERMALINK_KEY = 'permalink';
const PERMALINK_VALUE_PATTERN = /^permalink:\s*(["']?)(.*?)\1\s*$/m;
const TRAILING_SLASHES_PATTERN = /\/+$/;
const EMPTY = '';

function templatePath(name) {
    return path.join(PATHS.templates, name);
}

function applyFrontMatter(filePath, values, keys) {
    let content = readText(filePath);

    for (const key of keys) {
        content = content.replace(FRONT_MATTER_PATTERNS[key], formatText(settings.frontMatter[key], values));
    }

    writeText(filePath, content);
}

function permalinkValue(content) {
    const match = content.match(PERMALINK_VALUE_PATTERN);
    return match ? match[2].replace(TRAILING_SLASHES_PATTERN, EMPTY) : null;
}

// A rename moves the page to /<new-name>/ only when it still sits at the
// permalink the assistant gave it. A permalink set by hand is kept.
function renameFrontMatterKeys(routeFile, oldName) {
    const current = permalinkValue(readText(routeFile));
    const generated = permalinkValue(formatText(settings.frontMatter.permalink, { pageName: oldName }));

    if (current === null || current === generated) return RENAME_FRONT_MATTER_KEYS;

    log('page.permalinkKept', { path: routeFile });
    return RENAME_FRONT_MATTER_KEYS.filter((key) => key !== PERMALINK_KEY);
}

function refuseConflicts(pageName, ownName) {
    const conflicts = pageConflicts(pageName, ownName);
    if (conflicts.length === 0) return true;

    log('page.wouldOverwrite', { name: pageName, files: conflicts.join(', ') });
    return false;
}

function addPage(pageName, layoutName) {
    if (pageExists(pageName)) {
        log('page.alreadyExists', { name: pageName });
        return;
    }
    if (!refuseConflicts(pageName)) return;

    const { camelName, source } = getPageArtifacts(pageName);
    const values = { camelName, pageName, layoutName };
    const frontMatterKeys = layoutName
        ? [...ROUTE_FRONT_MATTER_KEYS, LAYOUT_KEY]
        : ROUTE_FRONT_MATTER_KEYS;

    const creations = [
        { destination: source.style,  template: settings.page.styleTemplate,  isRoute: false },
        { destination: source.script, template: languageSettings().template,  isRoute: false },
        { destination: source.route,  template: settings.page.routeTemplate,  isRoute: true  },
    ];

    try {
        for (const { destination, template, isRoute } of creations) {
            const templateFile = templatePath(template);

            if (!exists(templateFile)) {
                log('page.templateMissing', { path: templateFile });
                continue;
            }

            copyFile(templateFile, destination);
            if (isRoute) applyFrontMatter(destination, values, frontMatterKeys);

            log('page.fileCreated', { path: destination });
        }
    } catch (error) {
        log('page.createFailed', { error: error.message });
        return;
    }

    addPageData(pageName);
}

function renamePage(oldName, newName) {
    if (!pageExists(oldName)) {
        log('page.doesNotExist', { name: oldName });
        return;
    }
    if (pageExists(newName)) {
        log('page.targetExists', { name: newName });
        return;
    }
    if (!refuseConflicts(newName, oldName)) return;
    if (!readPagesData()) return;

    const current = getPageArtifacts(oldName);
    const next = getPageArtifacts(newName);
    const values = { camelName: next.camelName, pageName: newName };

    const moves = [
        { source: current.source.style,  destination: next.source.style,  isRoute: false },
        { source: current.source.script, destination: next.source.script, isRoute: false },
        { source: current.source.route,  destination: next.source.route,  isRoute: true  },
    ];

    try {
        for (const { source, destination, isRoute } of moves) {
            if (source === destination) continue;
            if (!exists(source)) {
                log('page.fileMissing', { path: source });
                continue;
            }

            moveFile(source, destination);
            log('page.fileRenamed', { source, destination });

            if (isRoute) applyFrontMatter(destination, values, renameFrontMatterKeys(destination, oldName));
        }
    } catch (error) {
        log('page.renameFailed', { error: error.message });
        return;
    }

    renamePageData(oldName, newName);
}

function removePage(pageName) {
    if (!pageExists(pageName)) {
        log('page.doesNotExist', { name: pageName });
        return;
    }
    if (!readPagesData()) return;

    const { source } = getPageArtifacts(pageName);
    const files = [source.style, source.script, source.route];

    for (const file of files) {
        try {
            if (removeFile(file)) log('page.fileDeleted', { path: file });
        } catch (error) {
            log('page.deleteFailed', { path: file, error: error.message });
        }
    }

    removePageData(pageName);

    const sourceDirectories = [source.style, source.script, source.route].map(file => path.dirname(file));

    for (const directory of sourceDirectories) {
        if (removeDirectoryIfEmpty(directory)) log('page.fileDeleted', { path: directory });
    }
}

module.exports = { addPage, removePage, renamePage };