// Flags of `nib new`: --lang, --css, --backend
// Shared by bin/nibula.js (checks them before touching an existing project)
// and bin/create.js (uses them in place of the interactive menus)

const FLAG_VALUES = {
    lang: {
        js: 'javascript', javascript: 'javascript',
        ts: 'typescript', typescript: 'typescript',
    },
    css: {
        bootstrap: 'bootstrap', bulma: 'bulma', none: 'none',
    },
    backend: {
        node: 'node', nodejs: 'node', php: 'php', none: 'none',
    },
};

const FLAG_HINTS = {
    lang:    'js, ts',
    css:     'bootstrap, bulma, none',
    backend: 'node, php, none',
};

const FLAG_NAMES = Object.keys(FLAG_VALUES);

// The value a flag stands for, or undefined when it is not one of the accepted ones
function resolveFlag(flag, raw) {
    const key = String(raw).toLowerCase();
    return Object.hasOwn(FLAG_VALUES[flag], key) ? FLAG_VALUES[flag][key] : undefined;
}

// The first problem with the given flags, as a message, or null when they are fine.
// Without a terminal every choice must come from a flag, since no menu can be shown.
function flagsProblem(values, interactive) {
    for (const flag of FLAG_NAMES) {
        const raw = values[flag];
        if (raw !== undefined && resolveFlag(flag, raw) === undefined) {
            return `Unknown value "${raw}" for --${flag}. Use one of: ${FLAG_HINTS[flag]}`;
        }
        if (raw === undefined && !interactive) {
            return `Missing --${flag}. Without a terminal, pass --lang, --css and --backend.`;
        }
    }
    return null;
}

module.exports = { FLAG_NAMES, resolveFlag, flagsProblem };
