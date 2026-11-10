const path = require('path');
const settings = require('../config/settings.json');
const { PATHS } = require('./paths');
const { readText, writeText, readJson, writeJson, removeDirectory } = require('./files');
const { log } = require('./logger');
const { formatText } = require('./text');
const { isTypeScriptProject, scriptEntries } = require('./project');
const { isProtectedOutput } = require('./outputSafety');
const { validateOutputPath } = require('./validation');

const OUTPUT_VARIABLE = settings.eleventy.outputVariable;
const TYPESCRIPT_OUTPUT_KEY = settings.typescript.outputKey;
const OUTPUT_VARIABLE_PATTERN = new RegExp(`const ${OUTPUT_VARIABLE}\\s*=\\s*['"\`]([^'"\`]*)['"\`]`);
const TYPESCRIPT_OUTPUT_PATTERN = new RegExp(`"${TYPESCRIPT_OUTPUT_KEY}"\\s*:\\s*"[^"]*"`);
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;
const BACKSLASH_PATTERN = /\\/g;
const TRAILING_SLASH_PATTERN = /\/+$/;
const FORWARD_SLASH = '/';
const RELATIVE_PREFIX = './';
const EMPTY = '';

function parseOutputDirectory(content) {
    const match = content.match(OUTPUT_VARIABLE_PATTERN);
    return match ? match[1] : null;
}

function isAbsolutePath(target) {
    return path.isAbsolute(target) || WINDOWS_DRIVE_PATTERN.test(target);
}

function updateEleventyConfig(newPath) {
    const content = readText(PATHS.eleventyConfig);
    const updated = content.replace(OUTPUT_VARIABLE_PATTERN, () => `const ${OUTPUT_VARIABLE} = "${newPath}"`);

    if (content === updated) {
        log('output.variableMissing', { variable: OUTPUT_VARIABLE, file: settings.paths.eleventyConfig });
        return;
    }
    writeText(PATHS.eleventyConfig, updated);
    log('output.fileUpdated', { file: settings.paths.eleventyConfig, path: newPath });
}

function updatePackageJson(newPath, oldPath) {
    const packageJson = readJson(PATHS.packageJson);
    const entries = scriptEntries();

    packageJson[settings.packageJson.outputKey] = newPath;
    packageJson[settings.packageJson.scriptsKey] = packageJson[settings.packageJson.scriptsKey] || {};

    const scripts = packageJson[settings.packageJson.scriptsKey];

    for (const { name, marker, template } of settings.outputScripts) {
        const current = scripts[name];
        const token = oldPath ? `${oldPath}${marker}` : null;

        if (current && token && current.includes(token)) {
            scripts[name] = current.split(token).join(`${newPath}${marker}`);
        } else {
            scripts[name] = formatText(template, { output: newPath, entries });
        }
    }

    writeJson(PATHS.packageJson, packageJson);
    log('output.fileUpdated', { file: settings.paths.packageJson, path: newPath });
}

function updateTypeScriptConfig(newPath) {
    if (!isTypeScriptProject()) return;

    const prefix = isAbsolutePath(newPath) ? EMPTY : RELATIVE_PREFIX;
    const outputDirectory = `${prefix}${newPath}${FORWARD_SLASH}${settings.typescript.outputSubdirectory}`;
    const content = readText(PATHS.typescriptConfig);
    const updated = content.replace(TYPESCRIPT_OUTPUT_PATTERN, () => `"${TYPESCRIPT_OUTPUT_KEY}": "${outputDirectory}"`);

    if (content === updated) {
        log('output.keyMissing', { key: TYPESCRIPT_OUTPUT_KEY, file: settings.paths.typescriptConfig });
        return;
    }
    writeText(PATHS.typescriptConfig, updated);
    log('output.fileUpdated', { file: settings.paths.typescriptConfig, path: outputDirectory });
}

function deleteOldOutput(oldPath) {
    if (!oldPath) return;

    const target = path.resolve(PATHS.root, oldPath);
    const insideProject = target.startsWith(PATHS.root + path.sep);

    if (!insideProject || isProtectedOutput(target)) {
        log('output.refuseDelete', { path: target });
        return;
    }
    if (removeDirectory(target)) {
        log('output.directoryDeleted', { path: target });
    }
}

function outputFolderName() {
    return `${path.basename(PATHS.root)}${settings.project.outputSuffix}`;
}

// The input is the folder the output goes in: "../sites" becomes
// "../sites/<project>-out". "." and "out" restore the default, and a path that
// already ends in "<project>-out" (the current one, typed again) is kept as is.
function normalizeOutputPath(rawPath) {
    const trimmed = (rawPath ?? '').trim().replace(BACKSLASH_PATTERN, FORWARD_SLASH);
    if (!trimmed) return null;

    const { currentDirectory, defaultOutputDirectory } = settings.project;
    if (trimmed === currentDirectory || trimmed === defaultOutputDirectory) return defaultOutputDirectory;

    const parent = trimmed.replace(TRAILING_SLASH_PATTERN, EMPTY);
    if (path.posix.basename(parent) === outputFolderName()) return parent;

    return `${parent}${FORWARD_SLASH}${outputFolderName()}`;
}

function updateOutputPath(rawPath) {
    const normalizedPath = normalizeOutputPath(rawPath);
    if (!normalizedPath) {
        log('output.emptyPath');
        return;
    }

    const invalidPath = validateOutputPath(normalizedPath);
    if (invalidPath) {
        log('output.invalidPath', { path: normalizedPath, error: invalidPath });
        return;
    }
    if (isProtectedOutput(normalizedPath)) {
        log('output.protectedPath', { path: normalizedPath });
        return;
    }

    let oldPath = null;
    try {
        oldPath = parseOutputDirectory(readText(PATHS.eleventyConfig));
    } catch (error) {
        log('output.readFailed', { file: settings.paths.eleventyConfig, error: error.message });
        return;
    }

    if (oldPath === normalizedPath) {
        log('output.unchanged', { path: normalizedPath });
        return;
    }

    deleteOldOutput(oldPath);
    log('output.updating', { path: normalizedPath });

    try {
        updatePackageJson(normalizedPath, oldPath);
        updateEleventyConfig(normalizedPath);
        updateTypeScriptConfig(normalizedPath);
    } catch (error) {
        log('output.updateFailed', { error: error.message });
    }
}

function getCurrentOutputPath() {
    try {
        return parseOutputDirectory(readText(PATHS.eleventyConfig));
    } catch {
        return null;
    }
}

module.exports = { updateOutputPath, getCurrentOutputPath, outputFolderName };
