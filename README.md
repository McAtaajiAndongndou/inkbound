# Inkbound

3D browser game for COMS3006A / COMS3025A — Computer Graphics and Visualisation.

**The pitch:** the world is grey and dead. Your paint gun restores colour, and colour changes physics — blue is ice, red is bounce, green is climbable. The same gun works on floors and on enemies, so puzzling and shooting are the same action.

---

## The product

### Goal

Reclaim a drained world by painting colour back into it, one level at a time, until you reach the machine that drained it.

### Pillars

1. **Colour is the mechanic.** One verb, applied to floors and enemies alike. There is no separate puzzle mode and combat mode.
2. **Paint is everything.** Your ammunition, your territory and your speed are the same resource. One shared tank, refilled by standing in your own paint.
3. **The world comes back to colour.** Drained grey against restored colour tells the story without a word of exposition.
4. **Enemies are questions, not health bars.** Each one attacks a different part of your loop. The answer is a colour, a position, or a route.
5. **One loop, four pressures.** The same loop under no pressure, with space, with no space, and under attack.

### The loop

```
dry  →  paint  →  wet  →  fight  →  claim ground
```

- **Dry** (on grey) — slow, refilling nothing.
- **Wet** (on your paint) — refilling, faster.
- **Submerged** — fast refill, hidden, but you cannot fire.
- **Dry out** — no tank and no territory. That is a loss, and the game says so.

### The four levels

| Level | Pressure | What it teaches |
|---|---|---|
| **The Primer** | None | That colour changes physics |
| **Outskirts** | Space | That colour changes the world |
| **The Ascent** | No space | That vertical routes are paint routes |
| **Last Colour** | Under attack | That territory can be taken from you |

### Non-goals

Deliberately **not** building these. If someone proposes one, point them at the authoritative list in `docs/PRD.md`.

- No new enemy types — add enemy *questions* instead
- No jetpack, no vehicles, no hub level
- No two-of-three loadout in normal play (it is the hard mode)
- No health bars on enemies
- No cutscenes or exposition walls. The one exception is a ≤6 s, skippable mission intro with no characters (`docs/mission-intro.md`)

---

## Where to start

| If you want… | Read |
|---|---|
| **What must ship by submission** | **`docs/PRD.md`** — requirements, owners, status |
| Rules, lanes, definition of done | `AGENTS.md` |
| Vocabulary — the tie-breaker on naming | `GLOSSARY.md` |
| The design, story and rubric coverage | `DESIGN.md` |
| Mechanics reference | `MECHANICS.md` |
| Enemy roster and counters | `ENEMIES.md` |
| Enemy behaviour specs and tuning | `docs/enemies/algorithms.md` |
| One level, room by room | `docs/levels/` |
| Why a decision was made | `docs/DECISIONS.md`, `docs/adr/` |
| What to build next | `BACKLOG.md` |
| Assets and attribution | `docs/ASSETS.md` |

---

## Run it

```bash
npm install
npm run dev            # develop
npm test               # 144 tests — must stay green
npm run build          # writes dist/
npm run serve:dist     # play the BUILD locally — do this before every push
```

`npm run dev` rewrites paths on the fly. The department server does not. **Always test the built version too.**

### Controls

Click the canvas to lock the mouse.

| Input | Action |
|---|---|
| **WASD** | Move |
| **Mouse** | Look |
| **Space** | Jump |
| **Left click** | Fire paint |
| **Right click** | ADS — zooms toward first-person |
| **1 / 2 / 3** | Ice / Bounce / Grip |
| **V** | Toggle third-person ↔ first-person |
| **F** | Refill (transitional — being replaced by standing in your own paint) |
| **R** | Restart the level without refreshing the page |
| **Esc** | Pause / options |

### Demo script

The order that shows the mechanic best, and the order to use in front of a marker:

1. Paint the floor **blue** and run across it. You slide — `SURFACE.blue.friction` is 0.4 against grey's 10.0.
2. Paint a patch **red**, drop onto it. You bounce — `restitution` is 0.85 there and zero everywhere else.
3. Paint a wall **green**, walk into it and hold **W**. You climb — that cell's `climbable` flag is now true.
4. Watch **Standing on** change as you cross painted ground.
5. Press **V** and **R** to show camera modes and restart-without-refresh.

That covers the core mechanic, custom shaders, multiple camera views, a physics response, restart and a HUD.

---

## Structure

```
inkbound/
├── index.html              # entry point, stays at root
├── vite.config.js          # base: './' — do not change
├── public/assets/          # models, textures, audio — flat, lowercase
│
└── src/
    ├── main.js             # scene, lights, render loop (SHARED)
    ├── config.js           # every colour and tuning number (SHARED)
    │
    ├── core/               # input, player, camera rig
    ├── paint/              # paint surface, paint gun, gun model
    ├── shaders/            # paint material, avatar
    ├── enemies/            # enemy class and model loading
    ├── levels/             # level base, the three levels, decor
    ├── audio/              # audio manager
    └── ui/                 # hud, menu, credits, minimap, style
```

Files stay flat inside each folder. `main.js` and `config.js` are shared — say something in the group chat before editing either.

---

## How the paint system actually works

Worth understanding before you touch anything, because it is the whole game.

Paint state lives in a **DataTexture** — one texel per grid cell, with the paint id (0 grey, 1 blue, 2 red, 3 green) in the red channel.

That one texture is read by **two** things:

- the **fragment shader**, to decide what colour to draw
- the **player controller**, to decide friction, restitution and climbability

So paint is not decoration sitting on top of the physics. Paint *is* the physics. Both sides read the same array.

Because paint lives in a texture rather than in geometry, an entire floor is **one mesh, one material, one draw call** no matter how much you paint. That matters — we are marked on lab hardware and lag is penalised under both Gameplay and Polish.

`src/shaders/paint-material.js` has the full explanation. **Every team member has to be able to explain that shader.**

---

## Rubric ownership

| Band | % | Lane | Where the answer lives |
|---|---|---|---|
| Viewing | 10 | core | Third-person default, ADS to first-person, orthographic minimap, animated avatar |
| Control & Playability | 10 | core | Keyboard + mouse, clear win/lose, climbing, physics that is central not decorative |
| 3D Effects | 15 | levels | Grey-to-colour transitions, skybox, lights, shadows, paint shader |
| Shaders | 10 | shaders | Splat shader into a render target, toon + outline pass, status effects |
| Gameplay & Experience | 25 | levels | Dead world restored by colour, three distinct pressures, sound tied to painting, replay |
| Polish | 10 | ui | Restart without refresh, pause/options, loading screen, hitmarkers |
| Innovation | 10 | paint | Colour changes *physics*, not appearance. Enemies eat terrain. No health bars |
| Game Trailer | 10 | ui | Splatter on grey films extremely well |

`DESIGN.md` has the detailed mapping. **The trailer is 10% and is the thing groups always leave too late.**

---

## Rules that are not optional

**1. Relative paths, always.**

```js
loader.load("./assets/models/enemy.glb"); // correct
loader.load("/assets/models/enemy.glb"); // BREAKS ON THE SERVER
```

A leading `/` means root of the whole server. Our game lives in a subfolder, so it 404s and you get a blank screen.

**2. Lowercase hyphenated filenames.** The server runs Linux and is case-sensitive. Run once, on every machine:

```bash
git config core.ignorecase false
```

**3. Dispose on level unload.** Removing a mesh does not free GPU memory. `level-base.js` and `paint-surface.js` both implement `dispose()` — copy that pattern. Without it the tab dies during a three-level playthrough in front of a marker.

**4. Allocate nothing in the render loop.** No `new THREE.Vector3()` per frame. See how `player.js` reuses `_wish`, `_fwd`, `_right`.

**5. Credit everything you did not make** in the credits screen, the moment you use it.

**6. Never commit `node_modules/` or `dist/`.**

---

## Current state

- **The Primer, Outskirts, The Ascent, Last Colour** are designed in `docs/levels/`; only level 1 exists as geometry.
- `level-02-ascent.js` and `level-03-horde.js` are stubs — empty classes waiting on their docs.
- Enemies exist as one class with five configs. Several behaviours in `docs/enemies/algorithms.md` are not implemented yet, including the Charger's recovery window.
- Physics is hand-rolled, not Rapier. Collision is a ground probe rather than full mesh collision, so you can walk through vertical geometry.
- Paint refills on the **F** key today. Positional refill is the target and is not built.

---

## Git

- One branch per person: `feature/core`, `feature/paint`, `feature/shaders`, `feature/levels`, `feature/ui`
- Merge to `main` via pull request — never push directly
- Before you push: `npm run build`, then `npm run serve:dist`, then actually play it

---

## Deployment

The game is hosted on the department **LAMP server**. There is no SSH: you upload a zip through Moodle and it gets published to `https://<server>/<group-folder>/` (CGV brief, section 5).

```bash
npm run deploy:zip     # build, check, and write inkbound.zip
npm run serve:dist     # play the build locally, all the way through
```

`deploy:zip` zips the **contents of `dist/`** so `index.html` is at the top level. It refuses to zip if the build has absolute `/` paths, or an asset reference whose case does not match the file on disk, because both work on Windows and break on Linux.

Then upload `inkbound.zip` to the Moodle submission, open the published URL in Chrome, play it through, and check the console for 404s.
