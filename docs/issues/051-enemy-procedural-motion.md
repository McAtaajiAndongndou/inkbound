**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** AN7, AN8, AN9
**Cost:** M
**Depends on:** nothing

### Context

Both soldier GLBs report **zero joints**. Their five rifle clips animate nothing that deforms the mesh. Enemy motion today is the existing procedural bob-and-lean in `enemy.js`, and that is the accepted answer — rigged enemy models were rejected as a re-import with unknown clip coverage.

So walk, melee and death are not "missing clips". They are **procedural work**, and this issue is that work.

### Scope — files you may touch

- `src/enemies/enemy.js` — the procedural motion
- `src/config.js` — amplitudes, periods, durations

### Out of scope — do not touch

- Enemy behaviour — this is how they look, not what they do
- The player's animation
- Physics or collision

### Acceptance criteria

- [ ] **Locomotion:** a bob and lean that scales with speed, so a charging Charger reads as committed and a patrolling Sprayer reads as stalking
- [ ] **Melee:** the Charger has a visible windup and a lunge, distinct from its idle
- [ ] **Death:** a topple, sink or dissolve — one choice, applied to every enemy, with a short duration before removal
- [ ] Hit reactions remain the emissive tint and are not lost
- [ ] Nothing in the motion is frame-rate dependent
- [ ] No per-frame allocation is introduced

### Manual check

Watch a Charger patrol, wind up, charge and die. Each of the three should be identifiable with the sound off. If you cannot tell charging from walking, the lean is too subtle.

### Design note

Rigid bodies read as intentional only if the motion is confident. Small, smooth, fast motion looks stylised; large, slow, wobbly motion looks broken. Err toward sharper and smaller.

### Definition of done

- [ ] `npm test` green — the existing no-allocation test must stay green
- [ ] PRD status for AN7, AN8 and AN9 updated
- [ ] No files touched outside the lane
