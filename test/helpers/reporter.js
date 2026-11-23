// Test reporter for node:test, used by test/run.js.
//
// In a terminal: one progress bar per area (a folder of test/) that redraws
// while the tests run, with a spinner on what is running now. At the end only
// the bars, the failures and a summary stay on screen.
// Without a terminal (CI logs): one plain line per finished file, then the
// same failures and summary.
//
// Helpers announce slow steps with a "[nibula] <step>" line on stderr (see
// phase() in project.js): the spinner shows it instead of printing it.

const fs = require('fs');
const path = require('path');
const { TMP_ROOT, currentCombo } = require('./env');

const TTY = Boolean(process.stdout.isTTY);
const COLOR = TTY && !process.env.NO_COLOR;
const TOTALS_FILE = path.join(TMP_ROOT, 'reporter-totals.json');
const TEST_ROOT = path.resolve(__dirname, '..');
const PHASE_PREFIX = '[nibula] ';

const BAR_WIDTH = 20;
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_MS = 100;
const MAX_ERROR_LINES = 14;

// ── OUTPUT HELPERS ──────────────────────────────────────────────────────────

const paint = (code) => (text) => (COLOR ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const green = paint('32');
const red = paint('31');
const yellow = paint('33');
const dim = paint('2');
const bold = paint('1');
const cyan = paint('36');

function stripAnsi(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// Cuts a line to the terminal width, ignoring color codes in the count
function fit(line) {
    const width = (process.stdout.columns || 100) - 1;
    if (stripAnsi(line).length <= width) return line;
    let visible = 0;
    let result = '';
    for (let i = 0; i < line.length; i++) {
        const escape = line.slice(i).match(/^\x1b\[[0-9;]*m/);
        if (escape) { result += escape[0]; i += escape[0].length - 1; continue; }
        if (visible >= width - 1) break;
        result += line[i];
        visible++;
    }
    return `${result}…${COLOR ? '\x1b[0m' : ''}`;
}

function seconds(ms) {
    return ms >= 60000 ? `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s` : `${(ms / 1000).toFixed(1)}s`;
}

function clock(ms) {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ── STATE ───────────────────────────────────────────────────────────────────

function readTotals() {
    try { return JSON.parse(fs.readFileSync(TOTALS_FILE, 'utf8')); } catch { return {}; }
}

function saveTotals(totals) {
    try {
        fs.mkdirSync(TMP_ROOT, { recursive: true });
        fs.writeFileSync(TOTALS_FILE, JSON.stringify(totals, null, 2));
    } catch { /* only a hint for the next run */ }
}

function createState() {
    let combo = '';
    try { combo = currentCombo().id; } catch { combo = process.env.NIBULA_COMBO || ''; }
    return {
        combo,
        started: Date.now(),
        areas: new Map(),
        files: new Map(),
        failures: [],
        skips: [],
        cachedTotals: readTotals(),
    };
}

function areaOf(file) {
    const relative = path.relative(TEST_ROOT, file);
    return relative.split(path.sep)[0] || 'test';
}

function getArea(state, name) {
    if (!state.areas.has(name)) {
        state.areas.set(name, {
            name, files: 0, filesDone: 0, enqueued: 0, suites: 0,
            passed: 0, failed: 0, skipped: 0, start: null, end: null, current: '', phase: '',
        });
    }
    return state.areas.get(name);
}

function getFile(state, file) {
    if (!state.files.has(file)) {
        state.files.set(file, { area: areaOf(file), stack: [], passed: 0, failed: 0, skipped: 0, start: null, stderr: '', failedBefore: 0 });
    }
    return state.files.get(file);
}

// node:test wraps each file in a test named after the file itself
function isFileWrapper(data) {
    if (data.nesting !== 0 || !data.file || !data.name) return false;
    const slash = (value) => String(value).split('\\').join('/');
    return slash(data.file).endsWith(slash(data.name));
}

function areaTotal(state, area) {
    const counted = area.enqueued - area.suites;
    const cached = state.cachedTotals[`${state.combo}:${area.name}`];
    const finished = area.files > 0 && area.filesDone === area.files;
    if (finished) return area.passed + area.failed + area.skipped;
    return Math.max(cached || 0, counted, area.passed + area.failed + area.skipped);
}

// ── EVENTS ──────────────────────────────────────────────────────────────────

function errorText(error) {
    if (!error) return '';
    const cause = error.cause && typeof error.cause === 'object' ? error.cause : error;
    const message = (cause.message || String(cause)).replace(/\s+$/, '');
    const lines = message.split('\n').filter((line, index, all) => !(line === '' && all[index - 1] === ''));
    const shown = lines.slice(0, MAX_ERROR_LINES);
    if (lines.length > MAX_ERROR_LINES) shown.push(dim(`… ${lines.length - MAX_ERROR_LINES} more lines`));
    return shown.join('\n');
}

function handle(state, event, onFileDone) {
    const data = event.data || {};
    const details = data.details || {};

    // Set by test/run.js: the test file the event's group is running
    const running = event.runningFile || state.runningFile;

    if (event.type === 'test:stderr' && data.file) {
        const file = getFile(state, running || path.resolve(data.file));
        for (const line of String(data.message).split('\n')) {
            if (line.startsWith(PHASE_PREFIX)) getArea(state, file.area).phase = line.slice(PHASE_PREFIX.length);
            else if (line.trim()) file.stderr = `${file.stderr}${line}\n`.slice(-4000);
        }
        return;
    }

    if (!data.file) return;
    // A suite defined in a helper (backend-suite.js) belongs to the test file running now
    const ownFile = path.resolve(data.file);
    const fileName = ownFile.endsWith('.test.js') || !running ? ownFile : running;
    const file = getFile(state, fileName);
    const area = getArea(state, file.area);

    if (isFileWrapper(data)) {
        if (event.type === 'test:enqueue') area.files++;
        if (event.type === 'test:dequeue') {
            state.runningFile = fileName;
            file.start = Date.now();
            if (!area.start) area.start = file.start;
        }
        // The wrapper ends with test:complete, not with test:pass or test:fail
        if (event.type === 'test:complete') {
            if (details.passed === false && file.failed === 0) {
                // The file itself crashed (syntax error, error outside any test)
                area.failed++;
                file.failed++;
                state.failures.push({ area: file.area, title: path.relative(TEST_ROOT, fileName), file: fileName, line: 1, text: errorText(details.error) || file.stderr.trim() });
            }
            area.filesDone++;
            area.phase = '';
            area.current = '';
            area.end = Date.now();
            onFileDone(fileName, file);
        }
        return;
    }

    if (event.type === 'test:enqueue') {
        area.enqueued++;
        return;
    }

    if (event.type === 'test:dequeue') {
        file.stack[data.nesting] = data.name;
        file.stack.length = data.nesting + 1;
        area.current = file.stack.join(' › ');
        return;
    }

    if (event.type !== 'test:pass' && event.type !== 'test:fail') return;

    const title = [...file.stack.slice(0, data.nesting), data.name].join(' › ');

    if (details.type === 'suite') {
        area.suites++;
        if (data.skip) {
            area.skipped++;
            file.skipped++;
            state.skips.push({ area: file.area, title: data.name, reason: data.skip === true ? '' : data.skip });
        }
        if (event.type === 'test:fail' && details.error && details.error.failureType === 'hookFailed') {
            state.failures.push({ area: file.area, title: `${title} (setup)`, file: fileName, line: data.line, text: errorText(details.error) });
        }
        return;
    }

    if (data.skip || data.todo) {
        area.skipped++;
        file.skipped++;
        if (data.skip && data.skip !== true) state.skips.push({ area: file.area, title, reason: data.skip });
        return;
    }

    if (event.type === 'test:pass') {
        area.passed++;
        file.passed++;
        return;
    }

    area.failed++;
    file.failed++;
    if (details.error && details.error.failureType === 'cancelledByParent') {
        state.cancelled = (state.cancelled || 0) + 1;
        return;
    }
    state.failures.push({ area: file.area, title, file: fileName, line: data.line, text: errorText(details.error) });
}

// ── DRAWING ─────────────────────────────────────────────────────────────────

function bar(area, total) {
    if (total === 0) return dim('░'.repeat(BAR_WIDTH));
    const cells = (count) => Math.round((count / total) * BAR_WIDTH);
    const failed = area.failed > 0 ? Math.max(1, cells(area.failed)) : 0;
    const skipped = area.skipped > 0 ? Math.max(1, cells(area.skipped)) : 0;
    const passed = Math.min(BAR_WIDTH - failed - skipped, cells(area.passed));
    const rest = Math.max(0, BAR_WIDTH - passed - failed - skipped);
    return green('█'.repeat(passed)) + red('█'.repeat(failed)) + yellow('█'.repeat(skipped)) + dim('░'.repeat(rest));
}

function areaLine(state, area, frame) {
    const total = areaTotal(state, area);
    const done = area.passed + area.failed + area.skipped;
    const finished = area.files > 0 && area.filesDone === area.files;
    const running = area.start && !finished;
    const label = area.name.padEnd(9);
    const count = `${String(done).padStart(4)}/${String(total).padEnd(4)}`;

    let status = '';
    if (finished) {
        const time = dim(seconds((area.end || Date.now()) - area.start));
        if (area.failed > 0) status = `${red(`✖ ${area.failed}`)}  ${time}`;
        else if (area.skipped > 0 && area.passed === 0) status = `${yellow('⏭ skipped')}  ${time}`;
        else status = `${green('✔')}  ${time}`;
    } else if (running) {
        status = `${cyan(SPINNER[frame % SPINNER.length])} ${dim(area.phase ? `${area.phase}…` : area.current)}`;
    }
    const name = finished || running ? bold(label) : dim(label);
    return fit(` ${name} ${bar(area, total)} ${running || finished ? count : dim(count)}  ${status}`);
}

function totals(state) {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const area of state.areas.values()) {
        passed += area.passed;
        failed += area.failed;
        skipped += area.skipped;
    }
    return { passed, failed, skipped };
}

function countsLine(state) {
    const { passed, failed, skipped } = totals(state);
    return ` ${green(`✔ ${passed}`)}  ${failed ? red(`✖ ${failed}`) : dim('✖ 0')}  ${skipped ? yellow(`⏭ ${skipped}`) : dim('⏭ 0')}  ${dim(`· ${clock(Date.now() - state.started)}`)}`;
}

function liveBlock(state, frame) {
    const lines = ['', ` ${bold('Nibula tests')}${state.combo ? dim(` · ${state.combo}`) : ''}`, ''];
    for (const area of state.areas.values()) lines.push(areaLine(state, area, frame));
    lines.push('', countsLine(state));
    return lines;
}

function indent(text, prefix) {
    return text.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function finalReport(state) {
    const out = [];
    const { passed, failed, skipped } = totals(state);

    if (state.failures.length > 0) {
        out.push('', ` ${bold(red('Failures'))}`, '');
        for (const failure of state.failures) {
            out.push(` ${red('✖')} ${dim(`${failure.area} ›`)} ${failure.title}`);
            out.push(dim(`   ${path.relative(process.cwd(), failure.file)}:${failure.line}`));
            if (failure.text) out.push(indent(failure.text, '     '));
            out.push('');
        }
        if (state.cancelled) out.push(dim(` + ${state.cancelled} tests not run because their setup failed`), '');
    }

    if (state.skips.length > 0) {
        if (out[out.length - 1] !== '') out.push('');
        out.push(` ${bold(yellow('Skipped'))}`);
        const seen = new Set();
        for (const skip of state.skips) {
            const line = ` ${yellow('⏭')} ${dim(`${skip.area} ›`)} ${skip.title}${skip.reason ? dim(` — ${skip.reason}`) : ''}`;
            if (!seen.has(line)) { seen.add(line); out.push(line); }
        }
        out.push('');
    }

    const slowest = [...state.areas.values()]
        .filter((area) => area.start && area.end)
        .sort((a, b) => (b.end - b.start) - (a.end - a.start))
        .slice(0, 3)
        .map((area) => `${area.name} ${seconds(area.end - area.start)}`);

    if (out.length === 0 || out[out.length - 1] !== '') out.push('');
    const verdict = failed > 0 ? red(bold(' FAIL ')) : green(bold(' PASS '));
    out.push(` ${verdict} ${green(`✔ ${passed}`)}  ${failed ? red(`✖ ${failed}`) : dim('✖ 0')}  ${skipped ? yellow(`⏭ ${skipped}`) : dim('⏭ 0')}   ${seconds(Date.now() - state.started)}`);
    if (slowest.length > 1) out.push(dim(` slowest: ${slowest.join(' · ')}`));
    out.push('');
    return `${out.join('\n')}\n`;
}

// ── REPORTER ────────────────────────────────────────────────────────────────

module.exports = async function* reporter(source) {
    const state = createState();
    let drawn = 0;
    let frame = 0;

    const draw = () => {
        if (!TTY) return;
        const lines = liveBlock(state, frame++);
        let output = drawn > 0 ? `\x1b[${drawn}A` : '\x1b[?25l';
        output += lines.map((line) => `\x1b[2K${line}`).join('\n') + '\n';
        process.stdout.write(output);
        drawn = lines.length;
    };

    const restoreCursor = () => { if (TTY) process.stdout.write('\x1b[?25h'); };
    process.once('exit', restoreCursor);

    const timer = TTY ? setInterval(draw, FRAME_MS) : null;
    if (timer) timer.unref();

    const onFileDone = (fileName, file) => {
        if (TTY) return;
        const name = path.relative(TEST_ROOT, fileName).padEnd(34);
        const mark = file.failed ? red('✖') : file.passed ? green('✔') : yellow('⏭');
        const parts = [`${file.passed} passed`];
        if (file.failed) parts.push(`${file.failed} failed`);
        if (file.skipped) parts.push(`${file.skipped} skipped`);
        process.stdout.write(` ${mark} ${name} ${parts.join(', ').padEnd(30)} ${seconds(Date.now() - (file.start || Date.now()))}\n`);
    };

    if (!TTY) process.stdout.write(`\n Nibula tests${state.combo ? ` · ${state.combo}` : ''}\n\n`);

    for await (const event of source) {
        handle(state, event, onFileDone);
    }

    if (timer) clearInterval(timer);
    draw();
    restoreCursor();

    const next = { ...state.cachedTotals };
    for (const area of state.areas.values()) {
        if (area.files > 0 && area.filesDone === area.files) next[`${state.combo}:${area.name}`] = area.passed + area.failed + area.skipped;
    }
    saveTotals(next);

    yield finalReport(state);
};
