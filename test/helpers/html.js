// Reads the generated HTML pages

const path = require('path');
const { parse } = require('node-html-parser');
const { read, listFiles } = require('./files');

function loadPage(file) {
    return parse(read(file), { comment: false });
}

// Every .html file in the output, with the URL it is served at
function outputPages(outDir) {
    return listFiles(outDir)
        .filter((file) => file.endsWith('.html'))
        .map((file) => ({
            file: path.join(outDir, file),
            url: '/' + file.replace(/(^|\/)index\.html$/, '$1'),
            doc: loadPage(path.join(outDir, file)),
        }));
}

function meta(doc, key) {
    const node = doc.querySelector(`meta[name="${key}"]`) || doc.querySelector(`meta[property="${key}"]`);
    return node ? node.getAttribute('content') : undefined;
}

function linkHref(doc, rel) {
    const node = doc.querySelector(`link[rel="${rel}"]`);
    return node ? node.getAttribute('href') : undefined;
}

function jsonLdBlocks(doc) {
    return doc.querySelectorAll('script[type="application/ld+json"]').map((node) => node.text);
}

// href and src of links, scripts and images that point inside the site
function localReferences(doc) {
    const refs = [];
    for (const node of doc.querySelectorAll('link[href], a[href], script[src], img[src], source[src]')) {
        const value = node.getAttribute('href') ?? node.getAttribute('src');
        if (!value) continue;
        if (/^(https?:)?\/\//.test(value) || /^(mailto|tel|data|javascript):/.test(value) || value.startsWith('#')) continue;
        refs.push(value);
    }
    return refs;
}

module.exports = { loadPage, outputPages, meta, linkHref, jsonLdBlocks, localReferences };
