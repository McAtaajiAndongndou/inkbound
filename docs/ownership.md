# Ownership

Five lanes. Each person owns their folders outright. The point is that we can
all work on the same day without touching the same files.

Shared files (`src/config/tuning.js`, `README.md`, `index.html`) are the
exception — announce in the chat before you edit one.

---

## A — Core & Player
**Owns:** `src/core/`, `src/main.js`

Renderer, the fixed-step loop, input, the camera rig, player movement, the
Rapier wrapper, and the game state machine.

**Ships:**
- Player capsule that moves and jumps in all three dimensions
- **Three camera modes** — third-person, first-person (ADS), orthographic top-down
- Restart without a page refresh
- Keyboard *and* mouse both functional

**Interface others depend on:** `game.loadLevel(LevelClass)`, `input.isDown(action)`,
`player.groundColourId`.

**First task:** get the smoke-test cube deployed to the server. Before anything else.

---

## B — Paint System
**Owns:** `src/paint/`, `src/config/colours.js`

The heart of the game. Splat rendering into a texture target, sampling what
colour a world point is, and turning that into physics values.

**Ships:**
- `splat(worldPos, normal, colourId, radius)`
- `sampleAt(worldPos) -> colourId` (cheap enough to call every frame)
- `coverage() -> 0..1` — drives killstreaks and the level 3 drain
- Paint gun: ammo, reload, fire rate, 2-of-3 loadout

**Watch out:** never `readPixels` per frame. Keep a low-res CPU mirror of the
paint buffer for sampling and update it on a timer.

**Talk to:** A (player needs friction/bounce), D (enemies need to be paintable),
C (shader reads your render target).

---

## C — Shaders & 3D Effects
**Owns:** `src/shaders/`

Worth 10% on its own, plus most of the 15% for 3D Effects.

**Ships:**
- **Splat shader** — blends painted colour over the desaturated grey base, with
  a wet-edge effect driven by `uTime`
- **Toon + outline** — the visual identity, and what makes the trailer pop
- **Shell shader** — armoured enemies, with an emissive rim in the colour that
  breaks them (invisible resistances feel broken; make it obvious)
- Skybox, lighting setup, shadow map budget, one post-process pass

**Non-negotiable:** the rubric requires that **every team member can explain the
shader code**. C runs a 20-minute session for the group before the beta. Put it
in the calendar now.

---

## D — Enemies & Combat
**Owns:** `src/enemies/`

**Ships one `Enemy` class with flags.** Not five classes.

| Type | Level | Flags |
|---|---|---|
| Sprayer | 1 | base — shoots grey, undoes our paint |
| Charger | 1 | `canShoot:false`, speed ×1.6 |
| Wall-crawler | 2 | `canClimb:true` — uses our green against us |
| Turret | 2 | `canMove:false`, range ×2 |
| Drainer | 3 | `drainsPaint:true`, health ×0.4 |
| Boss | 3 | repaints arena, spawns waves, combo-locked |

**Difficulty by rule, not by HP.** L1 no armour → L2 `requiredColour` → L3
`comboSequence`. The brief explicitly penalises "the same thing with the numbers
turned up", so the health multipliers in `tuning.js` stay small.

**Do not build pathfinding.** Chase, strafe, shoot on line of sight. Nobody is
marking our AI and a navmesh will eat a week.

---

## E — Levels, UI & Audio
**Owns:** `src/levels/`, `src/ui/`, `src/audio/`, `public/assets/`

Biggest lane by surface area, lightest by difficulty. Pull someone in if it gets heavy.

**Ships:**
- Three level layouts, each with its stated identity
- HUD: ammo, health, colour slots, streak meter, hitmarkers, killfeed
- Minimap (orthographic) — cheap rubric marks, do it early
- Menu, pause, options, loadout select, **restart without refresh**
- **Credits screen** — every library, model, texture, sound, font, tutorial.
  Add entries *as you use them*, never reconstruct at the end.
- Loading screen with real progress
- Music and SFX

---

## Nobody's lane — assign a name to each of these now

- **Trailer** (10%). Max 2 min, YouTube. Start capturing footage from week one;
  you cannot fake a trailer in one night.
- **Devlog** (final only). Lighting, effects, mechanics, our innovations.
- **Moodle dates** — confirm alpha/beta/final and post them.
- **Contribution report** — individual, everyone does their own.
