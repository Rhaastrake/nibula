const settings = require('./config/settings.json');
const { message } = require('./lib/logger');
const { toKebabCase } = require('./lib/text');
const { validatePageName, validateOutputPath, checkRequiredFiles } = require('./lib/validation');
const { addPage, removePage, renamePage } = require('./lib/pageActions');
const { pageExists } = require('./lib/pageArtifacts');
const { updateOutputPath, getCurrentOutputPath } = require('./lib/outputPath');
const { availableLayouts } = require('./lib/layouts');
const { ask, confirm, askChoice, close } = require('./cli/prompt');
const ui = require('./cli/ui');

const NEW_LINE = '\n';
const NO_PREFIX = '';
const NO_LAYOUT = '';

async function askPageName(prompt) {
    const raw = await ask(prompt);
    if (raw === null) return null;

    const name = toKebabCase(raw);
    const error = validatePageName(name);
    if (error) {
        ui.error(error);
        return null;
    }
    return name;
}

async function askLayout() {
    const layouts = availableLayouts();
    if (layouts.length === 0) return NO_LAYOUT;
    if (layouts.length === 1) return layouts[0];

    const choices = layouts.map((name) => ({ label: name, value: name }));
    return askChoice(message('cli.layoutPrompt'), choices);
}

async function handleCreate() {
    const name = await askPageName(ui.promptLine(message('cli.createPrompt')));
    if (!name) return;

    if (pageExists(name)) {
        ui.warning(message('cli.pageExists', { name }));
        return;
    }

    const layoutName = await askLayout();
    if (layoutName === null) {
        ui.notice(message('cli.cancelled'));
        return;
    }

    addPage(name, layoutName);
}

async function handleRemove() {
    const name = await askPageName(ui.promptLine(message('cli.removePrompt')));
    if (!name) return;

    if (!pageExists(name)) {
        ui.warning(message('cli.pageNotFound', { name }));
        return;
    }

    const confirmed = await confirm(message('cli.confirmRemove', { name }));
    if (!confirmed) {
        ui.notice(message('cli.cancelled'));
        return;
    }
    removePage(name);
}

async function handleRename() {
    const oldName = await askPageName(ui.promptLine(message('cli.renameFromPrompt')));
    if (!oldName) return;

    const newName = await askPageName(ui.promptLine(message('cli.renameToPrompt'), NO_PREFIX));
    if (!newName) return;

    if (oldName === newName) {
        ui.warning(message('cli.sameName'));
        return;
    }
    renamePage(oldName, newName);
}

async function handleOutputPath() {
    const current = getCurrentOutputPath();
    const prefix = current
        ? ui.noticePrefix(message('cli.currentOutputPath', { path: current }))
        : NEW_LINE;

    const input = await ask(ui.promptLine(message('cli.outputPathPrompt'), prefix));
    if (input === null) return;

    const error = validateOutputPath(input);
    if (error) {
        ui.error(error);
        return;
    }
    updateOutputPath(input);
}

const ACTIONS = {
    createPage: handleCreate,
    removePage: handleRemove,
    renamePage: handleRename,
    outputPath: handleOutputPath,
};

function findAction(choice) {
    const item = settings.cli.menu.find((entry) => entry.key === choice);
    return item ? ACTIONS[item.action] : null;
}

async function main() {
    const missing = checkRequiredFiles();
    if (missing.length > 0) {
        ui.renderMissingFiles(missing);
        close();
        process.exit(1);
    }

    while (true) {
        ui.renderMenu();

        const choice = await ask(ui.promptLine(message('cli.menuPrompt'), NO_PREFIX));
        if (choice === null) break;

        const action = findAction(choice);
        if (!action) {
            ui.error(message('cli.invalidOption'));
            continue;
        }

        try {
            await action();
        } catch (error) {
            ui.error(message('cli.unexpectedError', { error: error.message }));
        }
    }

    close();
    process.exit(0);
}

main();