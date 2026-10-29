**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E3
**Cost:** M
**Depends on:** #92, #85 for bounce numbers that already work

### Context

The level's personality and its **final exam for movement**: three red pads up a cliff with no floor between them, a safe switchback underneath, and a boulder coming down behind you so that "safe" is not free either.

If this room is not fun, the level has no reason to exist.

Design: `docs/levels/02-the-ascent.md`, room R5.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — the chain, the switchback, the boulder
- One Wall-crawler spawn on the cliff

### Out of scope — do not touch

- `SURFACE.red` or `PLAYER.minBounce` — the pads must fit the existing numbers, not the other way round
- Terrace two
- The ledge above

### Acceptance criteria

- [ ] Three red pads ascending the cliff, each within the existing bounce envelope (2 m lift, ~4.5 m travel)
- [ ] A missed pad **always** lands on the switchback — never in the void
- [ ] The switchback is a complete alternative route, slower and more exposed
- [ ] A boulder travels down the switchback on entry, so the safe route is not free
- [ ] One Wall-crawler climbs the cliff, faster than the player can chain it
- [ ] A player who takes the chain arrives above the turrets from terrace two

### Manual check

Chain it ten times. Note how many misses end in a fall to the switchback versus a death. The death count must be zero.

Then take the switchback once and confirm the boulder actually pressures you.

### Design note

This is the room to spend playtest time on. Tune pad spacing until a miss is always recoverable and a hit always feels earned. If a pad has to move more than half a metre to work, the cliff geometry is wrong, not the pad.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
