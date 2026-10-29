**Lane:** core (Ozuko), with Renda on `src/levels/index.js` if the registry carries the tank
**Priority:** MUST
**PRD:** A1, E3
**Cost:** S
**Depends on:** #73 (shared tank — built)

### Context

Every level is meant to have its own tank size — `AMMO` in `src/config.js` reads "Level 1 plentiful, level 2 starved, level 3 contested" (100 / 60 / 80). But `src/main.js` builds the gun as `new PaintGun(level.surfaces, 1, …)` on every load, so **every level gets Outskirts' 100**.

That quietly deletes the Ascent's identity. Its design is *rationing*: 60 ink is 15 shots, a 6 m climb costs about 3, and every room's paint budget in `docs/levels/02-the-ascent.md` is written against 15. On 100 (25 shots) none of those decisions exist. Last Colour's 80 is lost the same way.

The level ids in the registry (`src/levels/index.js`) are names — `primer`, `outskirts`, `ascent`, `last-colour` — while `AMMO` is keyed `1`, `2`, `3`, so the fix has to settle how a level finds its tank, not only pass a different number.

### Scope — files you may touch

- `src/main.js` — the one `PaintGun` construction in `loadLevel()` (**shared file** — this is the coordinated change)
- `src/config.js` — `AMMO`, if it is re-keyed
- `src/levels/index.js` — **with Renda's agreement**, if the registry entry carries the tank

### Out of scope — do not touch

- The tank numbers themselves (100 / 60 / 80) — those are design values in `docs/DECISIONS.md` and the level docs
- `src/paint/paint-gun.js` beyond what the key change strictly needs
- Refill rate, shot cost, or any other paint tuning

### Acceptance criteria

- [ ] Loading The Ascent gives a 60-ink tank; Outskirts 100; Last Colour 80
- [ ] The Primer gets a defined tank, not an accidental fallback (recommended: Outskirts' 100 — it is the tutorial)
- [ ] Restarting a level (R) and switching levels from the menu both give the new level's tank, not the previous one's
- [ ] The level → tank mapping exists in **one** place, so a fifth level cannot be added without one
- [ ] The HUD's ammo bar shows the right maximum on every level

### Manual check

Open `/?level=ascent`, fire until empty, and count: 15 shots, not 25. Restart with R and count again. Then switch to Outskirts from the level menu and confirm 25.

### Design note

Recommended shape: key `AMMO` by registry id (`AMMO.ascent = 60`) rather than by number, so the registry id is the only thing a level needs to know. A numeric key is how this bug happened — `1` looked like "the default" rather than "Outskirts".

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after — building the Ascent's gun must yield 60
- [ ] Status column in `docs/PRD.md` updated (A1)
- [ ] No files touched outside the lane, other than the coordinated `main.js` line
