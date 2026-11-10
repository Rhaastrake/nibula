const path = require('path');
const settings = require('../config/settings.json');
const { PATHS } = require('./paths');
const { exists, sameFile } = require('./files');
const { message } = require('./logger');
const { hasPageRecord } = require('./pagesData');
const { languageSettings, scriptPagesDirectory } = require('./project');
const { toCamelCase } = require('./text');

function routeFile(pageName) {
    return path.join(PATHS.routes, `${pageName}.${settings.page.routeExtension}`);
}

function pageExists(pageName) {
    return exists(routeFile(pageName));
}

function getPageArtifacts(pageName) {
    const camelName = toCamelCase(pageName);

    return {
        camelName,
        source: {
            style:  path.join(PATHS.stylePages, `${camelName}.${settings.page.styleExtension}`),
            script: path.join(scriptPagesDirectory(), `${camelName}.${languageSettings().extension}`),
            route:  routeFile(pageName),
        },
    };
}

// Files and records a page called pageName would write over. The camelCase form
// can be shared by two route names (page-2 and page2 both give page2), so the
// route alone is not enough to tell whether a name is free. When renaming,
// ownName is the page being renamed: its own files are not conflicts.
function pageConflicts(pageName, ownName = null) {
    const target = getPageArtifacts(pageName);
    const own = ownName ? getPageArtifacts(ownName) : null;
    const ownFiles = own ? Object.values(own.source) : [];

    const files = Object.values(target.source)
        .filter((file) => exists(file) && !ownFiles.some((ownFile) => sameFile(ownFile, file)))
        .map((file) => path.relative(PATHS.root, file));

    const sharesRecord = own !== null && own.camelName === target.camelName;
    if (!sharesRecord && hasPageRecord(pageName)) {
        files.push(message('page.recordConflict', { file: settings.paths.pagesData, name: target.camelName }));
    }
    return files;
}

module.exports = { getPageArtifacts, pageExists, pageConflicts };