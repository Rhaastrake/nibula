// Direct commands: the same actions as the nib cli menu, run in one line.
//
//   nib create <page-name> [-l <layout>]
//   nib rename <page-name> <new-name>
//   nib remove <page-name> [-y]
//   nib path [<folder>]
//
// Page names can't contain spaces: words are joined with hyphens
// (nib create about-us). Uppercase letters are fine and become lowercase.

const { message } = require('./lib/logger');
const { toKebabCase } = require('./lib/text');
const { validateTypedPageName } = require('./lib/validation');
const { addPage, removePage, renamePage } = require('./lib/pageActions');
const { updateOutputPath } = require('./lib/outputPath');
const { confirm } = require('./cli/prompt');
const steps = require('./cli/steps');
const ui = require('./cli/ui');

const OPTIONS = Object.freeze({
    layout: { names: ['-l', '-layout'], takesValue: true },
    yes:    { names: ['-y'],            takesValue: false },
});

const OPTION_PREFIX = '-';
const VALUE_SEPARATOR = '=';
const WORD_SEPARATOR = ' ';
const WHITESPACE_PATTERN = /\s/;
const ALL_WHITESPACE_PATTERN = /\s+/g;
const EMPTY = '';

async function create([rawName], { layout }) {
    const name = steps.readPageName(rawName, steps.NEW_PAGE);
    if (!name || !steps.requireFreePageName(name)) return false;

    let layoutName;
    if (layout) {
        layoutName = steps.findLayout(layout);
    } else if (steps.hasLayoutChoice() && !process.stdin.isTTY) {
        ui.error(message('commands.layoutNeeded'));
        return false;
    } else {
        layoutName = await steps.chooseLayout();
    }
    if (layoutName === null) return false;

    return addPage(name, layoutName);
}

async function rename([rawOldName, rawNewName]) {
    const oldName = steps.readPageName(rawOldName);
    if (!oldName || !steps.requireExistingPage(oldName)) return false;

    const newName = steps.readPageName(rawNewName, steps.NEW_PAGE);
    if (!newName) return false;
    if (!steps.requireDifferentNames(oldName, newName)) return false;
    if (!steps.requireFreePageName(newName, oldName)) return false;

    return renamePage(oldName, newName);
}

async function remove([rawName], { yes }) {
    const name = steps.readPageName(rawName);
    if (!name || !steps.requireExistingPage(name)) return false;

    if (!yes) {
        if (!process.stdin.isTTY) {
            ui.error(message('commands.confirmNeeded'));
            return false;
        }
        const confirmed = await confirm(message('cli.confirmRemove', { name }));
        if (!confirmed) {
            ui.notice(message('cli.cancelled'));
            return false;
        }
    }

    return removePage(name);
}

async function outputPath([folder]) {
    if (folder === undefined) {
        for (const note of steps.outputPathNotes()) console.log(note);
        console.log(message('commands.pathChangeHint'));
        return true;
    }
    if (!steps.requireValidOutputPath(folder)) return false;

    return updateOutputPath(folder);
}

const COMMANDS = Object.freeze({
    create: { run: create,     arguments: { min: 1, max: 1 }, options: ['layout'], pageNames: true  },
    rename: { run: rename,     arguments: { min: 2, max: 2 }, options: [],         pageNames: true  },
    remove: { run: remove,     arguments: { min: 1, max: 1 }, options: ['yes'],    pageNames: true  },
    path:   { run: outputPath, arguments: { min: 0, max: 1 }, options: [],         pageNames: false },
});

// A page name typed with spaces, either as several words or in quotes. The
// suggestion shows the same command with hyphens: nib create about-us. Other
// characters that can't be used are reported first, so the suggestion is a
// name that works.
function reportSpacesInName(commandName, positional) {
    const { max } = COMMANDS[commandName].arguments;
    const names = positional.length > max && max === 1
        ? [positional.join(WORD_SEPARATOR)]
        : positional;

    const charactersError = names
        .map((name) => validateTypedPageName(name.replace(ALL_WHITESPACE_PATTERN, EMPTY)))
        .find(Boolean);
    if (charactersError) {
        ui.error(charactersError);
        return;
    }
    const example = positional.length > max && max > 1
        ? message(`commands.usage.${commandName}`)
        : ['nib', commandName, ...names.map(toKebabCase)].join(WORD_SEPARATOR);

    ui.error(message('commands.spacesInName', { example }));
}

function findOption(name) {
    return Object.keys(OPTIONS).find((key) => OPTIONS[key].names.includes(name)) ?? null;
}

// Splits the arguments into positional values and the options the command
// accepts. Returns null after printing the problem.
function parseArguments(commandName, args) {
    const command = COMMANDS[commandName];
    const positional = [];
    const options = {};

    for (let index = 0; index < args.length; index++) {
        const arg = args[index];

        if (!arg.startsWith(OPTION_PREFIX) || arg === OPTION_PREFIX) {
            positional.push(arg);
            continue;
        }

        const [name, inlineValue] = arg.split(VALUE_SEPARATOR, 2);
        const key = findOption(name);
        if (!key || !command.options.includes(key)) {
            ui.error(message('commands.unknownOption', { option: name, command: commandName }));
            return null;
        }

        if (!OPTIONS[key].takesValue) {
            options[key] = true;
            continue;
        }

        const value = inlineValue ?? args[++index];
        if (!value) {
            ui.error(message('commands.missingValue', { option: name }));
            return null;
        }
        options[key] = value;
    }

    const { min, max } = command.arguments;
    const hasSpaces = positional.length > max || positional.some((value) => WHITESPACE_PATTERN.test(value));
    if (command.pageNames && hasSpaces) {
        reportSpacesInName(commandName, positional);
        return null;
    }
    if (positional.length < min) {
        ui.error(message('commands.missingArguments', { usage: message(`commands.usage.${commandName}`) }));
        return null;
    }
    if (positional.length > max) {
        ui.error(message('commands.tooManyArguments', { usage: message(`commands.usage.${commandName}`) }));
        return null;
    }

    return { positional, options };
}

async function main() {
    const [commandName, ...args] = process.argv.slice(2);
    const command = COMMANDS[commandName];
    if (!command) {
        ui.error(message('commands.unknownCommand', { command: commandName }));
        process.exit(1);
    }

    const parsed = parseArguments(commandName, args);
    if (!parsed || !steps.requireProjectFiles()) process.exit(1);

    try {
        const succeeded = await command.run(parsed.positional, parsed.options);
        process.exit(succeeded ? 0 : 1);
    } catch (error) {
        ui.error(message('cli.unexpectedError', { error: error.message }));
        process.exit(1);
    }
}

main();
