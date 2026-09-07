const path = require('path');
const settings = require('../config/settings.json');
const { PATHS } = require('./paths');
const { exists, readText, readJson, writeJson } = require('./files');
const { log } = require('./logger');
const { toCamelCase, toTitleCase, formatValue } = require('./text');

function readPagesData() {
    if (!exists(PATHS.pagesData)) {
        log('pagesData.fileMissing', { path: PATHS.pagesData });
        return null;
    }
    try {
        const data = JSON.parse(readText(PATHS.pagesData));
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            log('pagesData.invalidStructure', { file: path.basename(PATHS.pagesData) });
            return null;
        }
        return data;
    } catch (error) {
        log('pagesData.parseFailed', { file: path.basename(PATHS.pagesData), error: error.message });
        return null;
    }
}

function writePagesData(data) {
    writeJson(PATHS.pagesData, data);
}

function createRecord(pageName) {
    const templateFile = path.join(PATHS.templates, settings.page.dataTemplate);

    if (!exists(templateFile)) {
        log('page.templateMissing', { path: templateFile });
        return null;
    }

    return formatValue(readJson(templateFile), { title: toTitleCase(pageName) });
}

function addPageData(pageName) {
    const data = readPagesData();
    if (!data) return;

    const camelName = toCamelCase(pageName);
    if (data[camelName]) {
        log('pagesData.recordExists', { name: camelName });
        return;
    }

    const record = createRecord(pageName);
    if (!record) return;

    data[camelName] = record;

    writePagesData(data);
    log('pagesData.recordAdded', { name: camelName });
}

function removePageData(pageName) {
    const data = readPagesData();
    if (!data) return;

    const camelName = toCamelCase(pageName);
    if (!data[camelName]) {
        log('pagesData.recordMissing', { name: camelName });
        return;
    }

    delete data[camelName];
    writePagesData(data);
    log('pagesData.recordRemoved', { name: camelName });
}

function renamePageData(oldName, newName) {
    const data = readPagesData();
    if (!data) return;

    const oldCamelName = toCamelCase(oldName);
    const newCamelName = toCamelCase(newName);

    if (!data[oldCamelName]) {
        log('pagesData.recordMissing', { name: oldCamelName });
        return;
    }
    if (data[newCamelName]) {
        log('pagesData.recordExists', { name: newCamelName });
        return;
    }

    data[newCamelName] = data[oldCamelName];
    delete data[oldCamelName];

    writePagesData(data);
    log('pagesData.recordRenamed', { source: oldCamelName, destination: newCamelName });
}

module.exports = { readPagesData, addPageData, removePageData, renamePageData };