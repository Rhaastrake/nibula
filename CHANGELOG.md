# Changelog

All notable changes to Nibula are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.1] - 2026-09-21

### Fixed
- Creating a page with the CLI didn't add its record to `pages.json`. The template the record is built from, `tools/res/templates/template.json`, was lost when the 3.0.0 changes were merged, so the assistant created the three files and silently skipped the record.
- Commands run outside a project printed `undefined` instead of saying so. The message was imported from a module that no longer exported it.

### Notes
- Pages created with 3.0.0 have no record in `pages.json`. Their SEO falls back to the site-wide values from `site.json`; add a record for each one by hand, or remove and recreate the page with the CLI.

## [3.0.0] - 2026-09-14

### Added
- Endpoints now export one function per HTTP method instead of checking the method by hand. Unsupported methods get an automatic 405, and the file itself shows at a glance which methods it answers. The old single-function form still works.
- A `Validate` module with `required`, `integer`, `email` and `minLength`. Each rule either returns the value or stops the request with a 422 and a readable message, so endpoints no longer repeat the same checks.
- Endpoints receive `query`, `body`, `rawBody` and `headers` in both backends. The PHP side previously left the body to the endpoint, which meant every project reimplemented the same `json_decode`.
- A `Debug-Mode` header on every response when `APP_ENV` is not `production`, so a site left in debug mode is visible without reading the config.

### Changed
- **BREAKING** Renamed `src/backend/_core` to `src/backend/core`. The underscore prefix carried no meaning: no tool interpreted it, it only made the path noisier than its siblings.
- **BREAKING** Renamed `src/backend/api` to `src/backend/endpoints`. The folder holds route files, while `/api` is the public URL prefix, and using one name for two concepts was the main source of confusion when reading the front controller. Endpoints are still reached at `domain/api/endpoint`.
- **BREAKING** A missing API key now returns 401 instead of 403. The previous code said "forbidden" for a request that was never authenticated.
- **BREAKING** The backend no longer starts without `config.js` or `config.php`. It used to fall back to the example file, which ships a publicly known API key and allows every origin.
- **BREAKING** The bundled `nginx.conf`, `.htaccess` and `web.config` now point at `backend/core` instead of `backend/_core`. Any custom server rule referring to the old path needs updating.
- **BREAKING** Removed the `build-js` command. Projects now call `esbuild` directly in their `build:js` and `serve:js` scripts, with the entry pattern written out in full. `nib` is for the commands it offers, not a wrapper around the build.
- **BREAKING** The global stylesheet is loaded by the layout instead of being imported by each page. `_global.scss` is now `global.scss`, so Sass compiles it into `out/css/global.css`, and `base.njk` links it before the page's own file. Until now every page's CSS carried a full copy of the framework and of every module, so a visitor reading three pages downloaded the same thing three times with no way to cache it.
- **BREAKING** Page stylesheets no longer start with `@import "../global"`. A new page opens with the `@use "../root"` line and nothing else, since everything shared now arrives from the layout.
- **BREAKING** Removed Foundation and UIkit from the frameworks offered at project creation. Four libraries covering the same ground made the choice harder without covering a case the other two miss, and each one carried a module file, a set of markers and a dependency in every project.
- Endpoints only receive the documented request values. They previously saw every local variable of the front controller by accident, which made internal renames a breaking change without anyone noticing.
- `RateLimiter` is now created per request like `Response`, instead of taking the response helpers as trailing arguments.
- The PHP backend removes the `X-Powered-By` header, which exposed the exact PHP version on every response.
- `Response.php` no longer carries its own access guard and 404 fallback. Every request already goes through the front controller, so the guard could never fire, and it duplicated error-page logic inside a module that only formats responses.
- Removed the `glob` dependency from new projects. It existed only to expand the entry pattern before handing it to esbuild, which expands it by itself.

### Fixed
- A custom endpoint key or origin list set to an empty value no longer falls back to the general one.
- The PHP exception handler no longer captures the config before it exists, which used to hide the real cause of startup errors behind a generic 500.

### Notes
- **To migrate the stylesheets:** rename `_global.scss` to `global.scss`, remove `@import "../global"` from every file in `scss/pages/`, and add the global stylesheet link to `base.njk` above the page one.
- **`nib build-js` no longer exists.** A project created before this release has it in its `package.json` and its build will fail after updating. Replace the two scripts with:

```
  "build:js": "esbuild \"src/frontend/js/pages/*.js\" --bundle --outdir=out/js/pages --minify",
  "serve:js": "esbuild \"src/frontend/js/pages/*.js\" --bundle --outdir=out/js/pages --watch"
```

  A TypeScript project uses `src/frontend/ts/pages/*.ts` instead.

- **Foundation and UIkit are no longer offered.** An existing project that uses one keeps working: nothing is removed from it. A new project that wants them can install the package and add the import by hand, the same way any other library works.

## [2.5.0] - 2026-09-07

### Changed
- The data record a new page gets in `pages.json` comes from `tools/res/templates/template.json` instead of being written inside `settings.json`. It's content, like the route, the stylesheet and the script, and it now sits with the other three templates rather than in the CLI's configuration.

## [2.4.7] - 2026-09-04

### Changed
- **New page and global scripts no longer wrap their code in `DOMContentLoaded`.**
  Scripts are loaded at the end of the body, so the page is already there when
  they run: the wrapper was a precaution that a beginner had to understand before
  being able to ignore it. The documentation explains when to add it back.
- The TypeScript module template annotates its return type, so the first file a
  TypeScript project opens actually shows TypeScript syntax.

## [2.4.6] - 2026-08-29

### Changed

- Restored `404.scss` **.not-found** selector to center the not found text.
- Removed all comments in backend files.

## [2.4.5] - 2026-08-26

### Fixed
- **A project scaffolded with 2.4.4 wouldn't start.** The passthrough entry for
  the CSS framework spanned two lines, so commenting out the marker line left the
  destination string orphaned inside the object and `.eleventy.js` failed to
  parse. Every key-value pair now sits on one line, with `// prettier-ignore`
  above the block so a formatter can't split them again.
- The Bootstrap passthrough was declared twice — once in the block added for the
  Prism theme and once among the framework markers — so the scaffolder commented
  out both copies and produced two broken entries instead of one.
  
## [2.4.4] - 2026-08-26

### Changed
- **`site_name` is now `siteName` and `author` is an object** with `fullName` and
  `website`. The author's site feeds the JSON-LD `Person.url` and the `llms.txt`
  header, which previously reused the site URL for both.
- The documentation moved out of the repository and onto
  [rhaastrake.github.io/Nibula](https://rhaastrake.github.io/Nibula/docs/). The
  `docs/` folder now holds the built site and is excluded from the published
  package, so `npm install` no longer carries the Markdown files.
- The README follows the same structure as the documentation's introduction, and
  points at the site instead of the files that used to live in `docs/`.

### Fixed
- The documentation card in `welcome.njk` linked to `Nibula/tree/main/docs`,
  which now holds the built site rather than readable Markdown.
- `welcome.njk` shipped with a leftover `{{ test.prova }}` referencing a data
  file no scaffolded project has.

### Notes
- **Existing projects need two edits to `src/frontend/data/site.json`** if you
  update their templates: rename `site_name` to `siteName`, and turn `author`
  into `{ "fullName": "...", "website": "..." }`. Leaving the file as it is keeps
  the old templates working — the two only have to move together.

## [2.4.3] 2026-08-24

### Changes
- Minor changes in template files for new pages

## [2.4.2] 2026-08-24

### Fixed
- Fixed markdown file components not acepting some of njk keywords

## [2.4.1] 2026-08-24

### Changed
- Changed template.njk snippets for renderFile
- markdown files used as components will now require {class="class"} or {id="id"} instead of {#id} or {.class}

### Fixed
- Fixed json data files passed in renderfile to markdown files not rendering

## [2.4.0] - 2026-08-23

### Added
- `ignoreMissing` on header and footer includes in `base.njk`, so a project without those components still builds

### Changed
- Copyright notice centered below a rule in the footer
- Removed `_animations.scss` and `_mobile.scss` from the default SCSS modules — responsive rules now live in the module they belong to
- Reviewed commented snippets across SCSS, JS and TS templates
- Raised scaffold dependency floors: `esbuild` to `^0.28.2` and `@11ty/eleventy-img` to `^7.0.0` close known advisories; `@11ty/eleventy`, `sass`, `uikit` and `concurrently` aligned to current releases
- In new pages.njk files, renderfiel will be inside a div and not in an article tag

### Fixed
- Removing a page with the CLI no longer deletes its build output — the output directory is a build artifact and may be live in production
- Corrected the local CLI version label

## [2.3.0] - 2026-08-19

### Added
- **Code blocks in Markdown are syntax highlighted.** `@11ty/eleventy-plugin-syntaxhighlight`
  runs PrismJS at build time — no client-side JavaScript — and a Prism theme is
  copied to `css/prism.css` and linked in `base.njk`. Adding a language to the
  fence (```` ```json ````) colours the block; leaving the fence bare renders it
  plain, which is what you want for a command meant to be copied.

## [2.2.2] - 2026-08-19

### Fixed
- The commented `renderFile` example in the page template now passes `"md"` as
  the format argument. Without it Eleventy also ran the file through Nunjucks, so
  a `.md` containing template syntax — a code sample with `{{ }}` or `{% %}` in
  it — broke the build instead of rendering as text.

## [2.2.1] - 2026-08-18

### Fixed
- Renaming a page left the old `title` in the route's front matter. Only
  `permalink` was rewritten, so a page renamed from `about` to `company` kept
  `title: "about"` while its stylesheet, script and `pages.json` record had all
  moved to `company`. The title is what the layout uses to load a page's CSS and
  JS and to look up its SEO record, so the renamed page silently lost its styles,
  its scripts and everything set under its `pages.json` entry.

### Notes
- Pages renamed with an earlier version keep the stale title. Open the route in
  `src/frontend/routes/` and set `title` to the camelCase form of the new page
  name — `company-profile` becomes `companyProfile`.

## [2.2.0] - 2026-08-18

### Added
- **Markdown rendered with `renderFile` is styled out of the box.**
  `src/frontend/scss/modules/_markdown.scss` carries GitHub's Markdown layout —
  tables, code blocks, blockquotes, heading spacing — scoped to a
  `.markdown-body` container. Markdown produces plain HTML with no classes, so a
  rendered `.md` came out as unstyled text regardless of the CSS framework in the
  project. Colours follow `data-theme`, and the background is transparent so the
  block sits on the page instead of on a panel of its own.
- The commented `renderFile` example in the route template now shows the
  `.markdown-body` wrapper, which is what applies the styling.

### Changed
- `docs/Components.md` documents the wrapper as part of the `renderFile` line,
  and no longer says Markdown comes out unstyled: `{.class}` is now for adding
  your framework's classes to specific elements, not for making the content
  presentable in the first place.
- `docs/Styling with SCSS.md` lists `_markdown.scss` among the pre-existing
  modules, noting that it is generated rather than hand-written and that its
  import has to stay after the framework for its table and code block rules to
  win.

### Notes
- The styling lands in newly created projects only. To adopt it in an existing
  one, copy `src/frontend/scss/modules/_markdown.scss` and import it in
  `_global.scss` after the framework, then wrap your `renderFile` calls in
  `<article class="markdown-body">`.

## [2.1.0] - 2026-08-17

### Added
- **The assistant asks which layout a new page should use.** Any `.njk` file in
  `src/frontend/layouts/` is offered in an arrow-key menu, and the chosen one is
  written into the route's front matter. Before, every page was created with
  `base.njk` and the documentation had to remind you to change it by hand — the
  assistant wrote a value the reader was then expected to correct. With a single
  layout in the folder the menu is skipped, so nothing changes for a project that
  has not added one; with none, the front matter is left untouched.
- `askChoice` in `tools/cli/prompt.js`: the arrow-key menu the scaffolder already
  used, available to the assistant as well.
- **Markdown files can be rendered inside a page.** `markdown-it-anchor` and
  `markdown-it-attrs` are installed and preconfigured, and Eleventy's
  `RenderPlugin` is registered, so a `.md` file in `src/frontend/components/`
  can be pulled into a route with `renderFile`. Headings from level 2 down get
  an `id` and a `#` link, and `{.class}` applies a CSS class inline — markdown
  produces plain HTML, so without a way to set classes the output carries none of
  the project's framework styling.
- A `markdownPath` filter that prefixes the components folder, so a route writes
  `"your-file.md" | markdownPath` and not the full path from the project root.
  `renderFile` resolves paths from the working directory, unlike `include`, which
  resolves them from the components folder.
- The template new pages are created from carries a commented `renderFile`
  example next to the component one, with the data argument included:
  `renderFile` does not inherit the page context, so a `.md` that reads `site.*`
  renders those values empty unless the data is passed explicitly.

### Changed
- **`tools/cli/prompt.js` creates a readline interface per question** instead of
  holding one open for the whole session. The session-wide interface kept its own
  keypress listener on stdin, which would have fought with the raw-mode listener
  the arrow-key menu needs: both would have received every key, so arrows moved
  the readline cursor and Enter fired its `line` event.
- **`markdownTemplateEngine` and `htmlTemplateEngine` are set to Nunjucks.**
  Eleventy defaults `.md` files to Liquid, so a markdown file containing
  `{{ site.title }}` was processed by a different template engine than every
  other file in the project — working for the simple cases and silently not for
  the rest.
- `src/frontend/components` is now a watch target. Eleventy tracks `.njk`
  includes as template dependencies, but a `.md` read through `renderFile` is
  invisible to it, so editing one changed nothing until the route itself was
  saved.
- `.eleventy.js` is grouped into labelled sections, with plugins and markdown
  configuration ahead of the build event and the passthrough copies.
- **Documentation is written for readers who are new to this.** The docs assumed
  vocabulary a beginner does not have yet. `Deploy.md` opens with a question that
  routes the reader by backend, and explains what shared hosting, a VPS, systemd,
  an HTTPS certificate and `screen` actually are; the Node section now separates
  trying the backend out from setting it up to survive a reboot, which read as
  five equal steps before. `Head and SEO.md` starts from what the `<head>` is and
  why there are two data files, and drops the unexplained jargon — canonical,
  JSON-LD, noindex. `Components.md` documents markdown from what Markdown is,
  with each part of the `renderFile` line explained rather than assumed.
- `Project structure.md` lists `components/` as the home of `.md` content, and
  `Creating pages.md` describes both commented examples a new route carries.

### Fixed
- `Deploy.md` told the reader to open the Nginx site file with `nano` and how to
  save it, without ever saying what to paste into it. The step now names the
  edited `nginx.conf` as the source.

### Removed
- **The dead language switch in the scaffolder.** `bin/create.js` commented and
  uncommented a `glob.sync` line for the JavaScript and TypeScript entry points,
  but that line has not existed in `.eleventy.js` since bundling moved to
  `tools/buildJs.js`, so the two markers matched nothing and the function ran as
  a no-op. Entry points are collected from both language folders and resolved
  against the filesystem, which makes the switch unnecessary: the folder that
  does not exist contributes nothing.
- Unused `esbuild` and `glob` imports from `.eleventy.js`. Both are still real
  dependencies of `tools/buildJs.js`, which is where they are used.

### Notes
- The markdown setup lands in newly created projects only. To adopt it in an
  existing one, install `markdown-it-anchor` and `markdown-it-attrs` and copy the
  plugin block, the `markdownPath` filter and the two template engine settings
  from the current `.eleventy.js`.

## [2.0.2] - 2026-08-08

### Fixed
- `nib update` installed the new version without saying which one, and without
  asking. It now reports the installed version and the one it is about to
  install, and waits for confirmation — the update replaces the globally
  installed Nibula, so it should not happen as a side effect of typing the
  command.
- The prompt states that the update applies to newly created projects only.
  Existing ones keep running their own copy, which the delegation introduced in
  1.6.0 already guaranteed, but nothing said so at the moment it mattered.
- `nib update` no longer installs blindly when the npm registry can't be
  reached. The version lookup returns nothing in that case, and the command went
  on to install `nibula@latest` anyway; it now reports the failure and stops.
- Running `nib update` outside a terminal updated without confirmation and
  reported nothing. It now explains that a terminal is required.

### Changed
- `src/frontend/js/global.js` and `src/frontend/ts/global.ts` call the listener
  directly instead of declaring `initGlobal` and passing it to
  `DOMContentLoaded`. The named function added a level of indirection to a
  scaffolded file that starts out empty, and a beginner reading it had to follow
  two hops to find where their code goes.
- `src/frontend/components/global/header.njk` reads the logo from
  `{{ site.logo }}` instead of a hardcoded path. The value was already in
  `site.json`, documented and used by the Open Graph image and the JSON-LD
  publisher block; the header was the one place that ignored it, so changing the
  logo left it pointing at the old file.

## [2.0.1] - 2026-08-08

### Added
- `docs/Components.md` documents custom layouts. `base.njk` was presented as the
  only layout there is, so a page that doesn't fit the standard shell — a landing
  page with no header or footer, a full-screen login — had no documented way out.
  Copying `base.njk` and pointing a route at the copy was already supported;
  nothing said so.
- `docs/Head and SEO.md` shows where the tags are actually written, including the
  `pageKey` lookup that ties a route's `title` to its record in `pages.json`, and
  warns against removing the `url` filter from asset paths — it is what keeps a
  site published under a subpath from 404ing every stylesheet and script.
- `docs/Creating pages.md` covers the `layout` front matter field, which the file
  showed in every example without ever explaining.

### Fixed
- `src/frontend/ts/global.ts` imported `exampleModule` for real while leaving the
  call commented out, so a new TypeScript project started with an unused import
  and a stale path in the comment above it. It now matches `global.js`, where the
  import is commented too.
- The `site.json` snippet in `docs/Components.md` was not valid JSON: the opening
  and two closing braces were missing and three `//` comments sat inside it, so
  copying it into the file broke the build.
- `docs/Head and SEO.md` listed `favicon-48.png` among the favicon files. No tag
  in `base.njk` loads it.

### Changed
- `docs/Creating pages.md` no longer re-explains component includes and the
  `pages.json` stub, which are documented in full elsewhere and had started to
  drift.
- Nunjucks snippets in `docs/Components.md` are tagged as such instead of as
  JavaScript.
- `docs/Project structure.md` points at `layouts/` for pages that need their own
  skeleton.
  
## [2.0.0] - 2026-08-07

### Breaking

Existing projects keep running the Nibula version they were built with. These
steps apply only when you run `npm install nibula@latest` inside a project. Do
them in one pass, before the next build.

- **`page-components.njk` no longer exists.** Its `elif` chain is replaced by
  includes written directly in each route. For every page, move the includes
  from its `elif` block into the matching file in `src/frontend/routes/`, then
  delete `src/frontend/layouts/page-components.njk`.
- **Every route's layout becomes `base.njk`.** Change `layout: page-components.njk`
  to `layout: base.njk` in the front matter of each file in `routes/`.
- **`index.njk` and `404.njk` move into `routes/`.** They sat at the root of
  `src/frontend/`; every page now lives in one place.
- **`llms.njk`, `robots.njk` and `sitemap.njk` move into `src/frontend/indexing/`.**
  Their `permalink` values are unchanged, so the published URLs stay the same.
- **`.htaccess` and `web.config` move into `src/frontend/hosting/`.** The build
  still places them in the root of the output folder, so what you deploy is
  unchanged. `nginx.conf` stays at the project root: it is installed on the
  server by hand, not published with the site.

### Added

- `docs/Project structure.md` maps the whole project and lists where to go for
  each kind of change. There was no overview of the layout anywhere, so the two
  new folders — and the older ones — had to be inferred from the file tree.
- `src/frontend/components/not-found.njk` holds the 404 page markup, included by
  `routes/404.njk`.

### Changed

- **`llms.txt` is generated from page data instead of being hardcoded.** It
  listed the homepage and nothing else, so every other page was invisible to AI
  crawlers unless you edited the template by hand. It now walks the same
  collection `sitemap.njk` does, reading each page's title and description from
  `pages.json` and skipping drafts, the 404 page and anything marked `noindex`.
  Creating a page with the assistant is enough to have it listed.
- **Components are included in the route that renders them.** Composition lived
  in a single shared layout, so adding a page meant appending a branch to a file
  that grew with every page, and reading one page's structure meant scrolling
  past all the others. A route now includes what it needs, and what a page
  contains is visible in the page itself.
- **The assistant no longer edits Nunjucks templates.** Creating, renaming and
  removing a page used to rewrite `page-components.njk` with regular expressions
  against the template's syntax. That step is gone; the assistant now touches
  only files it fully controls.
- **Documentation catches up with the code.** `Head & SEO` opened by pointing at
  `pages.json` and `{{ pages.* }}` for the global settings, which have lived in
  `site.json` since 1.6.0, and still listed `legal.cookieControls`, removed in
  the same release. `JavaScript` claimed `global.js` sits in the modules folder,
  which stopped being true when it moved up a level — the surrounding example
  already contradicted it. `Styling with SCSS` referred to the Eleventy config
  as `eleventy.config.js`.
- New pages are scaffolded with a commented example include instead of a warning
  not to edit the file.

### Removed

- `src/frontend/layouts/page-components.njk`, and with it the `pageComponents`
  configuration block, its six log messages, and its entry in the project's
  required-files check.
- The include of `404/_404.njk`, a component that was never shipped. It survived
  only because of `ignore missing`, which silently swallowed it on every build.

### Notes

- `routes/` is no longer created on demand or removed when empty: with
  `index.njk` and `404.njk` inside, it always exists. The same on-demand handling
  still applies to `scss/pages/` and `js/pages/`.
- Writing markup directly in a route works and is fine for a simple page.
  Components remain the recommendation when there is something to reuse, not a
  requirement.

## [1.6.2] - 2026-08-07

### Added
- `nib --version` (also `-v`, `v`, `ver`, `version`) prints the version number on its own line. Inside a project it reports the project's own copy, which is the one actually running the command.

### Changed
- `docs/Styling with SCSS.md` now matches the template: the Nunjucks snippets include the `url` filter and the config file is named `.eleventy.js`.

## [1.6.1] - 2026-08-06

### Fixed
- `src/frontend/scss/pages/prova.scss` was left in the template and shipped with 1.6.0, so every new project started with a stylesheet for a page that doesn't exist — no route, no script, no entry in `pages.json`.
- Open Graph and Twitter Card tags read `seo.title` and `seo.description` directly, with none of the fallbacks the `<title>` and meta description already had. A page that left those fields empty in `pages.json` published an empty social preview — exactly the case the fallbacks exist for. They now follow the same chain.
- `data-theme` was missing from the `<html>` tag. It is documented as the hook to target in SCSS for theme variables, so a selector written against it never matched.

## [1.6.0] - 2026-08-06

### Breaking
- Per-page settings must move out of `site.json`. Take the block under the `pages`
  key and make it the root object of a new `src/frontend/data/pages.json`, then
  update `base.njk`, `sitemap.njk` and `llms.njk` to read `pages[title]` instead of
  `site.pages[title]`. Without `pages.json` the assistant reports the missing file
  and stops.
- SCSS and JS import paths change with the `_root`, `_global` and `global` moves.
  Update the `@use` and `@import` lines in your page entry points accordingly.
- Existing projects keep working until you run `npm install nibula@latest` inside
  them: commands now delegate to the project's own copy, so an old project keeps
  running the version it was built with.

### Changed
- **Per-page settings moved from `site.json` to a new `pages.json`.** They were nested under a `pages` key in the same file the CLI writes on every page operation; splitting them means a syntax error in one page's record no longer makes the whole site configuration unreadable. Access changes from `{{ site.pages[title] }}` to `{{ pages[title] }}`, and the CLI now reads and writes `pages.json` only.
- Commands run inside a project now execute the project's own Nibula, taken from its `node_modules`, instead of the globally installed one. `nib cli` typed in a terminal used to run the global copy against local files, so a project scaffolded with an older version could be operated on by a newer CLI expecting a different structure. When the two versions differ, the one being used is reported before the command runs, and the assistant's title shows it as well.
- `_root.scss` and `_global.scss` moved out of `scss/modules/`. They are not modules — every page imports them and nothing else does — so they now sit at the root of `scss/`.
- `global.js` and `global.ts` moved out of their `modules/` folders, for the same reason.
- Import paths updated across existing modules, pages and scaffold templates to match both moves.
- `base.njk` applies the `url` filter to per-page CSS and JS, to the favicons and to the framework scripts. Without it these paths ignore `pathPrefix`, so every asset 404s on a site published under a subpath — GitHub Pages being the common case.
- Documentation updated throughout for the new structure and the `site.json` / `pages.json` split.

### Fixed
- TypeScript page entry points imported modules with a `.js` extension.
- `logo` was nested inside `legal` in `site.json`, so `{{ site.logo }}` resolved to nothing in the header, the footer, the Open Graph image and the JSON-LD publisher block. It now sits at the root, where the templates already looked for it.

### Removed
- `legal.cookieControls` from `site.json`.
- Preconnect hint to `cdn.jsdelivr.net` in `base.njk`. The project loads its framework from `node_modules` through passthrough copy, so the hint opened a TCP and TLS connection to a host that was never used.

## [1.5.3] - 2026-08-05

### Fixed
- `web.config` no longer breaks on Windows shared hosting. `ApiToNode` was the
  first rule, so every `/api` request returned a 500: rewriting to an absolute
  URL needs the ARR module, and the `<serverVariables>` block needs an entry in
  `applicationHost.config` — neither is available on a shared plan. `ApiToPhp`
  is now the default and `ApiToNode` ships commented out, with the requirements
  spelled out above it. `<serverVariables>` is gone; on a server with ARR the
  forwarded-protocol header is set server-side.
- The PHP front controller looked for `404.html` only under
  `$_SERVER['DOCUMENT_ROOT']`, which doesn't resolve to the site root on shared
  hosting, so an unknown `/api` route returned an empty page. It now falls back
  to the path relative to `_core`, matching how `index.js` already resolved it.
- `Content-Type: text/html` was only sent when `404.html` existed; the plain
  fallback went out undeclared.
- Requesting a protected endpoint in a browser opened a credentials prompt
  instead of showing the error. IIS attaches `WWW-Authenticate: Basic` to 401
  responses, which the browser answers with a login dialog. It is now removed in
  `web.config`, so the JSON envelope reaches the client as intended.
- `httpErrors` under `backend/` is set to `PassThrough`. The site root keeps
  `Replace` so unknown pages get `404.html`, but under `backend/` every response
  is the API's own JSON envelope and IIS must not substitute its HTML for it.
- `nib rename` overwrote the page's SEO title in `site.json` with one derived
  from the new name, discarding whatever you had written. It now moves the
  record under the new key and changes nothing else. This also fixes the rename
  failing outright when the record's `seo` field was malformed, since the field
  is no longer read.
- `nib rename` rewrote `title` in the route's front matter for the same reason.
  Only `permalink` is updated now.

### Changed
- `docs/Deploy.md` documents the new IIS default, and warns that a Node project
  published to Windows shared hosting should leave the `backend` folder out —
  the requests would be rewritten onto a PHP front controller the project
  doesn't contain.

## [1.5.2] - 2026-08-05

### Fixed
- `nib new` no longer creates an empty `src/frontend/routes` folder. 1.5.1
  removed it from `CREATE_DIRS` but left it in `MANDATORY_COPY`, so it still
  arrived from the template. It is now created on demand when the first page is
  added, and removed again when the last one is deleted.

## [1.5.1] - 2026-08-05

### Fixed
- `nib new` no longer creates an empty `routes` folder. Page source folders are
  created on demand when a page is added, and removed again when the last page
  in them is deleted — `routes`, `scss/pages` and the JS/TS pages folder alike.
- Removing a page that doesn't exist reported the skip and then went on to strip
  its entry from `site.json` and `page-components.njk` anyway. It now stops.
- `example.config.php` was missing the `APP_ENV` key, so PHP projects had no way
  to discover the debug switch from the template. Behaviour was unaffected —
  the code already fell back to `production` — but the key is now visible and
  documented, and the two templates are identical again.
- The backend's `dev` script set `APP_ENV` as an environment variable, which
  neither backend reads. It ran in production mode and produced no debug output.
  The script is gone; error verbosity is set in `config.js` / `config.php`.
- `bin/create.js` repeated the `mysql2` version already declared in
  `src/backend/package.json`. It now reads that file, so the two cannot drift.
- `docs/Deploy.md` pointed at `backend/backend-node.service.example`, removed in
  1.5.0. The systemd unit is written out in full instead.
- `docs/Deploy.md` gave the backend path as `/var/www/backend/SITE_FOLDER`,
  inverted with respect to the rest of the document.

### Changed
- Nginx setup steps moved from the `nginx.conf` header into `docs/Deploy.md`,
  under "Your own server". The header keeps only the three placeholders that
  appear in the file and a pointer to the docs, so a config copied into
  `/etc/nginx/sites-available/` no longer carries 60 lines of install
  instructions that were already followed.
- `docs/Deploy.md` troubleshooting is now a table, with a row for a 502 on
  `/api` caused by the Node process not running.
- `.eleventyignore` reduced to `src/frontend/assets/**`. The `scss`, `js` and
  `src/backend` entries excluded nothing: the first two are not Eleventy
  template formats and the third is outside the input directory. The last one
  was also misleading, since `.eleventy.js` deliberately copies `src/backend`
  into the build.
- `docs/Backend.md` documents `APP_ENV` in its own section, including the
  `display_errors` behaviour specific to PHP, and states explicitly that it is
  a config key rather than an environment variable.

### Notes
- Existing projects are unaffected: the scaffolding and template changes apply
  only to newly created ones.

## [1.5.0] - 2026-08-04

### Added
- `nginx.conf` now covers **both backends** with no manual edits. `/api` is
  proxied to Node on `127.0.0.1:3000`; if Node is unreachable, the request is
  retried through the PHP front controller via the internal `@php_backend`
  location. The same file works for a Node deployment and a PHP one.
- `nginx.conf` header now documents the PHP-FPM requirement, the version-agnostic
  socket, and the errors specific to a PHP deployment.

### Changed
- PHP is invoked through `SCRIPT_FILENAME` instead of by URL, so `.php` requests
  keep returning 404 even on a PHP deployment and no source file is ever
  reachable by name.
- `fastcgi_pass` targets the version-agnostic socket `unix:/run/php/php-fpm.sock`
  instead of a versioned path, so the config survives PHP upgrades.
- `web.config` is now blocked anywhere in the tree, not only at the document root.
- `docs/Backend.md` is limited to writing endpoints: routing, `public` vs
  `protected`, the `Response` helper and configuration. Examples are Node-only,
  with a note that PHP behaves identically. Hosting and server requirements
  moved to `docs/Deploy.md`.
- `docs/Deploy.md` rewritten around where a site can be published and what each
  target requires, including why shared hosting cannot run the Node backend.

### Removed
- `docs/Nginx.md` — the setup steps live in the `nginx.conf` header, where they
  are read at the moment they are needed.
- `src/backend/backend-node.service.example` — the systemd unit is documented
  in `docs/Deploy.md` instead of shipped as a file.

## [1.4.0] - 2026-08-03

### Changed
- `nginx.conf` is now a complete, ready-to-use site file instead of a set of
  directives to paste into your own `server` block. Replace three placeholders
  (`YOUR_DOMAIN`, `SITE_FOLDER`, `YOUR_CERTIFICATE`), symlink it into
  `sites-enabled/`, reload.
- Nginx documentation moved from `docs/Deploy.md` to `docs/Nginx.md`;
  `Deploy.md` now covers only where to publish, one section per server.

### Added
- HTTP → HTTPS redirect on port 80, with an optional ACME webroot block.
- TLS setup via Let's Encrypt, with placeholders for the certificate path.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Strict-Transport-Security` (`max-age=300` by default).
- `.php` requests return 404, preventing source-code leaks when php-fpm is
  not configured.

### Removed
- **Breaking:** the automatic Node → PHP fallback on Nginx. `/api` is now
  proxied to Node only; if the process is down, Nginx returns 502. For a PHP
  deployment, edit the `.php` block and `try_files` as described in
  `docs/Nginx.md`.

### Migration
Existing Nginx deployments: replace your `server` block with the new
`nginx.conf` and fill in the three placeholders. If you relied on the PHP
fallback, follow *Using the PHP backend* in `docs/Nginx.md`.

## [1.3.0] - 2026-08-01

### Added
- A `global.js` module in `src/frontend/js/modules/`, for code that has to run
  on every page — a header menu, a theme toggle, a cookie banner. Page entry
  points import it once and it takes care of running the shared modules, so
  there's no longer a line to remember in every single page.
- `docs/Javascript.md` now covers the global module, with the header burger
  menu as a worked example and a note on when a behaviour belongs in
  `global.js` rather than in a page.

### Changed
- Page entry points, and the template new pages are created from, now start
  with `import '../modules/global.js';`.

### Notes
- Existing projects keep working as they are. To adopt the global module, add
  `src/frontend/js/modules/global.js` and the import line at the top of each
  page entry point.

## [1.2.6] - 2026-08-01

### Fixed
- The scaffolder created the routes folder as `src/frontend/_routes` instead of
  `src/frontend/routes`. The CLI writes and looks for page templates in
  `routes`, so on a freshly created project every page ended up outside the
  folder Eleventy and the assistant expect.

  ### Notes
- Projects created with 1.2.5 have an empty `src/frontend/_routes` folder that
  can be deleted. Pages created before this fix should be moved to
  `src/frontend/routes`.

## [1.2.5] - 2026-08-01

### Added
- `nib new` now refuses to run from inside an existing Nibula project. Creating
  a project inside another one produced a broken setup, since the outer build
  would pick up the inner project's files. The error message reports the path of
  the project that was detected, so it's clear which one triggered the check.
- A GitHub Actions workflow that publishes the package to npm whenever a release
  is created, using npm's trusted publishing. The workflow verifies that the git
  tag matches the version in `package.json` before publishing, and attaches a
  provenance attestation to the published package.

### Changed
- Rewrote the README: added a section on when Nibula is *not* the right tool,
  clarified that Composer is only needed with the PHP backend, and moved the
  editor extensions from the required to the recommended prerequisites.

## [1.2.4] - 2026-07-31

### Changed
- Internal refactor of `tools/`: the logic is now split across `lib/`, `cli/`
  and `config/`, with values and messages extracted into `settings.json` and
  `messages.json`. No behaviour changes — pages, `site.json` and
  `page-components.njk` are written exactly as before.
- The CLI now uses a uniform palette: colour is limited to the title box, and
  the menu numbers are dimmed instead of each carrying its own colour.

### Fixed
- The last line of the menu never closed the `dim` colour code, which stayed
  active on the following line.

## [1.2.3] - 2026-07-29

### Fixed
- `updateOutputPath` no longer strips custom flags from `build:css` and `serve:css`: the output path is now replaced in place instead of regenerating the whole script
- Missing `--load-path=node_modules` in the regenerated Sass scripts, which broke Bootstrap SCSS imports
- Malformed `outDir` in `tsconfig.json` when the output path is absolute (`./c:/...`)

## [1.2.2] - 2026-07-23

### Added
- **Full favicon set**: `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png`
  (180×180, opaque) in `assets/brand/`. iOS home-screen icons no longer fall back
  to a screenshot of the page.

### Changed
- **`data_bs_theme` renamed to `theme`** in `site.json`. It still drives
  `data-bs-theme` on the `<html>` tag; the shorter name keeps the config readable
  and independent from the framework naming.
- **`theme_color` is now a single value** instead of a `light`/`dark` pair. The
  theme is fixed per build, so two per-scheme colors could contradict the
  rendered page.
- **Favicon paths are hardcoded in `base.njk`.** The `favicon` key was removed
  from `site.json`: it only ever covered one of the three tags, which was more
  confusing than helpful. Replace the files in `assets/brand/` instead.
- `_routes/` renamed to `routes/` — it holds entry points, not internals.

### Removed
- **`mdFile` shortcode** and the `markdown-it` dependency.
- **`github-markdown-css`** and its two passthrough copies.

### Migration
- In `site.json`: rename `data_bs_theme` to `theme`, flatten `theme_color` to a
  single string, drop `favicon`.
- Place `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png` in
  `src/frontend/assets/brand/`.
- If you used `{% mdFile %}`, render the Markdown ahead of time or add
  `markdown-it` back to your own project.

## [1.1.3] - 2026-07-22

### Changed
- **The update check no longer runs on every command.** Previously every
  invocation of `nib` (and the `nbl` / `nibula` aliases) contacted the npm
  registry before doing anything, adding up to 2.5s of latency to `nib run`,
  `nib build`, `nib cli` and `nib clean`. The check now runs only for `nib new`
  and `nib update`; all other commands work entirely offline.
- **`nib new` now completes the update automatically.** When a newer version is
  available and you accept the prompt, Nibula installs it and immediately
  re-runs the scaffolding with the new version, instead of asking you to type
  `nib new <project-name>` a second time.
- **New projects are scaffolded at version `0.0.0`** instead of `1.0.0`, so a
  freshly created site no longer claims a stable public release. Bump it
  yourself as the project grows, and reach `1.0.0` when you go to production.
- **Framework SCSS imports are now short and readable.** The framework modules
  in `src/frontend/scss/modules/frameworks/` used a five-level relative path
  back to `node_modules`; they now import directly by package name, e.g.
  `@import "bootstrap/scss/card";`. This matches what the styling docs already
  showed, and makes commenting modules out far less error-prone.
- `nib help` no longer appends an "a newer version is available" line, since it
  no longer performs the check.

### Added
- Internal `--skip-update-check` flag on `nib new`, set automatically when the
  command is re-run after a self-update. It prevents a loop if the registry is
  slow to propagate the new version.
- `--load-path=node_modules` on the repository's own `build:css` and `serve:css`
  scripts, so the short framework imports resolve. Generated projects already
  carried this flag.

### Fixed
- Repaired the ASCII header boxes and the commented-out example import inside
  `_bootstrap.scss`, `_bulma.scss` and `_foundation.scss`, where an earlier
  find-and-replace had injected the `node_modules` path into comment text and
  broken the alignment.
- `src/frontend/data` is no longer copied to the output folder. It holds the
  Eleventy global data file, which is consumed at build time to render meta
  tags and page config — publishing it produced a dead file in `out/` and
  exposed the full page map, including `noindex` entries. It remains a watch
  target, so edits still trigger a rebuild.

### Notes
- If the updated installation can't be located after `npm install -g` (an
  unusual `npm root -g` setup, for example), Nibula reports the problem and
  asks you to re-run the command, rather than scaffolding silently with the
  old templates.
- Existing projects are unaffected by the version change: it applies only to
  newly created ones.
- Short SCSS imports rely on Sass's `--load-path`, which is passed by the npm
  scripts. Compiling the stylesheets with a different tool (a VS Code Sass
  extension, for instance) will need the same load path configured.

## [1.1.0] - 2026-07-21

### Added
- **Node.js backend** as an alternative to PHP, living side by side in
  `src/backend/`: `_core/index.js` front controller (which is also the HTTP
  server), `Response` and `RateLimiter` modules, a `mysql2` pool singleton
  `Database.js`, `example.config.js`, and a `package.json` for the backend's
  own dependencies. Same REST API as PHP: routing, `X-Api-Key` auth, CORS and
  file-based rate limiting are identical.
- **Backend choice at scaffold time**: `nib new` now asks whether to use Node.js
  or PHP, in addition to language and CSS framework.
- `backend/backend-node.service.example` — a ready-to-adapt **systemd** unit for
  keeping the Node backend running on a server.
- `config.js` is generated from `example.config.js` at scaffold time (mirroring
  the existing `config.php` generation).
- Deployment docs now cover running the Node backend with **`screen`** (quick /
  small setups) and **systemd** (production), plus environment variables.

### Changed
- **Composer is now required only when the PHP backend is chosen.** If you pick
  Node, `composer install` is skipped entirely and the backend's npm
  dependencies (`mysql2`) are installed instead.
- `.htaccess`, `web.config` and `nginx.conf` now cover **both** backends. On
  nginx, `/api` goes to Node and automatically falls back to the PHP front
  controller when Node is unreachable. On Apache/IIS the active backend is
  selected by configuration (documented), since per-directory configs can't
  health-check an upstream.
- `.gitignore` now also ignores `src/backend/config.js`,
  `src/backend/node_modules/` and `src/backend/cache/`.
- Documentation (`README.md`, `docs/Backend.md`, `docs/Deploy.md`) updated:
  backend examples now use JavaScript/Node as the reference, with the equivalent
  PHP shown alongside and a note that PHP behaves identically.

### Notes
- Both backends are always scaffolded, so you can switch later without
  re-creating the project. The PHP front controller only serves `.php` endpoint
  files and the Node one only `.js`, so they coexist without conflict.
