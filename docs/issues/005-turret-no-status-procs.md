**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** C5
**Cost:** S
**Depends on:** nothing

### Context

The turret is the game's designated **matrix gap** (`ENEMIES.md`): the one enemy that paint does not solve. `docs/DECISIONS.md` settles it as *no status procs at all* — freeze, pin and knockback do nothing, and all three colours simply do damage. The answer is positioning: break line of sight and flank.

This only works if the procs genuinely do nothing. If a turret can be frozen, the gap is gone and the turret is just another enemy.

### Scope — files you may touch

- `src/enemies/enemy.js` — skip proc application for static or flagged enemies
- `src/config.js` — put the flag on the turret config

### Out of scope — do not touch

- Turret damage numbers, track rate or burst size
- Any other enemy's procs

### Acceptance criteria

- [ ] Blue hits on a turret build no freeze and produce no crit window
- [ ] Green hits do not pin it
- [ ] Red hits do not move it
- [ ] All three colours deal the same damage per hit
- [ ] The turret is still killable
- [ ] `tests/turret-no-procs.test.js` fails on `main` and passes here

### Manual check

Empty a full tank of blue into a turret. Nothing should frost over and it should not slow down. Then kill it with red — the only difference should be how long it takes.

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after
- [ ] Status column in `docs/PRD.md` updated (C5)
- [ ] No files touched outside the lane
