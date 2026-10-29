**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** M
**Depends on:** #83, #102 for the collapsing bridge, #82 for jump readability

### Context

The first real fight. Two Chargers on the floor and one Sprayer on a deck — **no single colour answers all three**, so the player has to choose an order. The exit is a collapsing bridge, so the room ends with a decision about commitment rather than a walk.

Design: `docs/levels/01-outskirts.md`, "Island B — the first real fight".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — Island B, its deck, its spawns, the exit bridge
- The deck's climb or bounce access

### Out of scope — do not touch

- The Gap, which is its own issue
- Enemy behaviour
- Island A

### Acceptance criteria

- [ ] Two Chargers on the floor, one Sprayer on a deck
- [ ] The deck Sprayer **only aggroes once the player climbs**
- [ ] The floor is wide enough (14 m+) for a retreat to be possible
- [ ] The collapsing bridge is the only exit, and it telegraphs before it falls
- [ ] Blue crosses the bridge in one slide; running it works but feels reckless
- [ ] Clearing the island opens the route to the Gap

### Manual check

Fight it staying on the floor, then fight it having climbed the deck first. The two fights should feel different — one about movement, one about cover.

### Design note

The paint the player lays here is also the Gap's run-up, so leave room where they will naturally put it. That reuse is what makes the island feel designed rather than decorated.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
