**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E3
**Cost:** S
**Depends on:** 021, 004 (the recovery window is what makes this fair)

### Context

The level's **final exam**: a familiar enemy, made new by terrain. In the forest you sidestepped a Charger. Here there is nowhere to sidestep to.

Design: `docs/levels/02-the-ascent.md`, room R6.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — the ledge and its one Charger spawn
- The two pendulum blades

### Out of scope — do not touch

- Charger behaviour
- The chain below
- The summit

### Acceptance criteria

- [ ] The shelf is roughly 5 m wide with a long drop on both sides
- [ ] Exactly one Charger
- [ ] Blue on its line sends it over the edge rather than past you — the clean kill
- [ ] Red bounce lets the player cross over it and land behind
- [ ] Green pin stops it, at the cost of standing still
- [ ] Two pendulum blades swing on a fixed rhythm across the shelf, so standing still costs something
- [ ] Falling returns the player to terrace two, not to death

### Manual check

Beat it three ways. All three should work and feel different. If green pin is obviously best, the pendulums are not swinging over the place you need to stand.

### Design note

The blades exist to make the *safe* answer expensive. Without them, pinning is free and the room teaches nothing. This is the one place in the level where a trap is aimed at a specific tactic rather than at traversal.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
