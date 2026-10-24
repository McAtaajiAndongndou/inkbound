**Lane:** levels (Renda)
**Priority:** COULD
**PRD:** F3
**Cost:** S
**Depends on:** 029, 025 (the corridor they live in)

### Context

Last Colour is the only level where traps are **security systems** rather than ancient hazards, and that is the story doing level-design work. Two of them: a crusher on a rhythm, and a laser grid that cannot be crossed directly.

Design: `docs/levels/03-last-colour.md`, room "Corridor".

### Scope — files you may touch

- `src/levels/level-03-horde.js` — both traps
- `src/config.js` — periods and widths

### Out of scope — do not touch

- The corridor's enemies
- The hangar or the core

### Acceptance criteria

- [ ] **Cargo crusher:** a press on a fixed rhythm, passable in the gap or under it on blue
- [ ] **Laser grid:** lethal on contact, and not passable by running through it
- [ ] The grid has a red-bounce route over it and a green-climb route around it
- [ ] Both read as machinery — housings, warning lights, a hum
- [ ] Neither is destroyable
- [ ] Neither can trap the player permanently in a room with no exit

### Manual check

Cross the corridor three times: through the crusher gap, over the grid on red, around it on green. Then try to walk through the laser and confirm it kills.

### Design note

The green route around the grid should be slower than the red route over it, so the safe answer costs time. If they're equal, the player has no decision.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
