# Deployment

**Do this in week one, with the smoke-test cube, before we have a game.**
Deployment problems are the ones that cost whole days, and we do not have whole
days spare. A group that first uploads the night before the deadline discovers
every problem below at the worst possible moment.

## What the server is

- Serves **static files only** — HTML, JS, CSS, models, textures, audio
- Will **not** run our build tools. Node, npm and Vite exist only on our machines
- Will **not** install dependencies. Everything must be inside the archive or on
  a public HTTPS CDN
- Runs **Linux** — filenames are case-sensitive
- **No SSH or SCP.** Deployment is by file upload through Moodle

## Our game lives in a subfolder

The published URL looks like `https://<server>/<our-group-folder>/`, **not** the
domain root. Every path starting with `/` therefore points somewhere that does
not exist. This is by far the most common reason a game that worked perfectly in
development shows a blank screen once hosted.

`vite.config.js` already has `base: './'` set. **Do not change it.**

## The steps

```bash
npm run build        # writes a self-contained site into dist/
npx serve dist       # serve the BUILD locally and play it right through
```

That second command is the important one. **Test the build, not the dev server.**
The dev server rewrites paths on the fly; the LAMP server does not. Playing
`npm run dev` tells you nothing about whether hosting will work.

Never open `index.html` as a `file://` URL. Module scripts and texture loads are
blocked under `file://`, so it also tells you nothing.

Then:

1. Zip **the contents of `dist/`** so `index.html` is at the top level of the
   archive, not inside a nested folder
2. Upload to the Moodle submission, following their naming convention
3. **Open the published URL and play the whole game in Chrome**

## Do not upload the source tree

`node_modules/`, `src/` and `package.json` do not produce a working game. They
produce a directory listing and a lot of wasted upload. If `index.html` contains
`import * as THREE from 'three'` with no build step, the browser cannot resolve
`'three'` and nothing runs.

## Pre-upload checklist

- [ ] `npm run build` completes with no errors
- [ ] `npx serve dist` — played start to finish, all three levels
- [ ] Console is clean. No 404s, no mixed-content warnings
- [ ] No path in the codebase starts with `/`
- [ ] Every asset filename is lowercase-hyphen and matches the code exactly
- [ ] All external resources over HTTPS
- [ ] Total download size is sane
- [ ] Zipped the *contents* of `dist/`, `index.html` at top level
- [ ] Opened the published URL and played it through in Chrome

## If it is blank once hosted

Open DevTools. It is almost always one of three things:

1. A leading `/` in a path → 404s in the Network tab
2. A case mismatch in a filename → 404 on one specific asset
3. Source tree uploaded instead of the build → bare module specifier error
