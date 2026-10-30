**Lane:** core (Ozuko); the dive body is shaders (Lethabo)
**Priority:** SHOULD. Quality plan §3.4, Phase 1
**PRD:** rubric, Gameplay & Experience
**Cost:** S–M
**Depends on:** #231 (submerge camera glide) first; loop pass steps 2 and 4

**Gate:** Phase 1 builds wait on the loop pass (`docs/playtests/loop-pass.md`): one change at a time, played against `main`, kept or dropped by Renda. Don't build this until its row there has a **keep**, and it needs a `docs/DECISIONS.md` entry (the plan marks it "decision needed").

### Context

Submerge is the move the game is built around (plan §3.4): in Splatoon swimming is the dodge, the reposition and the reload at once. Today it has no exit move and does nothing special on walls.

### Change (plan §3.4)

- **Pop-out jump (new verb):** jumping out of submerge adds about 25% jump height and keeps your speed. The rhythm: shoot → dive → move → pop out → shoot.
- **Submerge on a wall (green only):** climb faster while submerged in green, so green is a fast route, not just a gate.
- The submerge numbers (`speedMultiplier` 1.4 → 1.9, `refillMultiplier` 4 → 5, FOV +8° while submerged and moving) are loop-pass steps, each played first, not part of this issue.

### Scope — files you may touch

- `src/core/player.js`, `src/config.js` (`SUBMERGE`)
- `tests/`

### Acceptance criteria

- [ ] A jump started while submerged is higher than a standing jump by the configured share, and keeps horizontal speed.
- [ ] Submerged on a green wall, the climb is faster than climbing it normally.
- [ ] `npm test` passes.

### Manual check

Outskirts: dive, swim toward the Sprayer, pop out and shoot. Then submerge up a green wall.
