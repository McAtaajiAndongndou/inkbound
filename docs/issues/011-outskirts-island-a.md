**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** S
**Depends on:** nothing — the geometry already exists

### Context

The first thirty seconds of Outskirts are meant to be pure play. No enemies, no objectives, just movement across an island with a gap and a visible hazard at the edge.

Design: `docs/levels/01-outskirts.md`, beat "Island A — the open". The island exists — this issue is pacing and hazard placement, not new layout.

### Scope — files you may touch

- `src/levels/level-01-mission.js` — Island A only (`L1.islands.A`, and the tree list for that band)
- `src/config.js` — only if a trap number needs a home

### Out of scope — do not touch

- Islands B and C, the pillars, the ascent block
- The decor scatter system in `decor.js`
- Enemy spawns

### Acceptance criteria

- [ ] The player can walk from spawn to the Gap without encountering an enemy
- [ ] The first spike pit is visible before it can hurt anyone
- [ ] Falling into the Gap returns the player to Island A, not to death
- [ ] Foliage does not close over the route at eye height
- [ ] There is at least 6 m of open ground in front of spawn to run in

### Manual check

Start a fresh run and do nothing but run forward. The pit should be obvious before you reach it, and you should never be surprised by a hazard you could not see.

### Design note

This beat exists to let the player trust the level. Resist adding a second hazard here — the pit is teaching *that traps exist*, and one lesson per room.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for E2 updated if this is the last Outskirts slice outstanding
- [ ] No files touched outside the lane
