const { RenderPlugin } = require("@11ty/eleventy");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require("markdown-it-attrs");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const Image = require("@11ty/eleventy-img");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = "out";
const TEMPLATE_ENGINE = "njk";
const ANCHOR_LEVELS = [2, 3, 4];
const ANCHOR_PERMALINK_SYMBOL = "#";
const ANCHOR_PERMALINK_PLACEMENT = "after";

const MARKDOWN_BASE_PATH = "src/frontend/components/";

module.exports = function (eleventyConfig) {
  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    if (src.includes(".git")) return;

    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const child of fs.readdirSync(src)) {
        copyRecursiveSync(path.join(src, child), path.join(dest, child));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }

  // ---------------------------------------------------------------------------
  // Plugins & markdown
  // ---------------------------------------------------------------------------

  eleventyConfig.addPlugin(RenderPlugin);

  eleventyConfig.addPlugin(syntaxHighlight, {
    templateFormats: ["md"],
  });

  eleventyConfig.amendLibrary("md", (markdownLibrary) => {
    markdownLibrary.renderer.rules.link_open = function (
      tokens,
      idx,
      options,
      env,
      self,
    ) {
      const href = tokens[idx].attrGet("href");

      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        tokens[idx].attrSet("target", "_blank");
        tokens[idx].attrSet("rel", "noopener noreferrer");
      }

      return self.renderToken(tokens, idx, options);
    };

    markdownLibrary
      .use(markdownItAnchor, {
        level: ANCHOR_LEVELS,
        permalink: markdownItAnchor.permalink.linkInsideHeader({
          symbol: ANCHOR_PERMALINK_SYMBOL,
          placement: ANCHOR_PERMALINK_PLACEMENT,
        }),
      })
      .use(markdownItAttrs);
  });

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  eleventyConfig.on("eleventy.before", () => {
    copyRecursiveSync("src/backend", `${OUTPUT_DIR}/backend`);
  });

  // ---------------------------------------------------------------------------
  // Passthrough copy
  // ---------------------------------------------------------------------------

  // Prism syntax highlighting theme
  eleventyConfig.addPassthroughCopy({
    "node_modules/prismjs/themes/prism-tomorrow.css": "css/prism.css",
  });

  // Project assets
  eleventyConfig.addPassthroughCopy("src/frontend/assets");
  eleventyConfig.addPassthroughCopy("src/frontend/robots.txt");

  // Hosting files
  eleventyConfig.addPassthroughCopy({
    "src/frontend/hosting/.htaccess": ".htaccess",
    "src/frontend/hosting/web.config": "web.config",
  });

  // CSS frameworks — uncomment the one you are using
  // prettier-ignore
  eleventyConfig.addPassthroughCopy({
    // Bootstrap
    "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js": "js/bootstrap.bundle.min.js",
    "node_modules/bootstrap-icons/font/fonts": "css/fonts",

    // Bulma — CSS only, no JS passthrough needed
  });

  // ---------------------------------------------------------------------------
  // Shortcodes
  // ---------------------------------------------------------------------------

  eleventyConfig.addFilter(
    "componentsPath",
    (name) => `${MARKDOWN_BASE_PATH}${name}`,
  );

  eleventyConfig.addShortcode("image", async function (src, alt) {
    const metadata = await Image(src, {
      widths: [320, 480, 720, 1280, 1920, 2048, 2560, 3840, 4096, 7680],
      formats: ["webp", "jpeg"],
      outputDir: `${OUTPUT_DIR}/assets/images/`,
      urlPath: "/assets/images/",
    });

    return Image.generateHTML(metadata, {
      alt,
      sizes: "(max-width: 768px) 100vw, 50vw",
      loading: "lazy",
      decoding: "async",
    });
  });

  // ---------------------------------------------------------------------------
  // Watch targets & dev server
  // ---------------------------------------------------------------------------

  eleventyConfig.addWatchTarget("./src/frontend/scss");
  eleventyConfig.addWatchTarget("./src/frontend/routes");
  eleventyConfig.addWatchTarget("./src/frontend/data");
  eleventyConfig.addWatchTarget("./src/frontend/components");

  eleventyConfig.setServerOptions({
    watch: [`${OUTPUT_DIR}/js/**/*.js`],
  });

  // ---------------------------------------------------------------------------
  // Directory configuration
  // ---------------------------------------------------------------------------

  return {
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: TEMPLATE_ENGINE,

    dir: {
      input: "src/frontend",
      output: OUTPUT_DIR,
      includes: "components",
      layouts: "layouts",
      data: "data",
    },
  };
};
