**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E4
**Cost:** M
**Depends on:** 024, 005 (turret no-procs), M5 and M7 for the models

### Context

The squeeze. No waves, no horde — a, hostile, linear beat that punishes a player who did not keep their paint. A painted corridor is a fast corridor; an unpainted one is where they die.

Design: `docs/levels/03-last-colour.md`, room "Corridor".

### Scope — files you may touch

- `src/levels/level-03-horde.js` — the corridor, its enemies and its traps
- A cargo crusher and one laser grid

### Out of scope — do not touch

- Turret behaviour
- The hangar behind and the core ahead
- The Stalker, which belongs to the core

### Acceptance criteria

- [ ] Two turrets and one Charger zombie, no waves
- [ ] The turrets deny sightlines rather than blocking the path outright — flanking must be possible
- [ ] A cargo crusher on a fixed rhythm, crossable in the gap or under it on blue
- [ ] One laser grid that cannot be crossed directly; red bounce or green climb gets past it
- [ ] A painted corridor is measurably faster to traverse than a grey one
- [ ] The corridor is survivable with an empty tank if the player uses cover, and punishing if they do not

### Manual check

Traverse it twice: once painting ahead, once not. The second should be clearly worse. Then take the laser grid's green route and confirm it is genuinely a route, not a decoration.

### Design note

This is the only room in the game where **traps are security systems**, so they should read as machinery rather than as ancient hazards. That is the story doing level-design work.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
