**Lane:** shaders (enemies), Lethabo
**Priority:** **P0**. Quality plan §11 B1, Phase 0: unfair damage
**PRD:** rubric, Gameplay & Experience
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: "one shot me through the floor". A Wall-crawler under or behind a floor can hit the player through it. Either its pellets or its line-of-sight check pass through horizontal surfaces from below.

A likely cause to check first: `sightBlockers` in `src/enemies/enemy.js` tests **upright surfaces only**, on purpose ("a floor … can never come between two pairs of eyes"). That's true for two walkers on one floor, but not for a crawler on the underside or side of a platform.

### Change

A crawler cannot see or hit the player through a floor or slab. Include floors as blockers for the crawler's sight line, or test the pellet path against them, whichever is the real cause.

### Scope — files you may touch

- `src/enemies/enemy.js`, `src/enemies/enemy-shots.js`
- `tests/`

### Acceptance criteria

- [ ] A crawler directly under a floor the player stands on does not see the player and does not damage them.
- [ ] A crawler with a clear line still sees and hits as today.
- [ ] `npm test` passes.

### Manual check

The Ascent: stand on a deck above a Wall-crawler's climb. You take no hits through the deck.
