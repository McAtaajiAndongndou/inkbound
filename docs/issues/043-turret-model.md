**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** M5
**Cost:** S
**Depends on:** 042 (the pipeline must be proven first)

### Context

Turrets are the one enemy that survives without an animation rig: they are static, they track, and they fire. Two Quaternius models are already chosen in `docs/ASSETS.md`.

Because there is no rig, this should be the cheapest model in the project — which makes it a good second validation after the zombie spike.

### Scope — files you may touch

- `public/assets/` — the turret GLB
- `src/enemies/enemy.js` — model attachment and the tracking rotation
- `docs/ASSETS.md`, `src/ui/credits.js`

### Out of scope — do not touch

- The turret's no-status-procs rule
- Its damage, track rate or burst
- Any behaviour change

### Acceptance criteria

- [ ] The turret model loads and sits at the right height on its perch
- [ ] Its facing follows the existing tracking logic
- [ ] A fire reaction exists — recoil, muzzle flash, or both
- [ ] Knockback still moves it, so it can be flung off a perch
- [ ] The box fallback still works when the model is missing
- [ ] CC0 attribution recorded

### Manual check

Place one on a ledge and let it track you. It should rotate smoothly and read as a machine rather than as a statue. Then knock it off the ledge and confirm it falls.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for M5 updated
- [ ] `docs/ASSETS.md` and `credits.js` updated
- [ ] No files touched outside the lane
