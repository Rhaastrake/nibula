# AGENTS.md

Nibula project (Eleventy). Read the docs before changing anything, for the installed major version:
take it from `nibula` in `devDependencies` of `package.json` and open https://nibula.dev/docs/v<major>/ (e.g. `^3.2.0` → `/docs/v3/`).
If you cannot read the docs, tell the user, and give them the same link to read them.

- Add, rename and remove pages only with `nib create`, `nib rename`, `nib remove`.
- A page's `title` is its key in `pages.json` and the name of its CSS/JS files: don't change it by hand.
- Never edit the output folder (`out/`): it is rebuilt every time.
- Stay close to plain HTML, CSS and JS: don't add frameworks or dependencies unless asked.
