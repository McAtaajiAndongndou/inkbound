**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** S
**Depends on:** nothing — the island exists

### Context

The entry beat, and the level's first lesson in **verticality**: a Sprayer stands on a deck above the island and ignores the player until they climb to it.

Design: `docs/levels/01-outskirts.md`, "Island A — the entry".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — Island A, its deck, its spawns
- The spike pit placement

### Out of scope — do not touch

- Island B and beyond
- Enemy behaviour
- The decor scatter system

### Acceptance criteria

- [ ] One Charger on the floor
- [ ] One Sprayer on a raised deck, reachable by green climb or red bounce
- [ ] That Sprayer **does not aggro until the player climbs** — it is opt-in difficulty
- [ ] The spike pit is visible before it can hurt anyone
- [ ] At least 6 m of open ground in front of spawn
- [ ] Falling returns the player to the island, not to death

### Manual check

Walk the floor route: one enemy, one visible hazard, no pressure. Then climb the deck and confirm the second enemy wakes. If the deck enemy shoots you on the floor route, the whole "opt-in difficulty" rule is broken.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
