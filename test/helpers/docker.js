// Real web servers in Docker for the nginx and Apache tests. Containers use
// the host network, so they reach a Node backend started by the test on
// 127.0.0.1 and the test reaches them on 127.0.0.1.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { run, runOk, phase } = require('./project');
const { builtProject } = require('./project');
const { TMP, parseCombo } = require('./env');

const IMAGES = {
    nginx: 'nginx:1.27-alpine',
    phpFpm: 'php:8.3-fpm-alpine',
    apache: 'php:8.3-apache',
};

function docker(args, options) {
    return runOk('docker', args, options);
}

function uidArgs() {
    return typeof process.getuid === 'function' ? ['--user', `${process.getuid()}:${process.getgid()}`] : [];
}

function startContainer(args) {
    phase(`docker run ${args[args.length - 1]}`);
    return docker(['run', '-d', '--rm', '--network', 'host', ...args]).stdout.trim();
}

function stopContainer(id) {
    if (id) run('docker', ['rm', '-f', id]);
}

function containerLogs(id) {
    return id ? run('docker', ['logs', id]).output : '';
}

// A copy of a built project's output that a server may write into (the rate
// limiter keeps its files in backend/cache)
function servedOutput(comboId, label) {
    const dir = builtProject(parseCombo(comboId));
    const root = path.join(TMP, 'served', `${comboId}-${label}`);
    fs.rmSync(root, { recursive: true, force: true });
    fs.cpSync(path.join(dir, 'out'), root, { recursive: true });
    if (fs.existsSync(path.join(root, 'backend'))) {
        fs.mkdirSync(path.join(root, 'backend/cache'), { recursive: true });
        fs.chmodSync(path.join(root, 'backend/cache'), 0o777);
    }
    return root;
}

function writeTemp(name, content) {
    const file = path.join(TMP, 'docker-files', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
}

// Builds the Apache image once per variant: mod_rewrite and .htaccess on,
// mod_proxy on or off
function apacheImage(withProxy) {
    const tag = `nibula-test-apache:${withProxy ? 'proxy' : 'plain'}`;
    const dockerfile = [
        `FROM ${IMAGES.apache}`,
        'RUN a2enmod rewrite headers' + (withProxy ? ' proxy proxy_http' : ''),
        'RUN sed -ri "s/AllowOverride None/AllowOverride All/g" /etc/apache2/apache2.conf',
        'RUN sed -ri "s/^Listen 80$/Listen \\${APACHE_PORT}/" /etc/apache2/ports.conf',
        'RUN sed -ri "s/<VirtualHost \\*:80>/<VirtualHost *:\\${APACHE_PORT}>/" /etc/apache2/sites-available/000-default.conf',
    ].join('\n');
    phase(`docker build ${tag}`);
    const context = fs.mkdtempSync(path.join(os.tmpdir(), 'nibula-apache-'));
    fs.writeFileSync(path.join(context, 'Dockerfile'), dockerfile);
    docker(['build', '-q', '-t', tag, context]);
    fs.rmSync(context, { recursive: true, force: true });
    return tag;
}

module.exports = { IMAGES, docker, uidArgs, startContainer, stopContainer, containerLogs, servedOutput, writeTemp, apacheImage };
