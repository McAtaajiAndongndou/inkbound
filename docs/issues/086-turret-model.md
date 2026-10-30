**Lane:** shaders, Lethabo
**Priority:** P1. Quality plan §11 B8, §4.2, §6.3 A9; PRD M5
**PRD:** rubric, Visual; PRD M5
**Cost:** S–M
**Depends on:** nothing

### Context

QA, 30 Oct: "doesn't have a model?". The turret draws as the code-built fallback box. Two Quaternius turrets are listed in `docs/ASSETS.md` (CC0, not shipped). This blocks Phase 2's Levels item "turrets placed with models".

### Change

Any rigid turret model, with a barrel that turns to track the player (the turn is its tell) and a recoil per shot (§6.3 A9). Add it to `MODEL_URLS` and `docs/ASSETS.md` with attribution.

### Scope — files you may touch

- `src/enemies/enemy.js` (`MODEL_URLS`, the turret's procedural track and recoil)
- `public/assets/`, `docs/ASSETS.md`, `src/ui/credits.js` (if CC-BY)
- `tests/`

### Acceptance criteria

- [ ] Turrets render with a model, not the fallback box, and their feet sit on the floor.
- [ ] The barrel turns toward the player while tracking, and recoils on each shot.
- [ ] `npm test` passes, including `tests/enemy-models.test.js`.

### Manual check

The Ascent R4: the three turrets are recognisable as turrets, and you can read where each is aiming.
