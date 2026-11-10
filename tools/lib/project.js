const fs = require('fs');
const settings = require('../config/settings.json');
const { PATHS, resolveFromProject } = require('./paths');
const { readJson } = require('./files');

const JAVASCRIPT = 'javascript';
const TYPESCRIPT = 'typescript';
const ENTRY_WILDCARD = '*';

function isTypeScriptProject() {
    return fs.existsSync(PATHS.typescriptConfig);
}

function currentLanguage() {
    return isTypeScriptProject() ? TYPESCRIPT : JAVASCRIPT;
}

function languageSettings(language) {
    return settings.languages[language ?? currentLanguage()];
}

function scriptPagesDirectory(language) {
    return resolveFromProject(languageSettings(language).pages);
}

function scriptEntries(language) {
    const { pages, extension } = languageSettings(language);
    return `${pages}/${ENTRY_WILDCARD}.${extension}`;
}

function readPackageJson() {
    return readJson(PATHS.packageJson);
}

module.exports = {
    JAVASCRIPT,
    TYPESCRIPT,
    isTypeScriptProject,
    currentLanguage,
    languageSettings,
    scriptPagesDirectory,
    scriptEntries,
    readPackageJson,
};
