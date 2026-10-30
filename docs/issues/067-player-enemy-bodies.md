**Lane:** core (Ozuko), with Moses reviewing
**Priority:** MUST. A playtest bug: the player walks straight through enemies
**PRD:** none. Fixes something every shooter is assumed to have
**Cost:** S
**Depends on:** nothing. Pairs with #187 (enemies push each other apart); either can land first

### Context

Renda, playtest, 30 Oct: "a player or enemy can still walk through enemies, they aren't physical objects."

Confirmed in the code. The player only collides with **walls** (`Player._resolveWalls`, `src/core/player.js`). The only thing that looks at enemies is `checkEnemyContact`, and that only *damages*: if an enemy is within `HEALTH.contactRange` (1.0 m) it calls `takeDamage`, and never moves the player. So you can walk into a Charger, stand inside it, and walk out the other side.

Why it matters:

- **Readability.** An enemy you can walk through reads as a ghost or a hologram, not as a body. Splatoon's Salmon Run Lessers and CoD's zombies both shove you; Doom's demons block doorways. Every reference this game leans on has solid bodies.
- **Melee becomes pointless to dodge.** The Charger's whole question is "where will you be standing when it arrives?" If you can stand *inside* it, the answer is "anywhere".
- **Cornering doesn't exist.** A crowd in a corridor (Last Colour's corridor, the Primer's R7) should be a wall you have to paint or shoot through. Today it's fog.

### The design

**Enemies are solid to the player. The player is pushed out; the enemy is not moved.**

| Choice | Value | Why |
|---|---|---|
| Shape | A vertical cylinder per enemy, radius `ENEMY_BODY.radius` (0.4 m), against the player's `PLAYER.radius` (0.4 m) | Same circle-in-the-floor maths as the walls, horizontal only |
| Separation distance | `PLAYER.radius + enemy body radius` = **0.8 m** | |
| Big Arm | body radius **0.6 m** (its model is 1.5 × the soldiers: 2.4 m vs 1.6 m) | A boss you can clip into is not a boss |
| Vertical | Only when the heights overlap: `|dy| < HEALTH.contactHeight` (1.7 m) | You on a ledge above, the enemy below, don't push each other |
| Who is solid | Every enemy that is `alive !== false`, **including sleeping ones** | A dormant guard is still standing there. Corpses are not solid |
| Not solid | A wall-crawler **on a face** (`_climbing`) | Its body is held off the wall; the wall already stops you |
| Who moves | **Only the player**, fully out along the horizontal line between centres | Pushing enemies would let the player shove them through walls or off ledges, which the enemy nav forbids. Enemy-vs-enemy is #187 |
| Exactly on top (dist ≈ 0) | Push along the player's facing reversed | Avoids a divide by zero and a random direction |

**Contact damage keeps working.** `HEALTH.contactRange` is 1.0 m and the push-out keeps you at 0.8 m, so an enemy pressed against you is still "touching" and still hurts. Don't change `contactRange`. **The one edge case is Big Arm** (`contactDamage: 20`). Pressed against it you sit at exactly 1.0 m, right on the contact boundary, so floating-point error decides whether it hurts. Fix it in `checkEnemyContact`: the touch range per enemy becomes `max(HEALTH.contactRange, PLAYER.radius + bodyRadius + 0.2)`. That's 1.0 m for soldiers (unchanged) and 1.2 m for Big Arm. Add a test for it.

### Where it runs

A new `Player.resolveEnemyBodies(enemies)`, called in `main.js` straight after `level.update(dt, player)` and **before** `player.checkEnemyContact(level.enemies)`. Enemies have moved this frame by then, so the player is pushed out of where they are now, not where they were.

After pushing, run `this._resolveWalls()` again, so an enemy can't shove you into or through a wall panel. One pass is enough: a wall that pushes you back into an enemy will be settled next frame, and the 0.1 m overlap that leaves is invisible.

### Config

`ENEMY_BODY = { radius: 0.4, chest: 0.9 }` is a local constant at the top of `src/enemies/enemy.js`. Move it into `src/config.js` as an export (AGENTS rule 4), and add `bodyRadius: 0.6` to `ENEMY.bigArm`. The player reads `enemy.config.bodyRadius ?? ENEMY_BODY.radius`.

`enemy.js` keeps working unchanged until #187 switches it to the import; the duplicate is one line and #187 removes it. Tell Lethabo in the group chat that the block has moved.

### Scope — files you may touch

- `src/core/player.js`: `resolveEnemyBodies`
- `src/main.js`: the one call
- `src/config.js`: export `ENEMY_BODY`; `bodyRadius` on `ENEMY.bigArm`
- `tests/player-enemy-bodies.test.js` (new)

### Out of scope

- **Enemies pushing each other apart** (#187, enemies lane).
- **Standing on an enemy's head.** You'll slide off: enemies are not floors. Fine for now.
- **Knockback when an enemy hits you.** That's feel (audit P1), not collision.

### Acceptance criteria

- [ ] Walking into a standing enemy stops the player with centres **0.8 m** apart (± 0.05), from any direction
- [ ] Holding W into an enemy for 2 s never puts the player inside 0.8 m, and never through to the other side
- [ ] A Big Arm stops the player at **1.0 m** (0.4 + 0.6), and pressing against it deals its contact damage
- [ ] A dead enemy (`alive === false`) is not solid
- [ ] A sleeping enemy **is** solid
- [ ] An enemy 2 m below the player (on a lower floor) does not push the player
- [ ] An enemy standing next to a wall cannot push the player into the wall: after the frame, the player is outside both
- [ ] Contact damage still lands while pressed against a Charger (the existing `player-health` tests still pass)
- [ ] `player-alloc.test.js` still passes: nothing is allocated per frame
- [ ] `npm test` passes

### Manual check

1. The Primer, R7 "One of Theirs": walk straight into the Charger before it wakes. You stop at its chest.
2. Outskirts, island B: let a Sprayer close in and run through it. You can't; you go round.
3. Last Colour, the Corridor: with a crowd ahead, the corridor should feel blocked until you paint or shoot through it.
