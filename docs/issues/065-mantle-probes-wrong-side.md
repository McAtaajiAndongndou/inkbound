**Lane:** core (Ozuko), with Moses reviewing
**Priority:** MUST. A regression: no green climb in the game can be finished
**PRD:** none. Fixes #157 (draft 062), which shipped with this bug
**Cost:** S. The fix is one sign in two lines; most of the work is the test
**Depends on:** nothing

### Context

Renda, playtest, 30 Oct: "I can't climb to the top, it's like the mantle/climb is being rejected."

The mantle (#157) asks "is there a floor just past the top of this wall?" by probing down from a point beside the wall's top edge, in `Player.update` (`src/core/player.js`, the mantle check inside `if (this.climbing)`):

```js
const probeX = this.position.x + wall.normal.x * (PLAYER.radius + MANTLE.inward);
const probeZ = this.position.z + wall.normal.z * (PLAYER.radius + MANTLE.inward);
```

`_resolveWalls` builds `wall.normal` from the side the player is on, so it points **out of the wall, toward the climber**. Adding it moves the probe 1 m *behind the player's back*, not over the top of the wall. The probe then finds the floor the player climbed from (if it's within `groundProbeRange` of the top edge), and the mantle "succeeds" by lerping the player **down** to that floor. They grab the wall again and loop. On a wall taller than about 5.6 m the probe finds nothing, so no mantle fires and the climber falls back.

This also breaks the climbs that worked *before* #157. The 0.3 m lips (DECISIONS, the Ascent v2: "No mantle. Every climb keeps a 0.3 m lip") still exist, but the mantle fires a metre below the top and yanks the player down before the lip can catch them.

**Why `tests/mantle.test.js` passes:** its top floor is a 200 × 200 m plane at the wall's top height, so it covers both sides of the wall, and a probe on the wrong side still finds `y = 10`.

### Repro (simulated)

A green wall facing the player, a floor at its top only *behind* the wall, holding W from 1 m away, 6 s at 60 fps:

| Wall | Now | With the fix |
|---|---|---|
| 3 m | mantles to `(0, 0, -1.4)`: the ground behind; loops | ends on top, y = 3.0 |
| 5 m | mantles to `(0, 0, -1.4)`; loops | ends on top, y = 5.0 |
| 8 m | never mantles; falls back | ends on top, y = 8.0 |

The same with a 0.3 m lip toward the climber: identical results.

### The fix

Subtract the normal, so "past the edge" is into the wall:

```js
const probeX = this.position.x - wall.normal.x * (PLAYER.radius + MANTLE.inward);
const probeZ = this.position.z - wall.normal.z * (PLAYER.radius + MANTLE.inward);
```

Update the comment above it as well. It says the floor is on the wall's normal side, which is the climber's side.

### Scope — files you may touch

- `src/core/player.js`: the two probe lines and their comment
- `tests/mantle.test.js`: make the top floor sit only behind the wall (see below)

### Out of scope

- The level lips. Once this lands they're no longer needed, but removing them is the levels lane's call (Renda), in a separate change.
- The small pop above the top edge as the mantle ends (`climbing` stays true for a frame). Only fix it if it shows in play.

### Acceptance criteria

- [ ] `tests/mantle.test.js` has a case whose top floor covers **only the far side** of the wall (for example, a 6 m deep slab starting at the wall face, with the ground floor on the climber's side). It **fails on `main` today** and passes with the fix
- [ ] The test covers a wall short enough that the ground is within probe range (3 m). That's the case that pulls the player down today
- [ ] A climber on a wall with **no** floor behind its top still does not mantle (the existing "nothing to land on" behaviour)
- [ ] `npm test` passes

### Manual check

Outskirts, the left pillar on island C (green strip), and the Ascent's R1 staged climb: paint green, hold W into the wall. You should be pulled onto the top within a quarter-second of reaching it, every time, and never dropped back to the floor you started from.
