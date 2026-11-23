// Where the files of a page live, and checks that pages.json, routes, styles
// and scripts agree with each other

const path = require('path');
const { exists, readJson, listFiles, frontMatter } = require('./files');

function camelCase(name) {
    return name.toLowerCase().replace(/[-_][a-z0-9]/g, (group) => group.slice(1).toUpperCase());
}

function pageFiles(dir, name, lang) {
    const camel = camelCase(name);
    return {
        camel,
        route: path.join(dir, 'src/frontend/routes', `${name}.njk`),
        style: path.join(dir, 'src/frontend/scss/pages', `${camel}.scss`),
        script: path.join(dir, 'src/frontend', lang, 'pages', `${camel}.${lang}`),
    };
}

function pagesJson(dir) {
    return readJson(path.join(dir, 'src/frontend/data/pages.json'));
}

// Problems between pages.json and the page files, as a list of messages
function pageInconsistencies(dir, lang) {
    const problems = [];
    const data = pagesJson(dir);
    const routes = listFiles(path.join(dir, 'src/frontend/routes')).map((file) => file.replace(/\.njk$/, ''));
    const keys = new Set(Object.keys(data));
    const seen = new Set();

    for (const route of routes) {
        const files = pageFiles(dir, route, lang);
        const { title, permalink } = frontMatter(files.route);
        if (title !== files.camel) problems.push(`${route}.njk: title "${title}", expected "${files.camel}"`);
        if (!keys.has(files.camel)) problems.push(`${route}: no "${files.camel}" in pages.json`);
        if (!exists(files.style)) problems.push(`${route}: missing ${path.basename(files.style)}`);
        if (!exists(files.script)) problems.push(`${route}: missing ${path.basename(files.script)}`);
        const expectedPermalink = route === 'homepage' ? '/' : route === '404' ? '404.html' : `/${route}/`;
        if (permalink !== expectedPermalink) problems.push(`${route}.njk: permalink "${permalink}", expected "${expectedPermalink}"`);
        seen.add(files.camel);
    }
    for (const key of keys) {
        if (!seen.has(key)) problems.push(`pages.json has "${key}" but no route`);
        if (!data[key].seo || !data[key].cdn) problems.push(`pages.json "${key}" lacks seo or cdn`);
    }

    const styles = listFiles(path.join(dir, 'src/frontend/scss/pages')).map((file) => file.replace(/\.scss$/, ''));
    const scripts = listFiles(path.join(dir, 'src/frontend', lang, 'pages')).map((file) => file.replace(/\.(js|ts)$/, ''));
    for (const orphan of [...styles, ...scripts]) {
        if (!seen.has(orphan)) problems.push(`orphan page file: ${orphan}`);
    }
    return problems;
}

module.exports = { camelCase, pageFiles, pagesJson, pageInconsistencies };
