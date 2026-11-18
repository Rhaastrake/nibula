const messages = require('../config/messages.json');
const { formatText } = require('./text');
const { paint } = require('./colors');

const KEY_SEPARATOR = '.';

function resolveTemplate(key) {
    return key.split(KEY_SEPARATOR).reduce(
        (current, part) => (current !== null && typeof current === 'object' ? current[part] : undefined),
        messages
    );
}

function message(key, values) {
    const template = resolveTemplate(key);
    return typeof template === 'string' ? formatText(template, values) : key;
}

// Lines tagged [skip] or [error] get a warning or failure mark, every other
// [tag] line a green check, so the outcome stands out before the text.
const TAG_MARKS = Object.freeze({
    skip:  paint('yellow', '\u26a0'),
    error: paint('red', '\u2716'),
});
const SUCCESS_MARK = paint('green', '\u2713');

function withMark(text) {
    const match = /^\[([a-z]+)\]/.exec(text);
    if (!match) return text;
    return `${TAG_MARKS[match[1]] ?? SUCCESS_MARK} ${text}`;
}

function log(key, values) {
    console.log(withMark(message(key, values)));
}

module.exports = { message, log };
