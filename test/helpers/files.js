// Small file helpers used across tests

const fs = require('fs');
const path = require('path');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
    return JSON.parse(read(file));
}

// JSON with comments and trailing commas, as tsconfig.json allows
function readJsonc(file) {
    const text = read(file);
    let out = '';
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            out += char;
            if (char === '\\') { out += text[++i]; continue; }
            if (char === '"') inString = false;
            continue;
        }
        if (char === '"') { inString = true; out += char; continue; }
        if (char === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
        if (char === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2) + 1; continue; }
        out += char;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function exists(file) {
    return fs.existsSync(file);
}

// Every file under dir, as paths relative to it with forward slashes
function listFiles(dir, { skip = ['node_modules', '.git'] } = {}) {
    const result = [];
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (skip.includes(entry.name)) continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else result.push(path.relative(dir, full).split(path.sep).join('/'));
        }
    };
    if (exists(dir)) walk(dir);
    return result.sort();
}

// Front matter values of a .njk route: { title, permalink, layout }
function frontMatter(file) {
    const match = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    const values = {};
    for (const line of match[1].split(/\r?\n/)) {
        const pair = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
        if (pair) values[pair[1]] = pair[2];
    }
    return values;
}

// A snapshot of a project's sources, to check that a refused command changed nothing
function snapshot(dir) {
    const files = listFiles(dir, { skip: ['node_modules', '.git', 'out'] });
    return Object.fromEntries(files.map((file) => [file, read(path.join(dir, file))]));
}

module.exports = { read, readJson, readJsonc, exists, listFiles, frontMatter, snapshot };
