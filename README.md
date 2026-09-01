# Inkbound

3D browser game for COMS3006A / COMS3025A — Computer Graphics and Visualisation.

**The pitch:** The world is grey and dead. Your paint gun restores colour, and colour changes physics — blue is ice, red is bounce, green is climbable. The same gun works on floors and on enemies, so puzzling and shooting are the same action.

Design details are in `DESIGN.md`. This file is setup, structure and rules.

---

## Run it

```bash
npm install
npm run dev            # develop
npm run build          # writes dist/
npm run serve:dist     # play the BUILD locally — do this before every push
```

`npm run dev` rewrites paths on the fly. The department server does not. **Always test the built version too.**

---

## What already works

Click the canvas to lock the mouse, then:

| Input | Action |
|---|---|
| **WASD** | Move |
| **Mouse** | Look |
| **Space** | Jump |
| **Left click** | Fire paint |
| **1 / 2 / 3** | Ice / Bounce / Grip |
| **V** | Toggle third-person ↔ first-person |
| **R** | Restart the level without refreshing the page |

**Try this in order — it is the demo script for the alpha:**

1. Paint the floor **blue** and run across it. You slide, because `SURFACE.blue.friction` is 0.4 against grey's 10.0. Same code path, different number, read live from the paint grid.
2. Paint a patch **red**, jump onto it from height. You bounce, because `restitution` is 0.85 there and 0 everywhere else.
3. Paint the big wall at the back **green**, walk into it and hold **W**. You climb it, because that cell's `climbable` flag is now true. There is a ledge at the top.
4. Watch the **Standing on** readout top-left change as you cross painted ground.
5. Press **V** and **R** to show off camera modes and restart-without-refresh.

That covers the core mechanic, custom shaders, multiple camera views, a physics response, restart, and a HUD.

---

## Structure

```
inkbound/
├── index.html              # entry point, stays at root
├── vite.config.js          # base: './' — do not change
├── README.md · DESIGN.md
├── public/assets/          # models, textures, audio — flat, lowercase
│
└── src/
    ├── main.js             # scene, lights, render loop (SHARED)
    ├── config.js           # all colours + tuning numbers (SHARED)
    │
    ├── core/               #  P1 — input.js, player.js, camera-rig.js
    ├── paint/              #  P2 — paint-surface.js, paint-gun.js
    ├── shaders/            #  P3 — paint-material.js (+ enemies later)
    ├── levels/             #  P4 — level-01.js …
    └── ui/                 #  P5 — hud.js, style.css (+ audio later)
```

Five folders, one per person. Keep files flat inside them.

---

## How the paint system actually works

Worth understanding before you touch anything, because it is the whole game.

Paint state lives in a **DataTexture** — one texel per grid cell, with the paint id (0 grey, 1 blue, 2 red, 3 green) in the red channel.

That one texture is read by **two** things:

- The **fragment shader**, to decide what colour to draw
- The **player controller**, to decide friction, restitution and climbability

So paint is not decoration sitting on top of the physics. Paint *is* the physics. Both sides read the same array.

Because paint lives in a texture rather than in geometry, the entire floor is **one mesh, one material, one draw call** no matter how much you paint. That matters — we are marked on lab hardware, and lag is penalised under both Gameplay and Polish.

`src/shaders/paint-material.js` has the full explanation in a comment block. **Read it before the beta — every team member has to be able to explain the shader.**

---

## Who owns what

| Person | Folder | Owns the rubric answer for |
|---|---|---|
| 1 | `core/` | Viewing, Control & Playability |
| 2 | `paint/` | The physics model and the core mechanic |
| 3 | `shaders/` | Shaders (10%), part of 3D Effects. Also enemies. |
| 4 | `levels/` | 3D Effects, level distinctness |
| 5 | `ui/` | Polish, **the trailer** (10%), sound |

**Shared files:** `main.js` and `config.js`. Say something in the group chat before editing either.

**Person 5 starts collecting trailer footage in week one.** It is 10% and it is the thing groups always leave too late.

---

## Rules that are not optional

**1. Relative paths, always.**
```js
loader.load('./assets/models/enemy.glb')   // correct
loader.load('/assets/models/enemy.glb')    // BREAKS ON THE SERVER
```
A leading `/` means root of the whole server. Our game lives in a subfolder — it will 404 and you get a blank screen.

**2. Lowercase hyphenated filenames.** The server runs Linux and is case-sensitive. `Rock_Texture.PNG` and `rock-texture.png` are different files. Run once, on every machine:
```bash
git config core.ignorecase false
```

**3. Dispose on level unload.** Removing a mesh does not free GPU memory. `level-01.js` and `paint-surface.js` both implement `dispose()` — copy that pattern. Without it the tab dies during a three-level playthrough in front of a marker.

**4. Allocate nothing in the render loop.** No `new THREE.Vector3()` per frame. Look at how `player.js` keeps `_wish`, `_fwd`, `_right` as reused fields. GC stutter reads as lag.

**5. Credit everything you did not make** in the credits screen, the moment you use it.

**6. Never commit `node_modules/` or `dist/`.**

---

## Known gaps (deliberate)

- **Physics is hand-rolled**, not Rapier. Small, no async WASM init, works today. Rapier goes in during week 2 for proper collision against arbitrary geometry.
- **Collision is floor-raycast only** — you can walk through pillars. Fine for the alpha.
- **No enemies yet.** `config.js` already holds the five enemy configs; `src/shaders/` gets `enemy.js` next.
- **Levels 2 and 3 not built.** Level 1 proves the mechanic; the other two are the same code with different ammo and enemy configs.

---

## Git

- One branch per person: `feature/core`, `feature/paint`, `feature/shaders`, `feature/levels`, `feature/ui`
- Merge to `main` via pull request, never push directly
- Before you push: `npm run build`, then `npm run serve:dist`, then actually play it

---

## Deployment

Ship the **contents of `dist/`**, zipped so `index.html` is at the top level of the archive.

```bash
npm run build
cd dist
# PowerShell:
Compress-Archive -Path * -DestinationPath ..\inkbound.zip
```

**Do this in week one.** Deployment problems cost whole days and we have three weeks to the graded beta.
