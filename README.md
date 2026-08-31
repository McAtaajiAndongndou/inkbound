# Inkbound

3D browser game for COMS3006A / COMS3025A — Computer Graphics and Visualisation.

**The pitch:** The world is grey and dead. Your paint gun restores colour, and colour changes physics — blue is ice, red is bounce, green is climbable. The same gun works on floors and on enemies, so puzzling and shooting are the same action.

Design details are in `DESIGN.md`. This file is setup, structure and rules.

---

## Setup

```bash
npm install
npm run dev            # develop
npm run build          # writes dist/
npm run serve:dist     # play the BUILD locally — do this before every push
```

`npm run dev` rewrites paths on the fly. The department server does not. **Always test the built version, not the dev server.**

---

## Structure

```
inkbound/
├── index.html          # entry point, stays at root
├── vite.config.js      # base: './' — do not change
├── package.json
├── README.md           # this file
├── DESIGN.md           # game design + alpha prep
│
├── public/assets/      # models, textures, audio — all flat, all lowercase
│
└── src/
    ├── main.js         # boots the game, owns the render loop (SHARED)
    ├── config.js       # all colours and tuning numbers (SHARED)
    │
    ├── core/           #  Person 1 — renderer, player, cameras, input, game state
    ├── paint/          #  Person 2 — paint system, colour->physics, Rapier
    ├── shaders/        #  Person 3 — splat, toon/outline, armour shell, enemies
    ├── levels/         #  Person 4 — level1.js, level2.js, level3.js, geometry, lighting
    └── ui/             #  Person 5 — HUD, minimap, menus, credits, audio
```

Five folders, one per person. Keep files flat inside them — `levels/level1.js`, not `levels/level1/index.js`. If a folder needs subfolders we can add them later, but not before.

---

## Who owns what

| Person | Folder | Owns the rubric answer for |
|---|---|---|
| 1 | `core/` | Viewing, Control & Playability |
| 2 | `paint/` | The physics model and the core mechanic |
| 3 | `shaders/` | Shaders (10%), part of 3D Effects. Also enemies. |
| 4 | `levels/` | 3D Effects, level distinctness |
| 5 | `ui/` | Polish, **the trailer** (10%), sound |

**Shared files:** `main.js` and `config.js`. Announce in the group chat before editing either.

**Person 3 has to teach the shader to everyone else.** The final checklist requires every member to explain what it does. Book that session before the beta, not during it.

**Person 5 starts collecting trailer footage in week one.** It's 10% and it's the thing groups always leave too late.

---

## Rules that are not optional

**1. Relative paths, always.**
```js
loader.load('./assets/models/enemy.glb')   // correct
loader.load('/assets/models/enemy.glb')    // BREAKS ON THE SERVER
```
A leading `/` means root of the whole server. Our game lives in a subfolder — it will 404 and you get a blank screen.

**2. Lowercase hyphenated filenames.** No spaces, no capitals. The server runs Linux and is case-sensitive. `Rock_Texture.PNG` and `rock-texture.png` are different files.

Run this once on your machine, now:
```bash
git config core.ignorecase false
```

**3. Dispose on level unload.** Removing a mesh does not free GPU memory. Call `.dispose()` on geometries, materials and textures, or the tab dies during a three-level playthrough in front of a marker.

**4. Allocate nothing in the render loop.** No `new THREE.Vector3()` per frame. Create once, reuse. GC stutter reads as lag, and lag is penalised under both Gameplay and Polish.

**5. Credit everything you didn't make** in `ui/credits.js`, the moment you use it. Libraries, models, textures, sounds, tutorials.

**6. Never commit `node_modules/` or `dist/`.**

---

## Git

- One branch per person: `feature/paint`, `feature/shaders`, etc.
- Merge to `main` via pull request. Never push directly to `main`.
- Before you push: `npm run build`, then `npm run serve:dist`, then actually play it.

---

## Deployment

We ship the **contents of `dist/`**, zipped so `index.html` is at the top level of the archive. Not the source tree, not `node_modules`.

**Get a textured cube hosted in week one.** Deployment problems cost whole days and we have three weeks to the graded beta.

---

## Week one

| Who | Task |
|---|---|
| 1 | Textured cube hosted on the LAMP server |
| 2 | Paint hits a surface and changes its friction |
| 3 | One splat rendering through a custom shader |
| 4 | Level 1 blockout with grey primitives |
| 5 | Ammo counter and a working restart button |

All of it should exist by the alpha, even badly.
