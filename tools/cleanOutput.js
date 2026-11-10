const path = require('path');
const settings = require('./config/settings.json');
const { PATHS } = require('./lib/paths');
const { readPackageJson } = require('./lib/project');
const { removeDirectory } = require('./lib/files');
const { isProtectedOutput } = require('./lib/outputSafety');
const { log } = require('./lib/logger');

const OUTPUT_KEY = settings.packageJson.outputKey;

const packageJson = readPackageJson();

if (!packageJson[OUTPUT_KEY]) {
    log('output.missingConfiguration', { key: OUTPUT_KEY, file: settings.paths.packageJson });
    process.exit(1);
}

const outputDirectory = path.resolve(PATHS.root, packageJson[OUTPUT_KEY]);

if (isProtectedOutput(outputDirectory)) {
    log('output.refuseClean', { path: outputDirectory, key: OUTPUT_KEY, file: settings.paths.packageJson });
    process.exit(1);
}

if (removeDirectory(outputDirectory)) {
    log('output.cleaned', { path: outputDirectory });
} else {
    log('output.nothingToClean', { path: outputDirectory });
}
