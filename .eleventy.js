const fs = require("fs");
const { RenderPlugin } = require("@11ty/eleventy");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require("markdown-it-attrs");

// Build output folder. Rewritten by the Nibula CLI: keep it a plain string
const OUTPUT_DIR = "out";

const TEMPLATE_ENGINE = "njk";

const DIRS = {
  input: "src/frontend",
  includes: "components",
  layouts: "layouts",
  data: "data",
};

const COMPONENTS_PATH = `${DIRS.input}/${DIRS.includes}/`;

const BACKEND_SOURCE = "src/backend";
const BACKEND_OUTPUT = `${OUTPUT_DIR}/backend`;

const HEADING_ANCHORS = {
  level: [2, 3, 4],
  permalink: markdownItAnchor.permalink.linkInsideHeader({
    symbol: "#",
    placement: "after",
  }),
};

// Only the files written by Sass and esbuild: passthrough copies such as
// prism.css and bootstrap.bundle.min.js change on every build
const SASS_ESBUILD_OUTPUT = [
  `${OUTPUT_DIR}/css/global.css`,
  `${OUTPUT_DIR}/css/pages/**/*.css`,
  `${OUTPUT_DIR}/js/pages/**/*.js`,
];

// The watcher ignores a glob whose folder does not exist yet, and Sass and
// esbuild create these folders only after the server has started
function createPageOutputFolders() {
  for (const folder of ["css/pages", "js/pages"]) {
    fs.mkdirSync(`${OUTPUT_DIR}/${folder}`, { recursive: true });
  }
}

function copyBackend() {
  if (!fs.existsSync(BACKEND_SOURCE)) return;

  fs.cpSync(BACKEND_SOURCE, BACKEND_OUTPUT, {
    recursive: true,
    filter: (source) => !source.includes(".git"),
  });
}

function openExternalLinksInNewTab(tokens, idx, options, env, self) {
  const href = tokens[idx].attrGet("href") || "";

  if (href.startsWith("http://") || href.startsWith("https://")) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }

  return self.renderToken(tokens, idx, options);
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(RenderPlugin);
  eleventyConfig.addPlugin(syntaxHighlight, { templateFormats: ["md"] });

  eleventyConfig.amendLibrary("md", (markdown) => {
    markdown.renderer.rules.link_open = openExternalLinksInNewTab;
    markdown.use(markdownItAnchor, HEADING_ANCHORS).use(markdownItAttrs);
  });

  eleventyConfig.addFilter("componentsPath", (name) => `${COMPONENTS_PATH}${name}`);

  // Partial included by layouts/base.njk, not a standalone page
  eleventyConfig.ignores.add(`${DIRS.input}/indexing/json-ld.njk`);

  eleventyConfig.addPassthroughCopy(`${DIRS.input}/assets`);

  eleventyConfig.addPassthroughCopy({
    [`${DIRS.input}/hosting/.htaccess`]: ".htaccess",
    [`${DIRS.input}/hosting/web.config`]: "web.config",
  });

  eleventyConfig.addPassthroughCopy({
    "node_modules/prismjs/themes/prism-tomorrow.css": "css/prism.css",
  });

  // CSS frameworks: uncomment the one you are using
  // prettier-ignore
  eleventyConfig.addPassthroughCopy({
    // Bootstrap
    "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js": "js/bootstrap.bundle.min.js",
    "node_modules/bootstrap-icons/font/fonts": "css/fonts",

    // Bulma: CSS only, no JS passthrough needed
  });

  eleventyConfig.on("eleventy.before", copyBackend);

  createPageOutputFolders();

  // Sass and esbuild write straight into the output folder:
  // reload the browser once their files are ready
  eleventyConfig.setServerOptions({ watch: SASS_ESBUILD_OUTPUT });

  return {
    markdownTemplateEngine: TEMPLATE_ENGINE,
    htmlTemplateEngine: TEMPLATE_ENGINE,
    dir: { ...DIRS, output: OUTPUT_DIR },
  };
};
