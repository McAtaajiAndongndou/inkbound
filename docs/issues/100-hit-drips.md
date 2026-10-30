**Lane:** paint (Dikeledi), `src/paint/paint-gun.js`
**Priority:** SHOULD. Renda's idea in the loop pass, 30 Oct; supports quality plan §3.1 (the tank economy)
**PRD:** rubric, Gameplay & Experience; Visual
**Cost:** S
**Depends on:** the loop pass (`docs/playtests/loop-pass.md`, step 3b). Renda plays it as one change before it's built for `main`

### Context

Renda, 30 Oct: "kills drop ink, so what about shooting dropping residual ink?"

Today, in `PaintGun._land`, a shot that hits an enemy calls `takeColourHit` and **paints nothing**. The ink disappears on the body. The hip-fire splash (`_splash`) damages nearby enemies but doesn't paint either. Only a kill leaves paint (`DEATH_SPLAT`, 1.8 m). In a long fight, every shot that connects is ink that never reaches the floor.

### The design

**Each hit drips a small splat of the shot's colour onto the floor near the enemy.**

- **Why:** fighting builds your refill, since shooting an enemy leaves pools you can dive into mid-fight (Splatoon's shoot → dive → move → shoot). Fights also leave the arena in your colours (the visual band), and a hit never costs you ground that a miss would have painted.
- **Size:** small, about 0.5–0.7 m (`PAINT_GUN.hitDrip` in config), well under the death splat, so kills stay the big refill.

**The risk:** enemies react to the floor colour under them (blue slides, red bounces, green pins; `takeColourHit` and the surface procs). A drip **under** the enemy on every hit could trigger those constantly and shift the combo balance (three green hits pinning from the floor alone).

- **A. A drip beside the enemy, not under its feet (recommended).** Place it just behind the enemy along the shot's direction, on the floor (raycast down). You still get the pool, and the floor effects only trigger if the enemy walks into it.
- **B. A drip under the enemy,** with floor procs ignoring paint younger than a short grace time. More true to "paint changes physics", but more code and a new rule.

### Scope — files you may touch

- `src/paint/paint-gun.js` (`_land`, and `_splash` only if splash hits should drip too: say which in the PR)
- `src/config.js` (`PAINT_GUN.hitDrip` and any offset)
- `tests/`

### Acceptance criteria

- [ ] A shot that hits an enemy splats the configured radius of its colour on the floor near the enemy (option A: not under its feet).
- [ ] A miss and a floor hit paint exactly as before.
- [ ] Grey shots drip nothing (grey is the Corp's).
- [ ] An enemy standing still while being hit does not get a floor proc from its own drips (option A), or not within the grace time (option B).
- [ ] `npm test` passes.

### Manual check

Outskirts island B: fight the Chargers with hip-fire and with aim-down-sights. After the fight there are pools of your colour around where they stood, and diving into one refills you.
