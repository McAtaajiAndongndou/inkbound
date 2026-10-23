**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** D1
**Cost:** S
**Depends on:** nothing

### Context

`ENEMIES.md` requires every attack to have three beats: **tell → threat → opening**. The Charger has the first two and not the third. It winds up, charges, and is immediately back on you — so the fight is "sidestep or take 25 damage", which is a reaction test rather than a skill.

`docs/enemies/algorithms.md` specifies a **1.2 s recovery**: stationary, vulnerable, and not re-alerting. That converts the fight into *bait → dodge → punish*, which is the cheapest combat improvement available in the whole game.

### Scope — files you may touch

- `src/enemies/enemy.js` — add the `RECOVER` state
- `src/config.js` — recovery duration on the charger config

### Out of scope — do not touch

- The windup or the charge itself
- Any other enemy
- `src/core/player.js`

### Acceptance criteria

- [ ] After a charge ends — by wall impact, by travel limit, or by timer — the Charger is stationary for ~1.2 s
- [ ] During recovery it takes full damage and does not re-alert
- [ ] Contact damage does not apply during recovery beyond the existing rules
- [ ] A player can bait a charge, sidestep, and land a full combo inside the window
- [ ] `tests/enemy-opening.test.js` fails on `main` and passes here

### Manual check

Let a Charger charge past you and hit the wall. Count roughly one second where it does not move. Shoot it. It should not be able to start another charge before you finish.

### Design note

If the window feels too generous, shorten it to 1.0 s before you consider anything else. If it still feels unfair, the windup is too short — not the recovery.

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after
- [ ] Status column in `docs/PRD.md` updated (D1)
- [ ] No files touched outside the lane
