**Lane:** shaders (Lethabo), who owns `src/enemies/`; hit confirmation is UI (Moses)
**Priority:** COULD — a luxury. Nothing ships broken without it.
**PRD:** none — makes the "the room is a weapon" beat in `docs/levels/01-outskirts.md` real
**Cost:** S
**Depends on:** nothing

### Context

Red knockback is meant to throw an enemy off a ledge: Outskirts' island C is ringed by toxic waste, and the Ascent has Chargers on ledges. Today it can't. `_applyKnockback` in `src/enemies/enemy.js` skips the ground probe on purpose, so the shove carries the enemy past the edge. But knockback has no gravity ("No gravity yet", per the method's own comment), so the enemy hangs in the air over the waste at the height it left from.

The enemy already has a fall: `_fall(dt)` drops a crawler that lets go of a wall until the probe finds floor. Knockback just never starts it.

### Scope — files you may touch

- `src/enemies/enemy.js` — when knockback leaves an enemy with no ground under it, start the existing fall
- `src/config.js` — any new number
- `tests/` — the test below

### Out of scope

- Killing in the waste itself. The waste is not lethal on touch; `killY` is (`docs/levels/01-outskirts.md`, `WASTE` in `level-01-mission.js`). An enemy that falls past the floor should die the way a player does below `PLAYER.killY`.
- Level geometry. The ledges already exist.

### Acceptance criteria

- [ ] A Charger knocked off island C's side edge falls, and dies once it is below the kill height
- [ ] A Charger knocked across open floor still lands on that floor (no false falls)
- [ ] A frozen or pinned enemy keeps its current knockback rules
- [ ] A test covers both cases with a real floor list

### Nice to have (UI lane)

- A distinct sound and a hit confirmation for an environment kill, so a player who finds it wants to do it again.

### Manual check

Outskirts, island C: paint red, shoot the Charger at x 5 toward the right edge. It should fall into the waste and not come back.
