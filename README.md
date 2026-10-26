# ✏️ Nibula

[![Version](https://img.shields.io/npm/v/nibula?label=version&color=blue)](https://www.npmjs.com/package/nibula)
[![License](https://img.shields.io/npm/l/nibula?color=blue)](LICENSE)
![Eleventy](https://img.shields.io/badge/built%20on-11ty-black?logo=eleventy)

**Nibula** is an open source static site generator built on top of
[Eleventy (11ty)](https://www.11ty.dev/), with one clear mission: make the jump
from small hand-written practice sites to a real project setup as gentle as
possible.

📖 **[Read the documentation](https://nibula.dev/docs/)**

## 🎯 Why choose Nibula

### Beginner friendly

If you've only ever written HTML, CSS and a bit of JavaScript, moving to a
framework usually feels like starting over. A new syntax, new rules, new folder
structures, and a pile of documentation to get through before you can even see a
page on screen.

Nibula is designed to avoid exactly that. You stay close to the three languages
you already know, and the folder structure stays small enough to hold in your
head — a handful of folders whose names say what's inside, instead of a
convention you have to study before it makes sense.

Everything else is optional. Nunjucks adds loops and includes to your HTML,
Markdown files can carry the same logic, data files can feed a whole page — but
none of it is needed on day one.

### Ready to publish

The hard part of a first site usually isn't building it — it's everything that
comes after. Meta tags, a sitemap, a `robots.txt`, the server config your host
expects: four things nobody taught you, all at once, right when you thought you
were done.

Nibula writes them while you work. Fill in two data files and the SEO tags, the
sitemap and `llms.txt` build themselves from your pages. `.htaccess` and
`web.config` are already in the output folder, ready to upload, and an
`nginx.conf` is waiting if you have your own server.

### Nothing is hidden

Every one of those files lives in the project, in the folder you'd expect, in the
form you'd have written by hand. When you need to change something, you open it
and change it — there's no configuration layer to learn first, and no generated
code you're not supposed to touch.

### Backend included

At project creation you choose your backend: **Node.js or PHP**. Both expose the
same REST API — same routing, `X-Api-Key` auth, CORS and rate limiting — so a
contact form or a small API works on whatever hosting you end up with.

## 🤔 When not to use it

**Nibula builds static pages.** If your site needs users to log in, save
something, or see different content depending on who they are, you want a
framework with a server behind it — Next.js, Nuxt, Laravel.

**It doesn't scale to hundreds of pages** coming from a database or a CMS. The
assistant creates pages one at a time, which is right for a site with ten or
twenty of them and wrong for a catalogue.

**If you already work with React, Vue or Angular, stay there.** Nibula's whole
point is being a first step for people who don't.

## 📋 Prerequisites

- **Node.js** — v18.0.0 or higher
- **Composer** — latest version, only if you pick the PHP backend

## 🚀 Getting started

Install Nibula once, globally:

```
npm install -g nibula
```

This gives you the `nib` command, with `nbl` and `nibula` as aliases.

From the folder where you keep your websites:

```
nib new your-project
```

The scaffolder asks you three things — the language, the CSS framework and the
backend — then installs everything for you. Move into the project and start the
dev server:

```
cd your-project
nib run
```

Your site is now at `localhost:8080`, and it rebuilds every time you save.

## 💻 Commands

Run these from anywhere inside a project — except `nib new`, which must be run
**outside** a project, in the folder where you want the new one created.

| Command | Description |
|---|---|
| `nib new <name>` | Create a new project |
| `nib run` | Start the dev server and rebuild as you save |
| `nib cli` | Open the page-management assistant |
| `nib build` | Build the output folder |
| `nib clean` | Remove the output directory |
| `nib update` | Update Nibula (applies from your next project on) |

Creating a page by hand means writing three files and a data record that all have
to agree on the name. `nib cli` does it for you, and handles renaming and
removing too.

## 📖 Documentation

Everything else — the page structure, components, styling, the backend, SEO and
deployment — is at
**[nibula.dev](https://nibula.dev/docs/)**.

## ⭐ Support Nibula

Thanks for giving **Nibula** a try.

It's a one-person project, so every bit of feedback counts more than you'd think:
if something breaks, if the documentation isn't clear, or if a feature is
missing, open an [issue](https://github.com/Rhaastrake/nibula/issues).

If **Nibula** was useful to you, leaving a ⭐ on the
[repository](https://github.com/Rhaastrake/nibula) is the easiest way to help
other people find it.

You can also support the project by buying me a coffee on
[PayPal](https://paypal.me/rhaastrake) ☕🫡