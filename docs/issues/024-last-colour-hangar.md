**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E4
**Cost:** M
**Depends on:** 008 (the drainer must eat paint for this room to mean anything), M6 for the model

### Context

The level teaches its entire rule in one wave: **they eat your ground.** The player paints a safe field, watches it disappear, and repaints. That loop, felt once, is the whole level.

Design: `docs/levels/03-last-colour.md`, room "Hangar".

### Scope — files you may touch

- `src/levels/level-03-horde.js` — the hangar and its wave
- The wave spawn table

### Out of scope — do not touch

- Drainer behaviour
- The corridor and the core
- The boss

### Acceptance criteria

- [ ] One wave of six Drainers, and nothing else
- [ ] They feed on painted ground and visibly convert it to grey
- [ ] They rise to hunt when the player is close and return to feeding when far
- [ ] The floor is wide enough that a player can paint a field and lose it
- [ ] The wave completes and opens the route to the corridor
- [ ] Grey in this level reads as Corrupt Corp's floor, not as empty concrete

### Manual check

Paint a large field, stand still, and watch. The patch should shrink from the enemies outward. Then fight back and confirm it can be reclaimed.

### Design note

One enemy, one wave, no Boss, no Stalker. The lesson has to be clean before anything else is added — if a playtester does not repaint unprompted, the Drainers are too quiet or too slow, and that is the bug to fix.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
