**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** M
**Depends on:** 012 (the Charger fight must be readable before two enemies share a room)

### Context

The first **combination**. A Charger demands movement; a Sprayer punishes movement in the open. There is no single colour that answers both, so the player has to choose an order.

Design: `docs/levels/01-outskirts.md`, beat "Island C — two at once".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — `L1.islands.C`, its spawns, and the gate at its back edge
- `src/config.js` — enemy counts if they live there

### Out of scope — do not touch

- Either enemy's behaviour
- The pillars and the tower behind the gate
- Island B

### Acceptance criteria

- [ ] Exactly one Charger and one Sprayer spawn on Island C
- [ ] The Sprayer keeps range rather than walking into melee
- [ ] The room is open enough to retreat and repaint — at least two exits or a wide floor
- [ ] The gate opens only when both are dead
- [ ] A player who kills the Sprayer first has an easier fight, and that is discoverable without being told

### Manual check

Fight the room twice, killing in a different order. One order should feel clearly smarter. If both feel identical, the two enemies are not exerting different pressure.

### Design note

This is the level's first real decision, so readability matters more than difficulty. Both enemies must be visible from where the player enters.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
