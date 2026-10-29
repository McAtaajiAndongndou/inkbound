**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E3
**Cost:** M
**Depends on:** #89 (the face the crawler climbs), D3 and M4 for the crawler itself

### Context

The level's best idea, and the one most likely to feel unfair if it is placed carelessly. The player has just learned "green means go up". Here, a **Wall-crawler uses the same green** to come down at them.

Design: `docs/levels/02-the-ascent.md`, room R2.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — terrace one, its spawns, its two exits
- The raised cover block

### Out of scope — do not touch

- The wall-crawler's climb behaviour
- The first face (issue #89)
- The catwalk

### Acceptance criteria

- [ ] One Wall-crawler spawns, starting on the far side of the terrace
- [ ] It can reach the terrace via the face the player painted in R1
- [ ] The crawler is **visible from the terrace floor before it commits** — this is the fairness requirement
- [ ] The terrace is at least 16 m wide with two exits, so retreat is possible
- [ ] There is one raised block that breaks line of sight
- [ ] Killing it reopens the route onward

### Manual check

Walk in having painted the R1 face green. Watch the crawler use it. Then walk in having painted it red instead and confirm the route is different — the crawler should be slower or take another path.

### Design note

**Fairness first.** The whole point is the realisation "my route is its route", and that realisation requires seeing it happen. If the crawler arrives from off-screen, the player reads it as a spawn, not a consequence. Consider a brief pause at the top of the face before it drops.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
