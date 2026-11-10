const settings = require('./config/settings.json');
const { message } = require('./lib/logger');
const { addPage, removePage, renamePage } = require('./lib/pageActions');
const { updateOutputPath } = require('./lib/outputPath');
const { ask, confirm, close } = require('./cli/prompt');
const steps = require('./cli/steps');
const ui = require('./cli/ui');

const NEW_LINE = '\n';
const NO_PREFIX = '';

async function handleCreate() {
    const name = steps.readPageName(await ask(ui.promptLine(message('cli.createPrompt'))), steps.NEW_PAGE);
    if (!name || !steps.requireFreePageName(name)) return;

    const layoutName = await steps.chooseLayout();
    if (layoutName === null) return;

    addPage(name, layoutName);
}

async function handleRemove() {
    const name = steps.readPageName(await ask(ui.promptLine(message('cli.removePrompt'))));
    if (!name || !steps.requireExistingPage(name)) return;

    const confirmed = await confirm(message('cli.confirmRemove', { name }));
    if (!confirmed) {
        ui.notice(message('cli.cancelled'));
        return;
    }
    removePage(name);
}

async function handleRename() {
    const oldName = steps.readPageName(await ask(ui.promptLine(message('cli.renameFromPrompt'))));
    if (!oldName || !steps.requireExistingPage(oldName)) return;

    const newName = steps.readPageName(await ask(ui.promptLine(message('cli.renameToPrompt'), NO_PREFIX)), steps.NEW_PAGE);
    if (!newName) return;
    if (!steps.requireDifferentNames(oldName, newName)) return;
    if (!steps.requireFreePageName(newName, oldName)) return;

    renamePage(oldName, newName);
}

async function handleOutputPath() {
    const prefix = ui.noticePrefix(steps.outputPathNotes().join(NEW_LINE));

    const input = await ask(ui.promptLine(message('cli.outputPathPrompt'), prefix));
    if (input === null || !steps.requireValidOutputPath(input)) return;

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
    if (!steps.requireProjectFiles()) {
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
