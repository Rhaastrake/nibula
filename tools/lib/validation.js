const settings = require('../config/settings.json');
const { PATHS } = require('./paths');
const { exists } = require('./files');
const { message } = require('./logger');

const NAME_PATTERN = /^[a-z0-9-]+$/;
const LEADING_DIGIT_PATTERN = /^\d/;
// The path is written unquoted into the build scripts, so only characters the
// shell leaves alone are accepted: no spaces, quotes, $, &, ; and the like.
const OUTPUT_PATH_PATTERN = /^([A-Za-z]:)?[A-Za-z0-9._\/\\-]+$/;

function requiredFiles() {
    return [
        { label: settings.paths.eleventyConfig,  path: PATHS.eleventyConfig },
        { label: settings.paths.packageJson,     path: PATHS.packageJson },
        { label: settings.paths.siteData,        path: PATHS.siteData },
        { label: settings.paths.pagesData,       path: PATHS.pagesData },
        { label: message('validation.templatesLabel'), path: PATHS.templates },
    ];
}

function validatePageName(name) {
    if (!name) return message('validation.invalidName');
    if (!NAME_PATTERN.test(name)) return message('validation.invalidNameCharacters');
    if (LEADING_DIGIT_PATTERN.test(name)) return message('validation.nameStartsWithNumber');
    if (settings.page.protected.includes(name)) return message('validation.protectedName', { name });
    return null;
}

function validateOutputPath(input) {
    const value = (input ?? '').trim();
    if (!value) return message('validation.invalidPath');
    if (!OUTPUT_PATH_PATTERN.test(value)) return message('validation.invalidPathCharacters');
    return null;
}

function checkRequiredFiles() {
    return requiredFiles().filter((item) => !exists(item.path));
}

module.exports = { validatePageName, validateOutputPath, checkRequiredFiles };
