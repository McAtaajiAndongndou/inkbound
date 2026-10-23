**Lane:** shaders (Lethabo), with Dikeledi on the paint write
**Priority:** MUST
**PRD:** B2
**Cost:** M
**Depends on:** #1 — the tank must exist before eating territory means anything

### Context

The Drainer is the anti-snowball of the whole game. In a good wave the player paints, gets faster and better armed, and the arena becomes theirs — positive feedback that would make a climax trivial. The Drainer takes that back by converting painted ground to grey while it feeds.

`src/config.js` already has `drainsPaint: true` on the drainer config, but nothing reads it. It is a flag with no behaviour.

Design: `docs/enemies/algorithms.md` (Drainer), `docs/levels/03-last-colour.md`.

### Scope — files you may touch

- `src/enemies/enemy.js` — the feeding behaviour and the grey write
- `src/paint/paint-surface.js` — **coordinate with Dikeledi**; a method to convert a cell to grey
- `src/config.js` — drain radius and rate

### Out of scope — do not touch

- The paint shader's rendering — grey already renders
- Other enemies
- Level geometry

### Acceptance criteria

- [ ] A feeding Drainer converts painted cells under and near it to grey at a documented rate
- [ ] It does not convert cells it is not touching
- [ ] It stops feeding and stands up (hunting posture) when the player is within 8 m
- [ ] It returns to feeding past 14 m
- [ ] Territory recovery by the player and territory loss by the Drainer can both happen in the same area without corrupting the grid
- [ ] `tests/drainer-territory.test.js` fails on `main` and passes here

### Manual check

Paint a patch. Put one Drainer in the middle of it. Watch the patch shrink from the enemy outward, not from a hard-coded edge. Kill it — the shrinking stops where it stood.

### Design note

The rate is the difficulty dial for the entire final level. Tune it last, after the waves are built, and write the number down here when you find it.

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after
- [ ] Status column in `docs/PRD.md` updated (B2)
- [ ] No files touched outside the lane
