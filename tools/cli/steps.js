// Checks shared by the interactive assistant (nib cli) and the direct
// commands (nib create, rename, remove, path). Each one prints its own
// message and returns whether the action can go on.

const settings = require('../config/settings.json');
const { message } = require('../lib/logger');
const { toKebabCase } = require('../lib/text');
const { validateTypedPageName, validatePageName, validateOutputPath, checkRequiredFiles } = require('../lib/validation');
const { pageExists, pageConflicts } = require('../lib/pageArtifacts');
const { getCurrentOutputPath, outputFolderName } = require('../lib/outputPath');
const { availableLayouts } = require('../lib/layouts');
const { askChoice } = require('./prompt');
const ui = require('./ui');

const NEW_PAGE = Object.freeze({ isNew: true });
const NO_LAYOUT = '';
const LAYOUT_SUFFIX = `.${settings.page.layoutExtension}`;
const LIST_SEPARATOR = ', ';

function requireProjectFiles() {
    const missing = checkRequiredFiles();
    if (missing.length === 0) return true;

    ui.renderMissingFiles(missing);
    return false;
}

// Turns the name as typed into the page name, or returns null after saying why
// it can't be used. A null input (prompt cancelled) returns null silently.
function readPageName(raw, options) {
    if (raw === null) return null;

    const name = toKebabCase(raw);
    const error = validateTypedPageName(raw) ?? validatePageName(name, options);
    if (error) {
        ui.error(error);
        return null;
    }
    return name;
}

function requireExistingPage(name) {
    if (pageExists(name)) return true;

    ui.warning(message('cli.pageNotFound', { name }));
    return false;
}

// When renaming, ownName is the page being renamed: its files don't count.
function requireFreePageName(name, ownName) {
    if (pageExists(name)) {
        ui.warning(message('cli.pageExists', { name }));
        return false;
    }

    const conflicts = pageConflicts(name, ownName);
    if (conflicts.length === 0) return true;

    ui.warningList(message('cli.nameConflict', { name }), conflicts);
    ui.notice(message('cli.pickAnotherName'));
    return false;
}

function hasLayoutChoice() {
    return availableLayouts().length > 1;
}

// Asks which layout to use when there is more than one. Returns null if the
// choice was cancelled, and an empty string when the project has no layouts.
async function chooseLayout() {
    const layouts = availableLayouts();
    if (layouts.length === 0) return NO_LAYOUT;
    if (layouts.length === 1) return layouts[0];

    const choices = layouts.map((name) => ({ label: name, value: name }));
    const layoutName = await askChoice(message('cli.layoutPrompt'), choices);
    if (layoutName === null) ui.notice(message('cli.cancelled'));
    return layoutName;
}

// Finds a layout by file name, with or without its extension ("base" or "base.njk").
function findLayout(requested) {
    const layouts = availableLayouts();
    const fileName = requested.endsWith(LAYOUT_SUFFIX) ? requested : `${requested}${LAYOUT_SUFFIX}`;
    if (layouts.includes(fileName)) return fileName;

    ui.error(message('cli.layoutNotFound', { layout: requested, layouts: layouts.join(LIST_SEPARATOR) }));
    return null;
}

function requireDifferentNames(oldName, newName) {
    if (oldName !== newName) return true;

    ui.warning(message('cli.sameName'));
    return false;
}

function requireValidOutputPath(input) {
    const error = validateOutputPath(input);
    if (!error) return true;

    ui.error(error);
    return false;
}

// The current path (if any) and how the input is turned into the output folder.
function outputPathNotes() {
    const current = getCurrentOutputPath();
    const notes = [message('cli.outputPathHint', { folder: outputFolderName() })];
    if (current) notes.unshift(message('cli.currentOutputPath', { path: current }));
    return notes;
}

module.exports = {
    NEW_PAGE,
    requireProjectFiles,
    readPageName,
    requireExistingPage,
    requireFreePageName,
    hasLayoutChoice,
    chooseLayout,
    findLayout,
    requireDifferentNames,
    requireValidOutputPath,
    outputPathNotes,
};
