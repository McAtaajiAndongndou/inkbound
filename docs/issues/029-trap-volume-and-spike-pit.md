**Lane:** levels (Renda), with Ozuko on the player-damage call
**Priority:** MUST
**PRD:** F1
**Cost:** S
**Depends on:** nothing

### Context

There is no trap system, and `docs/DECISIONS.md` settles that there won't be one: **traps are authored meshes plus one shared damage-volume helper.** This issue builds the helper and proves it with the only trap the submission strictly needs — the spike pit in the tutorial.

A trap is a mesh the level places, plus a region that hurts whatever is inside it. That is the whole abstraction.

**Status, 24 Oct 2026:** the helper is built and tested (`src/levels/trap-volume.js`, `tests/trap-volume.test.js`), including colourless enemy damage. The spike pit itself is **not placed yet**: a pit on Outskirts' 22 m-wide entry island could always be walked around, so it taught nothing (playtest). It belongs to the Primer's corridor, where it cannot be avoided — build the pit mesh in `level-00-the-primer.js` when E1 lands. Outskirts' traps are the B blade, the C vent and the waste edge; see `docs/levels/01-outskirts.md`, "The trap language".

### Scope — files you may touch

- `src/levels/` — a small shared helper (e.g. `trap-volume.js`)
- `src/levels/level-00-the-primer.js` — the tutorial's pit
- `src/config.js` — trap damage and cooldown numbers

### Out of scope — do not touch

- `src/core/player.js` beyond the coordinate-with-Ozuko damage call
- Any other trap type
- Enemy behaviour

### Acceptance criteria

- [ ] The helper takes a region, a damage amount and a cooldown, and damages whatever stands in it
- [ ] The player takes damage at most once per `HEALTH.hurtCooldown` while inside
- [ ] Enemies knocked into the region take the same damage — red knockback into a spike pit must kill
- [ ] The pit is survivable: it damages, it never one-shots
- [ ] The hazard is visible before it can hurt anyone
- [ ] The helper is reusable by every later trap issue without modification

### Manual check

Walk into the tutorial pit on purpose. You should take a hit, be pushed out or escape, and not take a second hit immediately. Then try again and stand in it — it should keep hurting on cooldown, not instantly.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for F1 updated
- [ ] No files touched outside the lane, other than the coordinated damage call
