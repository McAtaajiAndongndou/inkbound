**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** M
**Depends on:** #73 for the tank, or the beat punishes the player for using its own lesson

### Context

The signature movement moment: slide down blue, launch off red, land. It is the beat that stops the game being a shooter with paint in it.

Design: `docs/levels/01-outskirts.md`, beat "The Gap — momentum". The geometry exists; the numbers need to agree with it.

### Scope — files you may touch

- `src/levels/level-01-mission.js` — the Gap, the blue slope and red pad placement
- `tests/` — a range test for the jump

### Out of scope — do not touch

- `PLAYER` and `SURFACE` in `config.js` — the physics is tuned and tested elsewhere
- The pillars setpiece
- The waste surface

### Acceptance criteria

- [ ] A player who paints the slope blue and runs down it clears the Gap without jumping at the lip
- [ ] The red pad converts that speed into height rather than cancelling it
- [ ] A missed jump lands on Island B, never in the void
- [ ] A player who does *not* paint still falls short — the paint has to be the reason it works
- [ ] `tests/` covers the minimum blue-speeds-into-red distance

### Manual check

Run it five times. If any of those five is a coin flip, the slope is too short or the pad is too far from the lip.

### Design note

The existing tests already assert that blue alone falls short of the Gap and red alone clears it. Do not change the physics to make this room work — change the room. If the room cannot be made to work, that is a design bug worth raising, not a tuning problem.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
