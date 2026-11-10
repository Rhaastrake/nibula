const settings = require('../config/settings.json');
const { PATHS } = require('./paths');
const { exists } = require('./files');
const { message } = require('./logger');

const TYPED_NAME_CHARACTER_PATTERN = /[A-Za-z0-9\s_-]/;
const CHARACTER_LIST_SEPARATOR = ' ';
const NAME_PATTERN = /^[a-z0-9-]+$/;
const LEADING_DIGIT_PATTERN = /^\d/;
const INVALID_PATH_PATTERN = /[<>|?*"']/;

function requiredFiles() {
    return [
        { label: settings.paths.eleventyConfig,  path: PATHS.eleventyConfig },
        { label: settings.paths.packageJson,     path: PATHS.packageJson },
        { label: settings.paths.siteData,        path: PATHS.siteData },
        { label: settings.paths.pagesData,       path: PATHS.pagesData },
        { label: message('validation.templatesLabel'), path: PATHS.templates },
    ];
}

// Checks the name as typed, before it is turned into kebab-case. Uppercase,
// spaces and underscores convert cleanly; anything else (accented letters,
// symbols) would be dropped from the name, so it is refused instead.
function validateTypedPageName(raw) {
    const unsupported = [...new Set([...raw].filter((character) => !TYPED_NAME_CHARACTER_PATTERN.test(character)))];
    if (unsupported.length === 0) return null;

    return message('validation.unsupportedCharacters', { characters: unsupported.join(CHARACTER_LIST_SEPARATOR) });
}

function validatePageName(name, { isNew = false } = {}) {
    if (!name) return message('validation.invalidName');
    if (!NAME_PATTERN.test(name)) return message('validation.invalidNameCharacters');
    if (LEADING_DIGIT_PATTERN.test(name)) return message('validation.nameStartsWithNumber');
    if (settings.page.protected.includes(name)) return message('validation.protectedName', { name });
    if (isNew && settings.page.reserved.includes(name)) return message('validation.reservedName', { name });
    return null;
}

function validateOutputPath(input) {
    const value = (input ?? '').trim();
    if (!value) return message('validation.invalidPath');
    if (INVALID_PATH_PATTERN.test(value)) return message('validation.invalidPathCharacters');
    return null;
}

function checkRequiredFiles() {
    return requiredFiles().filter((item) => !exists(item.path));
}

module.exports = { validateTypedPageName, validatePageName, validateOutputPath, checkRequiredFiles };
