// Runs the test suite: node test/run.js [area...] [--spec]
//
//   node test/run.js                 every area
//   node test/run.js build seo cli   only these folders of test/
//   node test/run.js --spec          Node's own detailed output, one line per test
//
// Areas that never touch each other's files run in parallel, as groups.
// Inside a group, files run one at a time: they share the same built project.

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { run } = require('node:test');
const { spec: SpecReporter } = require('node:test/reporters');
const reporter = require('./helpers/reporter');
const { TMP } = require('./helpers/env');

const TEST_DIR = __dirname;
const TIMEOUT_MS = 20 * 60 * 1000;

// Areas in the same group share projects in the temp folder
const GROUPS = [
    ['scaffold', 'repo'],
    ['build', 'seo', 'cli'],
    ['backend'],
    ['servers'],
];

const args = process.argv.slice(2);
const useSpec = args.includes('--spec');
const requested = args.filter((arg) => !arg.startsWith('--'));

const available = GROUPS.flat();
const unknown = requested.filter((area) => !available.includes(area));
if (unknown.length > 0) {
    console.error(`Unknown test area: ${unknown.join(', ')}. Available: ${available.join(', ')}`);
    process.exit(1);
}

function testFiles(area) {
    const dir = path.join(TEST_DIR, area);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((file) => file.endsWith('.test.js')).sort().map((file) => path.join(dir, file));
}

// Locks left by a run that was stopped halfway
function clearLocks() {
    if (!fs.existsSync(TMP)) return;
    for (const entry of fs.readdirSync(TMP)) {
        if (entry.endsWith('.lock')) fs.rmSync(path.join(TMP, entry), { recursive: true, force: true });
    }
}

// Events of several runs as one stream. Each event is tagged with the test
// file its group is running, so a suite defined in a helper file is counted
// under the right file.
async function* merge(streams) {
    const iterators = streams.map((stream) => stream[Symbol.asyncIterator]());
    const running = streams.map(() => null);
    const next = (index) => iterators[index].next().then((result) => ({ index, result }));
    const pending = new Map(iterators.map((_, index) => [index, next(index)]));

    while (pending.size > 0) {
        const { index, result } = await Promise.race(pending.values());
        if (result.done) {
            pending.delete(index);
            continue;
        }
        pending.set(index, next(index));
        const event = result.value;
        const data = event.data || {};
        if (event.type === 'test:dequeue' && data.nesting === 0 && data.file && String(data.file).endsWith('.test.js') && String(data.file).split(path.sep).join('/').endsWith(String(data.name).split('\\').join('/'))) {
            running[index] = path.resolve(data.file);
        }
        if (event.type === 'test:fail') process.exitCode = 1;
        yield { ...event, runningFile: running[index] };
    }
}

clearLocks();

const groups = GROUPS
    .map((group) => group.filter((area) => requested.length === 0 || requested.includes(area)))
    .filter((group) => group.length > 0)
    .map((group) => group.flatMap(testFiles))
    .filter((files) => files.length > 0);

const streams = groups.map((files) => run({ files, concurrency: 1, timeout: TIMEOUT_MS, cwd: path.join(TEST_DIR, '..') }));
const events = Readable.from(merge(streams));

if (useSpec) events.pipe(new SpecReporter()).pipe(process.stdout);
else Readable.from(reporter(events)).pipe(process.stdout);
