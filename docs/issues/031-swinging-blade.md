**Lane:** levels (Renda)
**Priority:** SHOULD
**PRD:** F2
**Cost:** S
**Depends on:** 029

### Context

The trap that proves the whole trap language: a hazard you can either **time** or **paint around**. It appears on the Outskirts pillar approach and across the Ascent's ledge.

Design: `docs/levels/01-outskirts.md` (The Pillars) and `docs/levels/02-the-ascent.md` (R6).

### Scope — files you may touch

- `src/levels/` — the swinging-blade behaviour
- Both level files, for placement only
- `src/config.js` — swing period and arc

### Out of scope — do not touch

- The damage volume helper
- The grapple of a green climb route — that is level geometry, not this behaviour

### Acceptance criteria

- [ ] The blade swings on a fixed, boringly predictable period
- [ ] Contact damages on the shared cooldown
- [ ] The arc is readable from a distance — the player can see where it will be
- [ ] It cannot be destroyed
- [ ] It does not follow the player; the rhythm is the challenge
- [ ] On the Ascent ledge it swings across the spot where a player would stand still to pin a Charger

### Manual check

Watch it for two full periods without moving. If you cannot predict exactly where it will be on the third, the period is wrong or the arc is too fast.

### Design note

In Outskirts this trap's real job is to make the player notice the **green route around it**. If nobody ever takes the green route, the trap is decoration and the level has lost its lesson.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
