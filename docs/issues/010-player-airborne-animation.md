**Lane:** shaders (Lethabo), with Ozuko on the state read
**Priority:** MUST
**PRD:** AN4
**Cost:** S
**Depends on:** nothing

### Context

The player has five animation clips and the code wires **two states**. `main.js` calls `setMoving(speed > 0.5)` and nothing else, so the player plays their run animation while falling through the air. Standing still mid-jump looks the same as sprinting mid-jump.

`Avatar` already owns a mixer and a `play(name, fade)` method. The physics already knows whether the player is grounded. This issue connects the two — it is the highest polish-per-hour change in the project.

### Scope — files you may touch

- `src/shaders/avatar.js` — add airborne states and clip names
- `src/main.js` — **shared.** Coordinate with Ozuko for the one call that reports grounded state; do not edit alone
- `src/config.js` — animation blend durations if they need tuning

### Out of scope — do not touch

- `src/core/player.js` — the physics already tracks grounding; read it, don't change it
- Climb animation — that is AN5
- The gun viewmodel

### Acceptance criteria

- [ ] Three new states exist: `jump`, `fall`, `land`
- [ ] The avatar leaves `run`/`idle` when the player is airborne and returns on landing
- [ ] Rising and falling use different clips if the source model has them; if not, one airborne clip covers both
- [ ] Landing plays once and does not loop
- [ ] Blends are short — 0.1 s or less — so the transition does not lag behind the physics
- [ ] No clip is missing at runtime; a missing clip falls back to idle rather than freezing the mixer

### Manual check

Jump off a ledge and hold forward. You should see an airborne pose, not a running one. Land and see a land beat. Then climb a green wall — that should still be wrong, because AN5 is a separate issue.

### Design note

Do not add a fall-duration arc or a landing crouch timer. Read the state, play the clip, blend fast. Anything cleverer belongs after the loop exists.

### Definition of done

- [ ] `npm test` green
- [ ] Status column in `docs/PRD.md` updated (AN4)
- [ ] No files touched outside the lane, other than the coordinated `main.js` call
